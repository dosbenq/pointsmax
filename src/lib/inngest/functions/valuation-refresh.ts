import { GoogleGenerativeAI } from '@google/generative-ai'
import { createAdminClient } from '@/lib/supabase'
import { inngest } from '../client'
import { getGeminiModelCandidatesForApiKey, markGeminiModelUnavailable } from '@/lib/gemini-models'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { matchProgramByName } from '@/lib/connectors/program-matcher'
import { revalidateTag } from 'next/cache'

const TPG_VALUATIONS_URL = 'https://thepointsguy.com/points-miles-valuations/'

type ExtractedValuation = {
  program_name: string
  cpp_cents: number
}

type ProgramRow = {
  id: string
  name: string
  slug: string
}

export function matchProgram(programs: ProgramRow[], extractedName: string): ProgramRow | null {
  const match = matchProgramByName(extractedName, programs)
  if (!match) return null
  return programs.find((program) => program.id === match.program_id) ?? null
}

export async function extractValuationsWithGemini(html: string): Promise<ExtractedValuation[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return []

  const genAI = new GoogleGenerativeAI(apiKey)
  const prompt = `Extract loyalty point valuations from this HTML. Return JSON only as an array of objects shaped like {"program_name":"...", "cpp_cents":1.8}. Use cents per point, not dollars. Ignore non-loyalty rows.\n\nHTML:\n${html.slice(0, 120000)}`
  const candidates = await getGeminiModelCandidatesForApiKey(apiKey)

  for (const candidate of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: candidate })
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) return []
      const parsed = JSON.parse(match[0]) as ExtractedValuation[]
      return parsed.filter((row) => typeof row.program_name === 'string' && Number(row.cpp_cents) > 0)
    } catch (error) {
      markGeminiModelUnavailable(candidate, error)
    }
  }

  return []
}

export const valuationRefresh = inngest.createFunction(
  { id: 'valuation-refresh', name: 'Agent: Weekly Valuation Refresh' },
  { cron: '0 0 * * 1' },
  async ({ step }) => {
    const db = createAdminClient()
    const today = new Date().toISOString().slice(0, 10)

    const html = await step.run('fetch-tpg-valuations-html', async () => {
      const response = await fetch(TPG_VALUATIONS_URL, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Failed to fetch valuations source: ${response.status}`)
      return response.text()
    })

    const extracted = await step.run('extract-valuations-with-gemini', async () => {
      return extractValuationsWithGemini(await html)
    })

    if (extracted.length === 0) {
      logWarn('valuation_refresh_no_rows_extracted', { source: TPG_VALUATIONS_URL })
      return { ok: false, updated: 0, reason: 'no_rows_extracted' }
    }

    const [{ data: programs, error: programError }, { data: currentVals, error: valuationError }] = await Promise.all([
      db.from('programs').select('id, name, slug').eq('is_active', true),
      db.from('latest_valuations').select('program_id, cpp_cents'),
    ])

    if (programError || valuationError) {
      throw new Error(programError?.message ?? valuationError?.message ?? 'Failed to load valuation context')
    }

    const currentByProgramId = new Map(
      (((currentVals ?? []) as Array<{ program_id: string; cpp_cents: number }>).map((row) => [row.program_id, Number(row.cpp_cents)])),
    )

    const updates: Array<{ program_id: string; cpp_cents: number; program_name: string }> = []
    for (const row of extracted) {
      const matched = matchProgram((programs ?? []) as ProgramRow[], row.program_name)
      if (!matched) continue
      const current = currentByProgramId.get(matched.id)
      if (!current || Math.abs(row.cpp_cents - current) / current > 0.15) {
        updates.push({ program_id: matched.id, cpp_cents: row.cpp_cents, program_name: matched.name })
      }
    }

    if (updates.length === 0) {
      logInfo('valuation_refresh_no_changes', { extracted: extracted.length })
      return { ok: true, updated: 0 }
    }

    await step.run('insert-updated-valuations', async () => {
      const { error } = await db.from('valuations').insert(
        updates.map((row) => ({
          program_id: row.program_id,
          cpp_cents: row.cpp_cents,
          source: 'tpg',
          source_url: TPG_VALUATIONS_URL,
          effective_date: today,
          notes: 'Auto-refreshed from TPG via valuation-refresh',
        })),
      )
      if (error) throw new Error(error.message)
      return { inserted: updates.length }
    })

    await step.run('revalidate-valuation-caches', async () => {
      revalidateTag('valuations', 'default')
      revalidateTag('programmatic-cards', 'default')
      return { ok: true }
    })

    await step.run('log-audit-entries', async () => {
      const { error } = await db.from('admin_audit_log').insert(
        updates.map((row) => ({
          admin_email: 'system:valuation-refresh',
          action: 'valuation_updated',
          target_id: row.program_id,
          payload: {
            cpp_cents: row.cpp_cents,
            source_url: TPG_VALUATIONS_URL,
            effective_date: today,
          },
        })),
      )
      if (error) {
        logError('valuation_refresh_audit_log_failed', { error: error.message })
      }
      return { logged: updates.length }
    })

    return { ok: true, updated: updates.length }
  },
)
