import { Resend } from 'resend'
import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase'

const SOURCE_URL = 'https://www.doctorofcredit.com/best-current-transfer-bonuses/'

type ExtractedBonus = {
  from: string
  to: string
  bonus_pct: number
  end_date: string
}

type PartnerRow = {
  id: string
  from_program: { name?: string | null } | { name?: string | null }[] | null
  to_program: { name?: string | null } | { name?: string | null }[] | null
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function readProgramName(value: PartnerRow['from_program']): string {
  if (Array.isArray(value)) return typeof value[0]?.name === 'string' ? value[0].name : ''
  return typeof value?.name === 'string' ? value.name : ''
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseEndDate(snippet: string): string | null {
  const monthDate = snippet.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i)
  if (monthDate) {
    const parsed = Date.parse(monthDate[0])
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10)
  }

  const iso = snippet.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]
  return null
}

function extractBonusesFromText(text: string): ExtractedBonus[] {
  const bonuses: ExtractedBonus[] = []
  const re = /([A-Za-z][A-Za-z&\s]{2,60})\s+(?:to|→|-)\s+([A-Za-z][A-Za-z&\s]{2,80})[^%]{0,40}(\d{1,2})\s*%/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const start = Math.max(0, match.index - 120)
    const end = Math.min(text.length, match.index + 220)
    const snippet = text.slice(start, end)
    const parsedEnd = parseEndDate(snippet)
    const fallbackEnd = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    bonuses.push({
      from: match[1].trim(),
      to: match[2].trim(),
      bonus_pct: Number.parseInt(match[3], 10),
      end_date: parsedEnd ?? fallbackEnd,
    })
  }
  return bonuses
}

function partnerMatchesBonus(partner: PartnerRow, bonus: ExtractedBonus): boolean {
  const fromName = normalizeText(readProgramName(partner.from_program))
  const toName = normalizeText(readProgramName(partner.to_program))
  const fromTarget = normalizeText(bonus.from)
  const toTarget = normalizeText(bonus.to)
  if (!fromName || !toName || !fromTarget || !toTarget) return false
  return (
    fromName.includes(fromTarget) ||
    fromTarget.includes(fromName)
  ) && (
    toName.includes(toTarget) ||
    toTarget.includes(toName)
  )
}

async function maybeSendAdminEmail(newBonuses: Array<{ from: string; to: string; bonus_pct: number; end_date: string }>) {
  if (newBonuses.length === 0) return
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()
  const adminEmail = process.env.ADMIN_EMAIL?.trim()
  if (!apiKey || !fromEmail || !adminEmail) return

  const resend = new Resend(apiKey)
  const lines = newBonuses
    .map((bonus) => `<li><strong>${bonus.from} → ${bonus.to}</strong> +${bonus.bonus_pct}% (through ${bonus.end_date})</li>`)
    .join('')

  await resend.emails.send({
    from: fromEmail,
    to: adminEmail,
    subject: `PointsMax: ${newBonuses.length} transfer bonus candidates detected`,
    html: `
      <h2>New transfer bonuses detected</h2>
      <p>Please verify these in Admin → Transfer Bonuses before publishing.</p>
      <ul>${lines}</ul>
      <p>Source: <a href="${SOURCE_URL}">${SOURCE_URL}</a></p>
    `,
  })
}

export const transferBonusMonitor = inngest.createFunction(
  { id: 'transfer-bonus-monitor', name: 'Agent: Transfer Bonus Monitor' },
  { cron: '0 7 * * *' },
  async ({ step }) => {
    const db = createAdminClient()
    const today = new Date().toISOString().slice(0, 10)

    const sourceText = await step.run('fetch-doc-transfer-bonuses', async () => {
      const response = await fetch(SOURCE_URL, {
        headers: { 'User-Agent': 'PointsMaxBonusMonitor/1.0 (+https://pointsmax.com)' },
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`Failed to fetch source: ${response.status}`)
      const html = await response.text()
      return htmlToText(html)
    })

    const extracted = await step.run('extract-transfer-bonus-candidates', async () => {
      const parsed = extractBonusesFromText(sourceText)
      return parsed.filter((row) => Number.isFinite(row.bonus_pct) && row.bonus_pct > 0)
    })

    const partners = await step.run('load-transfer-partners', async () => {
      const { data, error } = await db
        .from('transfer_partners')
        .select(`
          id,
          from_program:programs!transfer_partners_from_program_id_fkey(name),
          to_program:programs!transfer_partners_to_program_id_fkey(name)
        `)
        .eq('is_active', true)
      if (error) throw new Error(error.message)
      return (data ?? []) as PartnerRow[]
    })

    const inserted = await step.run('upsert-new-transfer-bonuses', async () => {
      const discovered: Array<{ from: string; to: string; bonus_pct: number; end_date: string }> = []
      for (const bonus of extracted) {
        const partner = partners.find((row) => partnerMatchesBonus(row, bonus))
        if (!partner) continue

        const { data: existing } = await db
          .from('transfer_bonuses')
          .select('id')
          .eq('transfer_partner_id', partner.id)
          .eq('bonus_pct', bonus.bonus_pct)
          .eq('end_date', bonus.end_date)
          .maybeSingle()

        if (existing?.id) continue

        const { error } = await db.from('transfer_bonuses').insert({
          transfer_partner_id: partner.id,
          bonus_pct: bonus.bonus_pct,
          start_date: today,
          end_date: bonus.end_date,
          source_url: SOURCE_URL,
          auto_detected: true,
          verified: false,
          is_verified: false,
          active: true,
          notes: 'Automatically detected by transfer-bonus-monitor',
        })
        if (!error) {
          discovered.push({
            from: readProgramName(partner.from_program),
            to: readProgramName(partner.to_program),
            bonus_pct: bonus.bonus_pct,
            end_date: bonus.end_date,
          })
        }
      }
      return discovered
    })

    await step.run('expire-outdated-transfer-bonuses', async () => {
      await db
        .from('transfer_bonuses')
        .update({ active: false })
        .lt('end_date', today)
        .eq('active', true)
      return { ok: true }
    })

    if (inserted.length > 0) {
      await step.run('email-admin-to-verify-new-bonuses', async () => {
        await maybeSendAdminEmail(inserted)
        return { emailed: true }
      })
    }

    return {
      ok: true,
      extracted: extracted.length,
      inserted: inserted.length,
    }
  },
)
