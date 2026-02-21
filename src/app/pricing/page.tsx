import type { Metadata } from 'next'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — Free Points Calculator',
  description:
    'PointsMax is free forever for the full points calculator, 20+ programs, and award flight search. Pro adds unlimited AI, live availability, and price alerts.',
  openGraph: {
    title: 'Pricing — Free Points Calculator | PointsMax',
    description:
      'Free forever for the core tool. Pro adds unlimited AI advisor, live award availability, and price alerts.',
    url: '/pricing',
  },
  alternates: {
    canonical: '/pricing',
  },
}

const FREE_FEATURES = [
  'Full points calculator',
  '20+ loyalty programs',
  '3 AI advisor messages per session',
  'Award flight search (chart estimates)',
  'Save balances & preferences',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited AI advisor conversations',
  'Real-time award availability (Seats.aero)',
  'Price alerts for award seats',
  'Priority email support',
]

const FAQ = [
  {
    q: 'Is the calculator really free?',
    a: 'Yes — the full points calculator, all 20+ programs, and award flight search are free forever. No credit card required.',
  },
  {
    q: 'When will Pro launch?',
    a: "We're actively building Pro features. Join the waitlist to get early access and a discounted launch price.",
  },
  {
    q: 'What payment methods will you accept?',
    a: 'Pro will be processed via Stripe — credit card, Apple Pay, and Google Pay.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, Pro will be month-to-month with no contracts. Cancel with a single click.',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <NavBar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 w-full">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-semibold text-slate-900 tracking-tight mb-4">
            Simple, honest pricing
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            The core tool is free forever. Pro adds power features for frequent travelers.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid sm:grid-cols-2 gap-6 mb-20 max-w-2xl mx-auto">
          {/* Free */}
          <div className="border border-slate-200 rounded-2xl p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold text-slate-500 mb-2">Free</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-semibold text-slate-900">$0</span>
                <span className="text-slate-400 text-lg">/month</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">No credit card required</p>
            </div>
            <ul className="space-y-3 mb-8">
              {FREE_FEATURES.map(f => (
                <li key={f} className="text-sm text-slate-600">{f}</li>
              ))}
            </ul>
            <Link
              href="/calculator"
              className="block text-center bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-4 py-3 rounded-full transition-colors"
            >
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="border-2 border-slate-900 rounded-2xl p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-indigo-600">Pro</p>
                <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2.5 py-0.5">Coming soon</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-semibold text-slate-900">$9</span>
                <span className="text-slate-400 text-lg">/month</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">Early bird pricing · Launch TBD</p>
            </div>
            <ul className="space-y-3 mb-8">
              {PRO_FEATURES.map(f => (
                <li key={f} className="text-sm text-slate-600">{f}</li>
              ))}
            </ul>
            <a
              href="mailto:hello@pointsmax.app?subject=Pro waitlist"
              className="block text-center bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-4 py-3 rounded-full transition-colors"
            >
              Join waitlist
            </a>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-slate-900 mb-8 text-center">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-6">
                <p className="font-semibold text-slate-900 mb-2">{item.q}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
