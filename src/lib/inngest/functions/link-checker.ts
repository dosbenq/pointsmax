import crypto from 'node:crypto'
import { Resend } from 'resend'
import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase'

type CardLinkRow = {
  id: string
  name: string
  apply_url: string | null
}

type LinkCheckResult = {
  card_id: string
  card_name: string
  url: string
  status_code: number | null
  ok: boolean
}

async function checkUrl(url: string): Promise<{ statusCode: number | null; ok: boolean }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
    })

    if (head.status >= 400 || head.status === 405) {
      const get = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        cache: 'no-store',
      })
      return { statusCode: get.status, ok: get.status < 400 }
    }

    return { statusCode: head.status, ok: head.status < 400 }
  } catch {
    return { statusCode: null, ok: false }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendBrokenLinkAlertEmail(results: LinkCheckResult[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()
  const toEmail = process.env.ADMIN_EMAIL?.trim()
  if (!apiKey || !fromEmail || !toEmail || results.length === 0) return

  const resend = new Resend(apiKey)
  const rows = results
    .slice(0, 20)
    .map((item) => `<li><strong>${item.card_name}</strong> (${item.status_code ?? 'timeout'})<br/><a href="${item.url}">${item.url}</a></li>`)
    .join('')

  await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `PointsMax link health: ${results.length} broken affiliate URLs`,
    html: `
      <h2>Affiliate link health check</h2>
      <p>${results.length} card apply links failed health checks.</p>
      <ol>${rows}</ol>
      <p>Review in Admin → Link Health.</p>
    `,
  })
}

export const linkChecker = inngest.createFunction(
  { id: 'affiliate-link-checker', name: 'Agent: Affiliate Link Checker' },
  { cron: '0 14 * * 1' },
  async ({ step }) => {
    const db = createAdminClient()
    const runId = crypto.randomUUID()

    const cards = await step.run('load-cards-with-affiliate-links', async () => {
      const { data, error } = await db
        .from('cards')
        .select('id, name, apply_url')
        .eq('is_active', true)
        .not('apply_url', 'is', null)
      if (error) throw new Error(error.message)
      return (data ?? []) as CardLinkRow[]
    })

    const results = await step.run('check-affiliate-links', async () => {
      const checked: LinkCheckResult[] = []
      for (const card of cards) {
        const url = card.apply_url?.trim()
        if (!url) continue
        const status = await checkUrl(url)
        checked.push({
          card_id: card.id,
          card_name: card.name,
          url,
          status_code: status.statusCode,
          ok: status.ok,
        })
      }
      return checked
    })

    await step.run('persist-link-health-results', async () => {
      if (results.length === 0) return { inserted: 0 }
      const rows = results.map((item) => ({
        run_id: runId,
        card_id: item.card_id,
        url: item.url,
        status_code: item.status_code,
        ok: item.ok,
      }))
      const { error } = await db.from('link_health_log').insert(rows)
      if (error) throw new Error(error.message)
      return { inserted: rows.length }
    })

    const broken = results.filter((item) => !item.ok)
    if (broken.length >= 5) {
      await step.run('email-admin-broken-links', async () => {
        await sendBrokenLinkAlertEmail(broken)
        return { emailed: true }
      })
    }

    return {
      ok: true,
      run_id: runId,
      checked: results.length,
      broken: broken.length,
    }
  },
)
