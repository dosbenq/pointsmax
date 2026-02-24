'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { REGIONS, type Region } from '@/lib/regions'

type Program = {
  id: string
  name: string
  short_name: string
  slug: string
  type: string
  geography: string
}

// AHA moment data - the value gap that converts users
const VALUE_GAP_DATA: Record<Region, {
  headline: string
  subhead: string
  pointsExample: string
  redemptionOptions: {
    label: string
    value: string
    cpp: string
    highlight?: boolean
  }[]
}> = {
  us: {
    headline: 'Your Chase points are worth 2¢ each — not 1¢ in cash.',
    subhead: 'Most cardholders redeem at face value. PointsMax shows you the 2-4x multipliers hiding in your wallet.',
    pointsExample: '100,000 Chase Ultimate Rewards',
    redemptionOptions: [
      { label: 'Cash back', value: '$1,000', cpp: '1¢/pt' },
      { label: 'Chase travel portal', value: '$1,500', cpp: '1.5¢/pt' },
      { label: 'Lufthansa Business to Europe', value: '$4,200+', cpp: '4.2¢/pt', highlight: true },
    ],
  },
  in: {
    headline: 'Your HDFC Infinia points are worth ₹1 each — not ₹0.33.',
    subhead: 'Most cardholders redeem for statement credit. PointsMax shows you the 3-5x value waiting in transfer partners.',
    pointsExample: '50,000 HDFC Infinia points',
    redemptionOptions: [
      { label: 'Statement credit', value: '₹16,500', cpp: '₹0.33/pt' },
      { label: 'Amazon voucher', value: '₹25,000', cpp: '₹0.50/pt' },
      { label: 'Air India Business to London', value: '₹75,000+', cpp: '₹1.50+/pt', highlight: true },
    ],
  },
}

// Steps are region-conditional
const getSteps = (region: Region) => [
  {
    number: '01',
    title: region === 'in' ? 'Add your HDFC, Axis, and Amex India balances' : 'Add your Chase, Amex, and Citi balances',
    description: region === 'in'
      ? 'Import what you actually have — from HDFC Millennia to Air India Maharaja Club. We support 20+ programs across Indian banks, airlines, and hotels.'
      : 'Import what you actually have — from Chase Ultimate Rewards to Marriott Bonvoy. We support 20+ programs across transferable currencies, airlines, and hotels.',
    detail: 'Signed-in users can save their balances for instant access on future visits.',
  },
  {
    number: '02',
    title: 'See ranked redemptions with current valuations',
    description: 'Our engine evaluates every possible redemption path for your wallet — including transfer partners — and ranks them by total value using current CPP (cents/paise per point) valuations.',
    detail: region === 'in'
      ? 'Valuations are sourced from CardExpert, Technofino, and our India editorial team — updated monthly.'
      : 'Valuations are sourced from The Points Guy and updated monthly.',
  },
  {
    number: '03',
    title: region === 'in' ? 'Book with AI guidance — Mumbai to Dubai, Delhi to London' : 'Book with AI guidance',
    description: "Tell our AI advisor where you want to go and when. It builds a complete, step-by-step booking plan tailored to your specific balances — including which cards to transfer from and how.",
    detail: 'Powered by Google Gemini with fair-use request limits.',
  },
]

// FAQ is region-conditional
const getFAQ = (region: Region) => region === 'in' ? [
  {
    q: 'How are Indian credit card points valued?',
    a: 'We value points based on real redemption options. HDFC points transfer to Air India at 1:1, giving you ~₹1/mile value on business class awards. Statement credit gets you only ₹0.33. PointsMax shows you the difference.',
  },
  {
    q: 'Can I transfer HDFC points to Air India?',
    a: 'Yes. HDFC Infinia, Regalia, and other premium cards allow transfers to Air India Maharaja Club and other partners. Transfer ratios vary by card tier. PointsMax calculates the exact value before you commit.',
  },
  {
    q: 'Is this different from CardExpert or Technofino?',
    a: "CardExpert and Technofino are excellent editorial resources. PointsMax is a calculation tool — we take their valuation research and apply it to YOUR specific balances, then rank every option automatically. Think of us as the calculator to their textbook.",
  },
  {
    q: 'Is PointsMax really free?',
    a: 'Yes. The points calculator, all programs, award flight search, and the AI advisor are free to use. No credit card and no trial period.',
  },
  {
    q: 'How does the AI advisor work?',
    a: "The AI advisor is powered by Google Gemini. It receives your points balances, top redemption options, and travel preferences, then generates personalized booking plans in a structured format — including specific airlines, routes, points needed, and step-by-step booking instructions.",
  },
] : [
  {
    q: 'How are CPP values calculated?',
    a: 'We use The Points Guy (TPG) valuations, updated monthly. CPP (cents per point) reflects the real-world value you can realistically achieve on aspirational redemptions like business class flights and luxury hotels — not cash-back rates.',
  },
  {
    q: 'Is PointsMax really free?',
    a: 'Yes. The points calculator, all 20+ programs, award flight search, and the AI advisor are free to use. No credit card and no trial period.',
  },
  {
    q: 'How does the AI advisor work?',
    a: "The AI advisor is powered by Google Gemini. It receives your points balances, top redemption options, and travel preferences, then generates personalized booking plans in a structured format — including specific airlines, routes, points needed, and step-by-step booking instructions. Fair-use request limits apply.",
  },
  {
    q: 'What is an award chart?',
    a: "An award chart is a table published by an airline or hotel program that shows how many points are required to book a reward. Some programs use dynamic pricing instead of fixed award charts. PointsMax uses chart-based estimates where applicable and live data from Seats.aero for real availability.",
  },
  {
    q: 'When will Pro launch?',
    a: "We're rolling out Pro in phases. Join the waitlist to get launch updates, early access, and pricing details.",
  },
]

export default function HowItWorksPage() {
  const params = useParams()
  const region = (params.region as Region) || 'us'

  // All hooks must be called unconditionally before any early return
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)

  const validRegion = !!REGIONS[region] && !!VALUE_GAP_DATA[region]

  // Fetch programs dynamically from API
  useEffect(() => {
    if (!validRegion) return
    fetch(`/api/programs?region=${region.toUpperCase()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPrograms(data)
        }
      })
      .catch(() => setPrograms([]))
      .finally(() => setProgramsLoading(false))
  }, [region])

  // Guard against invalid regions — after all hooks
  if (!validRegion) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 pm-shell py-20 text-center">
          <h1 className="pm-heading text-2xl mb-4">Page not found</h1>
          <Link href="/us/how-it-works" className="pm-button">
            Go to US version
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  const config = REGIONS[region]
  const valueGap = VALUE_GAP_DATA[region]
  const steps = getSteps(region)
  const faq = getFAQ(region)

  // Group programs by type
  const programsByType = programs.reduce((acc, p) => {
    const type = p.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    if (!acc[type]) acc[type] = []
    acc[type].push(p)
    return acc
  }, {} as Record<string, Program[]>)

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      {/* Hero Section - The AHA Moment */}
      <section className="border-b border-pm-border bg-pm-bg/50 py-16 sm:py-20">
        <div className="pm-shell">
          <div className="max-w-4xl mx-auto text-center">
            <span className="pm-pill mb-6">The value gap no one talks about</span>
            <h1 className="pm-heading text-4xl sm:text-5xl lg:text-6xl mb-6 leading-tight">
              {valueGap.headline}
            </h1>
            <p className="text-lg sm:text-xl text-pm-ink-500 max-w-2xl mx-auto mb-12">
              {valueGap.subhead}
            </p>

            {/* The Math Section */}
            <div className="pm-card-soft p-6 sm:p-8 max-w-2xl mx-auto text-left">
              <p className="pm-label mb-4">{valueGap.pointsExample}</p>
              <div className="space-y-3">
                {valueGap.redemptionOptions.map((opt, i) => (
                  <div 
                    key={i}
                    className={`flex items-center justify-between p-4 rounded-xl ${
                      opt.highlight 
                        ? 'bg-pm-accent-soft/30 border border-pm-accent-soft' 
                        : 'bg-pm-surface-soft border border-pm-border'
                    }`}
                  >
                    <div>
                      <p className={`text-sm ${opt.highlight ? 'font-semibold text-pm-accent-strong' : 'text-pm-ink-500'}`}>
                        {opt.label}
                      </p>
                      {opt.highlight && (
                        <p className="text-xs text-pm-accent mt-0.5">← PointsMax shows you this</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${opt.highlight ? 'text-pm-accent' : 'text-pm-ink-900'}`}>
                        {opt.value}
                      </p>
                      <p className="text-xs text-pm-ink-500">{opt.cpp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <Link
                href={`/${region}/calculator`}
                className="pm-button inline-flex"
              >
                Calculate my {region === 'in' ? 'HDFC/Axis/Amex' : 'Chase/Amex/Citi'} points value →
              </Link>
              <p className="text-sm text-pm-ink-500 mt-3">No signup required • Takes 30 seconds</p>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 pm-shell py-14 sm:py-16 space-y-16 sm:space-y-20">
        {/* How It Works Steps */}
        <section>
          <div className="text-center mb-12">
            <span className="pm-pill mb-4">How it works</span>
            <h2 className="pm-heading text-3xl sm:text-4xl">Three steps to your best redemption</h2>
          </div>
          
          <div className="space-y-12">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className={`flex flex-col sm:flex-row gap-8 items-start ${i % 2 === 1 ? 'sm:flex-row-reverse' : ''}`}
              >
                <div className="sm:w-1/3 flex-shrink-0">
                  <div className="pm-card-soft p-8 text-center">
                    <p className="text-6xl font-semibold text-pm-border leading-none">{step.number}</p>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="pm-heading text-2xl mb-3">{step.title}</h3>
                  <p className="text-pm-ink-700 leading-relaxed mb-3">{step.description}</p>
                  <p className="text-sm text-pm-ink-500">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Programs We Cover - Dynamic from DB */}
        <section>
          <h2 className="pm-heading text-2xl mb-2">
            {region === 'in' ? 'Indian programs we cover' : 'Programs we cover'}
          </h2>
          <p className="pm-subtle mb-6">
            {programsLoading 
              ? 'Loading programs...' 
              : `${programs.length}+ loyalty programs across ${region === 'in' ? 'Indian banks' : 'transferable points'}, airline miles, and hotel rewards.`
            }
          </p>
          
          {programsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-pm-surface-soft rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(programsByType).map(([type, typePrograms]) => (
                <div key={type}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-pm-ink-500 mb-3">{type}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {typePrograms.map((p) => (
                      <Link
                        key={p.id}
                        href={`/${region}/programs/${p.slug}`}
                        className="pm-card px-4 py-3 flex items-center justify-between hover:shadow-md transition-shadow"
                      >
                        <span className="text-sm font-medium text-pm-ink-900">{p.name}</span>
                        <span className="text-xs text-pm-ink-500 flex-shrink-0 ml-3">View →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FAQ */}
        <section>
          <h2 className="pm-heading text-2xl mb-8">
            {region === 'in' ? 'Frequently asked questions (India)' : 'Frequently asked questions'}
          </h2>
          <div className="space-y-3">
            {faq.map((item, i) => (
              <div key={i} className="pm-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-pm-surface-soft transition-colors"
                >
                  <span className="font-semibold text-pm-ink-900 text-sm pr-4">{item.q}</span>
                  <span className="text-pm-ink-500 text-xs flex-shrink-0">{openFaq === i ? '▲' : '▼'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 border-t border-pm-border">
                    <p className="text-sm text-pm-ink-500 leading-relaxed pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pm-card-soft p-8 sm:p-10 text-center">
          <h2 className="pm-heading text-2xl mb-2">Ready to see what you&apos;re missing?</h2>
          <p className="pm-subtle mb-6">
            {region === 'in' 
              ? 'Enter your HDFC, Axis, or Amex balance and see the value gap in 30 seconds.'
              : 'Enter your points balances and see the value gap in 30 seconds.'
            }
          </p>
          <Link href={`/${region}/calculator`} className="pm-button">
            {region === 'in' ? 'Calculate my points value →' : 'Calculate my points value →'}
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  )
}
