import type { Metadata } from 'next'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { Suspense } from 'react'
import PricingActions from '@/components/PricingActions'

export const metadata: Metadata = {
  title: 'Pricing — Free Points Calculator',
  description:
    'PointsMax is free forever for calculator + AI advisor. Pro adds live availability, alerts, and priority support.',
  openGraph: {
    title: 'Pricing — Free Points Calculator | PointsMax',
    description:
      'Free forever for calculator, trip builder, and AI advisor. Pro adds live award availability and alerts.',
    url: '/pricing',
  },
  alternates: {
    canonical: '/pricing',
  },
}

const FREE_FEATURES = [
  'Full points calculator',
  'AI advisor concierge',
  '20+ loyalty programs',
  'Award flight search (chart estimates)',
  'Trip Builder',
  'Card Recommender',
  'Inspire Me reverse search',
  'Save balances & preferences',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Real-time award availability (Seats.aero)',
  'Transfer bonus and seat alerts',
  'Priority support',
  'Early access to new features',
]

const FAQ = [
  {
    q: 'Is the calculator really free?',
    a: 'Yes. The full calculator, core award search, and wallet tracking stay free forever.',
  },
  {
    q: 'How much is Pro?',
    a: 'Pro is $9.99/month. It adds live Seats.aero availability plus transfer and seat alerts. The AI advisor, Trip Builder, and calculator remain free.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'Stripe checkout supports major credit cards, Apple Pay, and Google Pay (where available).',
  },
  {
    q: 'How fast does Pro unlock after payment?',
    a: 'Usually within a few seconds after Stripe confirms your checkout session.',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 pm-shell py-14 sm:py-16">
        <div className="text-center mb-14">
          <span className="pm-pill mb-4">Transparent pricing</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-4">
            Simple, honest pricing
          </h1>
          <p className="pm-subtle text-lg max-w-xl mx-auto">
            Free includes calculator, AI advisor, Trip Builder, and card tools. Pro adds live availability and alerts.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-20 max-w-2xl mx-auto">
          <div className="pm-card p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold text-[#5f7c70] mb-2">Free</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-semibold text-[#173f34]">$0</span>
                <span className="text-[#8ca196] text-lg">/month</span>
              </div>
              <p className="text-sm text-[#5f7c70] mt-2">No credit card required</p>
            </div>
            <ul className="space-y-3 mb-8">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="text-sm text-[#335448]">{f}</li>
              ))}
            </ul>
            <Link href="/calculator" className="pm-button w-full text-center">
              Get started free
            </Link>
          </div>

          <div className="rounded-2xl border-2 border-[#0f766e] bg-[#f3fbf8] p-8 shadow-sm">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#0f766e]">Pro</p>
                <span className="text-xs bg-[#e7f6f2] text-[#0f5f57] rounded-full px-2.5 py-0.5 border border-[#b8e3da]">Live</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-semibold text-[#173f34]">$9.99</span>
                <span className="text-[#8ca196] text-lg">/month</span>
              </div>
              <p className="text-sm text-[#5f7c70] mt-2">Cancel anytime</p>
            </div>
            <ul className="space-y-3 mb-8">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="text-sm text-[#335448]">{f}</li>
              ))}
            </ul>
            <Suspense fallback={<button className="pm-button w-full opacity-70 cursor-wait" disabled>Loading…</button>}>
              <PricingActions />
            </Suspense>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="pm-heading text-2xl mb-8 text-center">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <div key={i} className="pm-card p-6">
                <p className="font-semibold text-[#173f34] mb-2">{item.q}</p>
                <p className="text-sm text-[#5f7c70] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
