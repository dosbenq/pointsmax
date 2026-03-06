import type { Metadata } from 'next'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy | PointsMax',
  description: 'How PointsMax collects, uses, and protects your data.',
  alternates: { canonical: '/privacy' },
}

const LAST_UPDATED = 'February 21, 2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <span className="pm-pill mb-4 inline-block">Legal</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-3">Privacy Policy</h1>
          <p className="pm-subtle max-w-xl text-base">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>
      <main className="pm-shell py-8 w-full flex-1">
        <div className="max-w-3xl mx-auto space-y-8">

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">What We Collect</h2>
            <p className="text-sm text-pm-ink-700">
              We collect the information needed to run PointsMax, including account email, saved point balances,
              preferences, and product interaction analytics. Payment details are handled directly by Stripe.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">How We Use Data</h2>
            <p className="text-sm text-pm-ink-700">
              We use data to deliver calculator results, trip recommendations, transfer alerts, fraud/rate-limit protection,
              and product performance improvements.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">Service Providers</h2>
            <p className="text-sm text-pm-ink-700">
              PointsMax uses Supabase for data storage/authentication, Resend for email delivery, Stripe for billing,
              and Seats.aero data when live award availability is enabled.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">Affiliate Disclosure</h2>
            <p className="text-sm text-pm-ink-700">
              We may earn commissions when you apply for cards through links on PointsMax. This does not change our ranking logic,
              which is based on your spending profile and projected value.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">Contact</h2>
            <p className="text-sm text-pm-ink-700">
              For privacy requests, contact: <a className="text-pm-accent hover:underline" href="mailto:hello@pointsmax.com">hello@pointsmax.com</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}

