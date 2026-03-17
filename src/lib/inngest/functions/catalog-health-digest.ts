import { Resend } from 'resend'
import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase'
import { buildCatalogHealthReport } from '@/lib/catalog-health'

export const catalogHealthDigest = inngest.createFunction(
  { id: 'catalog-health-digest', name: 'Agent: Catalog Health Digest' },
  { cron: '0 12 * * 1' },
  async ({ step }) => {
    const resendKey = process.env.RESEND_API_KEY?.trim()
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()
    const adminEmail = process.env.ADMIN_EMAIL?.trim()
    if (!resendKey || !fromEmail || !adminEmail) {
      return { ok: false, skipped: true, reason: 'email_not_configured' }
    }

    const db = createAdminClient()
    const [cardsRes, ratesRes] = await Promise.all([
      db.from('cards').select('*').eq('is_active', true),
      db.from('card_earning_rates').select('card_id, earn_multiplier'),
    ])

    if (cardsRes.error || ratesRes.error) {
      throw new Error(cardsRes.error?.message ?? ratesRes.error?.message ?? 'Failed to load catalog health')
    }

    const report = buildCatalogHealthReport(
      (cardsRes.data ?? []) as Record<string, unknown>[],
      ((ratesRes.data ?? []) as Array<{ card_id: string; earn_multiplier: number | string | null }>),
    )

    const resend = new Resend(resendKey)
    await step.run('send-admin-catalog-health-email', async () => {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: 'PointsMax weekly catalog health summary',
        html: `
          <h2>Catalog health summary</h2>
          <ul>
            <li>Missing apply URLs: ${report.missing_apply_url.length}</li>
            <li>Missing image URLs: ${report.missing_image_url.length}</li>
            <li>Suspicious signup bonuses: ${report.suspicious_signup_bonus.length}</li>
            <li>Weak earning rates: ${report.weak_earning_rates.length}</li>
            <li>Stale cards: ${report.stale_cards.length}</li>
          </ul>
        `,
      })
      return { emailed: true }
    })

    return { ok: true }
  },
)
