import type { Metadata } from 'next'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'

type Props = {
  params: Promise<{ region: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params
  return {
    title: 'Privacy Policy | PointsMax',
    description: 'How PointsMax collects, uses, and protects your data.',
    alternates: { canonical: `/${region}/privacy` },
  }
}

const LAST_UPDATED = 'November 28, 2026'

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
              We use data to show which airline programs your points can reach, keep your saved wallet, send the alerts
              you sign up for, protect the service against fraud and abuse, and improve the product.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">Service Providers</h2>
            <p className="text-sm text-pm-ink-700">
              PointsMax uses Neon for data storage, Google for sign-in, Vercel for hosting, PostHog for product
              analytics, Resend for email delivery and Stripe for billing, and Sentry for error reports when it is enabled.
            </p>
          </section>

          <section className="pm-card p-6 space-y-3">
            <h2 className="pm-heading text-lg">Affiliate Disclosure</h2>
            <p className="text-sm text-pm-ink-700">
              PointsMax does not use affiliate links today. Links to airline websites are plain links. If that changes,
              we will say so here and next to the link.
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

