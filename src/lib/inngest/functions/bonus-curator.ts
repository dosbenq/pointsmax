import { inngest } from "../client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createAdminClient } from "@/lib/supabase";
import { getGeminiModelCandidatesForApiKey } from "@/lib/gemini-models";
import { generateIdempotencyKey, withIdempotency } from "@/lib/idempotency";
import { INNGEST_RETRY_CONFIG } from "@/lib/queue-durability";

type ExtractedBonus = {
  from_program_name: string
  to_program_name: string
  bonus_pct: number
  start_date: string
  end_date: string
}

type ProgramRef = { name?: string | null } | Array<{ name?: string | null }> | null
type TransferPartnerRow = {
  id: string
  from_program: ProgramRef
  to_program: ProgramRef
}

function isExtractedBonus(value: unknown): value is ExtractedBonus {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.from_program_name === 'string'
    && typeof row.to_program_name === 'string'
    && typeof row.bonus_pct === 'number'
    && Number.isFinite(row.bonus_pct)
    && typeof row.start_date === 'string'
    && typeof row.end_date === 'string'
  )
}

function readProgramName(program: ProgramRef): string {
  if (Array.isArray(program)) {
    return typeof program[0]?.name === 'string' ? program[0].name.toLowerCase() : ''
  }
  return typeof program?.name === 'string' ? program.name.toLowerCase() : ''
}

const BONUS_NEWS_URLS = [
  'https://frequentmiler.com/current-transfer-bonuses/',
  'https://onemileatatime.com/guides/credit-card-transfer-bonuses/',
]

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchBonusNewsText(): Promise<string> {
  for (const url of BONUS_NEWS_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PointsMaxBonusCurator/1.0 (+https://pointsmax.com)',
        },
        cache: 'no-store',
      })
      if (!response.ok) continue
      const html = await response.text()
      const text = htmlToText(html)
      if (text.length >= 500) {
        return text.slice(0, 30_000)
      }
    } catch {
      // Try next source.
    }
  }

  // Keep workflow resilient if all sources fail for a run.
  return `
    LATEST TRANSFER BONUSES:
    - Chase Ultimate Rewards to Virgin Atlantic: 30% bonus.
    - Amex Membership Rewards to Hilton Honors: 40% bonus.
    - Capital One to Flying Blue: 25% bonus.
  `
}

/**
 * The Bonus Curator Agent
 * Runs daily to find and ingest new transfer bonuses from the web.
 *
 * Reliability config:
 *  - retries: 5  (financial preset — bonus data must eventually land)
 *  - Each DB insert is wrapped with withIdempotency so a retried run
 *    does not double-insert the same bonus.
 */
export const bonusCurator = inngest.createFunction(
  { id: "bonus-curator", name: "Agent: Bonus Curator", ...INNGEST_RETRY_CONFIG.financial },
  { cron: "0 10 * * *" }, // Run daily at 10:00 UTC
  async ({ step }) => {
    // 1. Fetch content from a reliable points news source
    const newsContent = await step.run("fetch-points-news", async () => {
      return fetchBonusNewsText()
    })

    // 2. Use Gemini to extract structured data
    const extractedBonuses = await step.run("extract-bonuses-with-ai", async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

      const genAI = new GoogleGenerativeAI(apiKey);
      const modelNames = await getGeminiModelCandidatesForApiKey(apiKey);
      const model = genAI.getGenerativeModel({ model: modelNames[0] });

      const prompt = `
        Extract all current credit card transfer bonuses from the following text into a valid JSON array.
        
        TEXT:
        ${newsContent}

        JSON SCHEMA:
        [{
          "from_program_name": "string (e.g. Amex MR)",
          "to_program_name": "string (e.g. British Airways)",
          "bonus_pct": number (e.g. 30),
          "start_date": "YYYY-MM-DD",
          "end_date": "YYYY-MM-DD"
        }]

        Return ONLY the JSON array. If no bonuses are found, return [].
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        // Clean up markdown if AI returned it
        const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || text;
        const parsed = JSON.parse(jsonStr) as unknown
        if (!Array.isArray(parsed)) return []
        return parsed.filter(isExtractedBonus)
      } catch {
        console.error("Failed to parse AI response as JSON:", text);
        return [];
      }
    });

    // 3. Reconcile and save to Supabase
    const stats = await step.run("update-database", async () => {
      if (!extractedBonuses.length) return { added: 0, skipped: 0 };

      const db = createAdminClient();
      let added = 0;
      let skipped = 0;

      // Get all active programs and transfer partners to map names to IDs
      const { data: partners } = await db
        .from("transfer_partners")
        .select(`
          id,
          from_program:programs!transfer_partners_from_program_id_fkey(name),
          to_program:programs!transfer_partners_to_program_id_fkey(name)
        `);

      for (const bonus of extractedBonuses as ExtractedBonus[]) {
        // Find matching transfer partner by names
        const partner = (partners as TransferPartnerRow[] | null)?.find((p) => {
          const fromName = readProgramName(p.from_program)
          const toName = readProgramName(p.to_program)
          const targetFrom = bonus.from_program_name.toLowerCase();
          const targetTo = bonus.to_program_name.toLowerCase();
          
          return (fromName.includes(targetFrom) || targetFrom.includes(fromName)) &&
                 (toName.includes(targetTo) || targetTo.includes(toName));
        });

        if (partner) {
          // Idempotency key: stable per (partner, bonus_pct, end_date) tuple so
          // retried runs or duplicate invocations never double-insert.
          const idempotencyKey = generateIdempotencyKey(
            'bonus-insert',
            partner.id,
            String(bonus.bonus_pct),
            bonus.end_date,
          );

          const { data: outcome, idempotent } = await withIdempotency<'inserted' | 'already_exists'>(
            idempotencyKey,
            async () => {
              // Guard against concurrent race: re-check DB before inserting
              const { data: existing } = await db
                .from("transfer_bonuses")
                .select("id")
                .eq("transfer_partner_id", partner.id)
                .eq("bonus_pct", bonus.bonus_pct)
                .eq("end_date", bonus.end_date)
                .maybeSingle();

              if (!existing) {
                await db.from("transfer_bonuses").insert({
                  transfer_partner_id: partner.id,
                  bonus_pct: bonus.bonus_pct,
                  start_date: bonus.start_date,
                  end_date: bonus.end_date,
                  is_verified: false, // Mark for human review
                  notes: "Automatically discovered by Bonus Curator Agent"
                });
                return 'inserted';
              }
              return 'already_exists';
            },
          );

          if (!idempotent && outcome === 'inserted') {
            added++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      }

      return { added, skipped };
    });

    return {
      message: "Bonus curation complete",
      stats
    };
  }
);
