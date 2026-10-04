import { Resend } from 'resend'
import { inngest } from '../client'
import { loadCatalogHealthReport } from '@/lib/catalog-health-data'

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

    const report = await loadCatalogHealthReport()

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
