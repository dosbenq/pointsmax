import type { Metadata } from 'next'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Terms of Service | PointsMax',
  description: 'Terms for using the PointsMax website and tools.',
  alternates: { canonical: '/terms' },
}

const LAST_UPDATED = 'February 21, 2026'

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <span className="pm-pill mb-4 inline-block">Legal</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-3">Terms of Service</h1>
          <p className="pm-subtle max-w-xl text-base">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>
      <main className="pm-shell py-8 w-full flex-1">
        <div className="max-w-3xl mx-auto space-y-8">

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">Use of Service</h2>
            <p className="text-sm text-pm-ink-700">
              PointsMax provides informational tools for travel rewards planning. You are responsible for your financial
              and booking decisions, including transfer and redemption actions.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">No Financial Advice</h2>
            <p className="text-sm text-pm-ink-700">
              Content and recommendations are educational and do not constitute legal, tax, financial, or investment advice.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">Accounts and Billing</h2>
            <p className="text-sm text-pm-ink-700">
              Paid subscriptions are billed by Stripe under their payment terms. You may cancel through the billing portal at any time.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">Affiliate Relationships</h2>
            <p className="text-sm text-pm-ink-700">
              Some outbound links are affiliate links. PointsMax may earn a commission if you apply or purchase through those links.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">Contact</h2>
            <p className="text-sm text-pm-ink-700">
              For support or legal inquiries, email: <a className="text-pm-accent hover:underline" href="mailto:hello@pointsmax.com">hello@pointsmax.com</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}

