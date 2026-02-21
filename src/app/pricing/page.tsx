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
  'AI advisor access (fair-use limits)',
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
    a: "We're rolling out Pro in phases. Join the waitlist to get launch updates, early access, and pricing details.",
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
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 pm-shell py-14 sm:py-16">
        <div className="text-center mb-14">
          <span className="pm-pill mb-4">Transparent pricing</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-4">
            Simple, honest pricing
          </h1>
          <p className="pm-subtle text-lg max-w-xl mx-auto">
            The core tool is free forever. Pro adds power features for frequent travelers.
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
                <span className="text-xs bg-[#e7f6f2] text-[#0f5f57] rounded-full px-2.5 py-0.5 border border-[#b8e3da]">Waitlist open</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-semibold text-[#173f34]">$9</span>
                <span className="text-[#8ca196] text-lg">/month</span>
              </div>
              <p className="text-sm text-[#5f7c70] mt-2">Early-bird pricing for waitlist members</p>
            </div>
            <ul className="space-y-3 mb-8">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="text-sm text-[#335448]">{f}</li>
              ))}
            </ul>
            <a
              href="mailto:hello@pointsmax.com?subject=Pro waitlist"
              className="pm-button w-full text-center"
            >
              Join waitlist
            </a>
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
