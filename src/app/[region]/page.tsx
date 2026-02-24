'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
import { trackEvent } from '@/lib/analytics'
import { REGIONS, type Region } from '@/lib/regions'

const PROOF_STRIP = [
  '20+ loyalty programs covered',
  'Wallet-aware ranking engine',
  'Transfer + timing visibility',
  'Step-by-step booking guidance',
]

const PROCESS = [
  {
    title: 'Add your balances',
    body: 'Import what you actually have in one place, from transferable currencies to hotel points.',
  },
  {
    title: 'Pick your travel goal',
    body: 'Set route, dates, and cabin so recommendations match your real decision.',
  },
  {
    title: 'Act on one best path',
    body: 'Get the top option, backup routes, and clear next actions to book confidently.',
  },
]

type SiteStats = {
  users: number
  pointsOptimized: number
  trackedPoints: number
  valueUsd?: number
  valueInr?: number
}

type Program = {
  id: string
  name: string
  short_name: string
  slug: string
  cpp_cents?: number
}

// X1: Hero copy variations by region - focused on value gap
const HERO_COPY: Record<Region, {
  headline: string
  subhead: string
  trustSignal: string
}> = {
  us: {
    headline: 'Stop leaving money on the table with your points.',
    subhead: 'PointsMax finds the redemption that gets you 3–5× more value than cash back — across all your cards.',
    trustSignal: 'Free · No signup required · Takes 30 seconds',
  },
  in: {
    headline: 'Your credit card points are worth more than you think.',
    subhead: 'PointsMax calculates the real value of your points and shows you the highest-value redemption — before you transfer.',
    trustSignal: 'Free · No signup required · Takes 30 seconds',
  },
}

// Outcome examples for the visual
const OUTCOMES_US = [
  {
    id: 'tokyo',
    label: 'Business class to Tokyo',
    cash: '$1,050',
    best: '$2,940',
    lift: '+180%',
    detail: 'Transfer path: Chase → Flying Blue, then book direct partner award space.',
  },
  {
    id: 'hawaii',
    label: 'Family trip to Hawaii',
    cash: '$920',
    best: '$2,140',
    lift: '+133%',
    detail: 'Mixed strategy: part transfer partner, part hotel points for highest blended value.',
  },
  {
    id: 'europe',
    label: 'Summer Europe itinerary',
    cash: '$1,280',
    best: '$3,260',
    lift: '+155%',
    detail: 'Used airline miles outbound and hotel redemptions in high-demand dates.',
  },
]

const OUTCOMES_IN = [
  {
    id: 'london',
    label: 'Business class to London',
    cash: '₹85,000',
    best: '₹2,10,000',
    lift: '+147%',
    detail: 'Transfer path: Axis Atlas → Accor, then book with points for fixed value.',
  },
  {
    id: 'maldives',
    label: 'Luxury trip to Maldives',
    cash: '₹62,000',
    best: '₹1,45,000',
    lift: '+133%',
    detail: 'HDFC Infinia → Marriott Bonvoy transfer with 30% bonus applied.',
  },
  {
    id: 'dubai',
    label: 'Weekend in Dubai',
    cash: '₹35,000',
    best: '₹78,000',
    lift: '+122%',
    detail: 'Used Amex India MR points for Taj InnerCircle redemptions.',
  },
]

// X2: Quick value widget - programs and their CPP values
// K1: Region-specific fallbacks - must never mix US/India programs
const WIDGET_PROGRAMS_US = [
  { slug: 'chase-ur', name: 'Chase Ultimate Rewards', cpp: 2.0 },
  { slug: 'amex-mr', name: 'Amex Membership Rewards', cpp: 2.0 },
  { slug: 'capital-one', name: 'Capital One Miles', cpp: 1.8 },
  { slug: 'citi-thankyou', name: 'Citi ThankYou Points', cpp: 1.8 },
  { slug: 'bilt', name: 'Bilt Rewards', cpp: 1.8 },
  { slug: 'united', name: 'United MileagePlus', cpp: 1.2 },
  { slug: 'delta', name: 'Delta SkyMiles', cpp: 1.0 },
  { slug: 'american', name: 'American AAdvantage', cpp: 1.3 },
]

const WIDGET_PROGRAMS_IN = [
  { slug: 'hdfc-millennia', name: 'HDFC Millennia', cpp: 50 }, // paise
  { slug: 'axis-edge', name: 'Axis EDGE Rewards', cpp: 50 },
  { slug: 'amex-india-mr', name: 'Amex India MR', cpp: 75 },
  { slug: 'air-india', name: 'Air India Maharaja Club', cpp: 100 },
  { slug: 'indigo-6e', name: 'IndiGo 6E Rewards', cpp: 100 },
  { slug: 'taj-innercircle', name: 'Taj InnerCircle', cpp: 100 },
]

export default function LandingPage() {
  const params = useParams()
  const region = (params.region as Region) || 'us'
  const config = REGIONS[region] ?? REGIONS.us
  const { user, signInWithGoogle } = useAuth()
  
  const outcomes = region === 'in' ? OUTCOMES_IN : OUTCOMES_US
  const [activeOutcome, setActiveOutcome] = useState(outcomes[0])
  const [stats, setStats] = useState<SiteStats | null>(null)
  
  // X2: Quick value widget state
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [pointInput, setPointInput] = useState<string>('')
  const widgetPrograms = region === 'in' ? WIDGET_PROGRAMS_IN : WIDGET_PROGRAMS_US
  const effectiveSelectedProgram = useMemo(() => {
    const options = programs.length > 0
      ? programs.slice(0, 8).map((p) => p.slug)
      : widgetPrograms.map((p) => p.slug)
    if (options.includes(selectedProgram)) return selectedProgram
    return options[0] ?? ''
  }, [programs, selectedProgram, widgetPrograms])

  // Hero copy for this region
  const heroCopy = HERO_COPY[region]

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.users === 'number') {
          setStats(data as SiteStats)
        }
      })
      .catch(() => {})
  }, [])

  // Fetch programs for quick value widget
  useEffect(() => {
    fetch(`/api/programs?region=${region.toUpperCase()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPrograms(data)
          setSelectedProgram((prev) => {
            if (data.length === 0) return prev
            if (data.some((p: Program) => p.slug === prev)) return prev
            return data[0].slug
          })
        }
      })
      .catch(() => {})
  }, [region])

  const statsLabel = useMemo(() => {
    if (!stats) return null
    const users = stats.users.toLocaleString()
    if (region === 'in') {
      const crore = (stats.valueInr || 0) / 10000000
      return `${users} travelers · ₹${crore.toFixed(1)} crore optimized`
    }
    return `${users} travelers · $${(stats.valueUsd || 0).toLocaleString()} optimized`
  }, [stats, region])

  // X2: Calculate quick value
  const quickValue = useMemo(() => {
    const points = parseInt(pointInput.replace(/[^\d]/g, ''), 10)
    if (!points || !effectiveSelectedProgram) return null

    const fallbackProgram = widgetPrograms.find((p) => p.slug === effectiveSelectedProgram)
    const apiProgram = programs.find((p) => p.slug === effectiveSelectedProgram)
    const cppValue = fallbackProgram?.cpp ?? apiProgram?.cpp_cents ?? null

    if (cppValue === null) return null
    
    if (region === 'in') {
      // CPP is in paise for India
      const inrValue = (points * cppValue) / 100
      return `₹${Math.round(inrValue).toLocaleString()}`
    } else {
      // CPP is in cents for US
      const usdValue = (points * cppValue) / 100
      return `$${Math.round(usdValue).toLocaleString()}`
    }
  }, [pointInput, effectiveSelectedProgram, programs, widgetPrograms, region])

  const entryPaths = [
    {
      href: region === 'in'
        ? `/${region}/award-search?origin=DEL&destination=LHR`
        : `/${region}/award-search?origin=JFK&destination=LHR`,
      title: 'Quick Award Check',
      body: 'Know your route? Search flights and transfer paths directly.',
      badge: 'Fastest',
    },
    {
      href: `/${region}/inspire`,
      title: 'Inspire Me',
      body: 'Start with your wallet and discover where your points can take you.',
      badge: 'Most loved',
    },
    {
      href: `/${region}/trip-builder`,
      title: 'Full Trip Plan',
      body: 'Get flights, hotel, and booking steps in one workflow.',
      badge: 'Complete',
    },
  ]

  const featuredCards = region === 'in'
    ? ['HDFC Infinia', 'Axis Atlas', 'Amex Platinum India']
    : ['Chase Sapphire Preferred', 'Amex Gold', 'Capital One Venture X']

  const handleStart = () => {
    trackEvent('landing_cta_clicked', { location: 'hero', authenticated: Boolean(user), region })
    const el = document.getElementById('quick-value-widget')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1">
        {/* Hero Section with X1 copy and X2 quick value widget */}
        <section className="pt-16 pb-12 sm:pt-22 sm:pb-14">
          <div className="pm-shell">
            <div className="grid gap-10 lg:grid-cols-12 items-end">
              {/* Left: Copy */}
              <div className="lg:col-span-7 space-y-6">
                <span className="pm-pill">Points decisions made simple {config.flag}</span>
                
                {/* X1: New hero headline focused on value gap */}
                <h1 className="pm-heading text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
                  {heroCopy.headline}
                </h1>
                <p className="pm-subtle text-base sm:text-lg max-w-xl leading-relaxed">
                  {heroCopy.subhead}
                </p>
                
                {statsLabel && (
                  <p className="text-sm text-pm-accent font-semibold">{statsLabel}</p>
                )}
                
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={handleStart} className="pm-button">
                    Check my points value
                  </button>
                  <Link
                    href={`/${region}/how-it-works`}
                    className="text-sm font-semibold text-pm-accent hover:text-pm-accent-strong"
                    onClick={() => trackEvent('landing_secondary_cta_clicked', { location: 'hero', target: 'how_it_works', region })}
                  >
                    See how it works
                  </Link>
                </div>
                
                {/* X1: Trust signal below CTA */}
                <p className="text-sm text-pm-ink-500">{heroCopy.trustSignal}</p>
              </div>

              {/* Right: X2 Quick Value Widget */}
              <div className="lg:col-span-5">
                <div id="quick-value-widget" className="pm-card-soft p-6 sm:p-7">
                  <p className="pm-label mb-2">Quick value check</p>
                  <h2 className="pm-heading text-xl mb-4">What are your points worth?</h2>
                  
                  <div className="space-y-4">
                    {/* Program selector */}
                    <div>
                      <label className="pm-label block mb-1.5">I have</label>
                      <select
                        value={effectiveSelectedProgram}
                        onChange={(e) => setSelectedProgram(e.target.value)}
                        className="pm-input"
                      >
                        {programs.length > 0 ? (
                          programs.slice(0, 8).map((p) => (
                            <option key={p.id} value={p.slug}>{p.name}</option>
                          ))
                        ) : (
                          widgetPrograms.map((p) => (
                            <option key={p.slug} value={p.slug}>{p.name}</option>
                          ))
                        )}
                      </select>
                    </div>
                    
                    {/* Points input */}
                    <div>
                      <label className="pm-label block mb-1.5">Points balance</label>
                      <input
                        type="text"
                        placeholder={region === 'in' ? '50000' : '100000'}
                        value={pointInput}
                        onChange={(e) => setPointInput(e.target.value)}
                        className="pm-input"
                      />
                    </div>
                    
                    {/* Result */}
                    <div className="pm-card p-4 bg-pm-accent-soft/20 border-pm-accent-soft">
                      <p className="text-xs text-pm-accent-strong mb-1">Best value potential</p>
                      <p className="text-2xl font-bold text-pm-accent">
                        {quickValue || (region === 'in' ? '₹—' : '$—')}
                      </p>
                    </div>
                    
                    {/* CTA to full calculator */}
                    <Link
                      href={`/${region}/calculator`}
                      className="block text-center text-sm font-semibold text-pm-accent hover:text-pm-accent-strong"
                      onClick={() => trackEvent('landing_widget_cta_clicked', { region })}
                    >
                      See full breakdown →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Proof strip */}
        <section className="border-y border-pm-border bg-pm-bg/50">
          <div className="pm-shell py-5">
            <div className="flex flex-wrap gap-2">
              {PROOF_STRIP.map((item) => (
                <span key={item} className="pm-pill text-[11px]">
                  {item}
                </span>
              ))}
              {featuredCards.map((card) => (
                <span key={card} className="pm-pill text-[11px] border-pm-accent-soft bg-pm-accent-soft/50 text-pm-accent-strong">
                  Featured: {card}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Entry paths */}
        <section className="py-10 sm:py-12">
          <div className="pm-shell">
            <p className="pm-label mb-2">Choose your path</p>
            <h2 className="pm-heading text-2xl sm:text-3xl mb-6">Start from exactly where you are</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {entryPaths.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="pm-card-soft p-5 hover:shadow-md transition-shadow"
                  onClick={() => trackEvent('landing_entry_path_clicked', { path: item.href, region })}
                >
                  <span className="pm-pill text-[11px] mb-3">{item.badge}</span>
                  <h3 className="pm-heading text-lg mb-1.5">{item.title}</h3>
                  <p className="pm-subtle text-sm">{item.body}</p>
                  <p className="text-sm font-semibold text-pm-accent mt-4">Open →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Outcomes section */}
        <section className="py-14 sm:py-16">
          <div className="pm-shell grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="pm-label mb-2">Illustrative scenarios</p>
              <h2 className="pm-heading text-2xl sm:text-3xl">See outcomes by travel goal</h2>
              <p className="pm-subtle text-sm mt-2">Switch sample scenarios to see how recommendations can change by trip type.</p>
            </div>

            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap gap-2">
                {outcomes.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveOutcome(item)
                      trackEvent('landing_outcome_scenario_selected', { scenario: item.id, region })
                    }}
                    className={`px-3 py-2 rounded-full text-sm font-semibold border transition-colors ${
                      activeOutcome.id === item.id
                        ? 'bg-pm-accent text-white border-pm-accent'
                        : 'bg-pm-surface text-pm-ink-700 border-pm-border hover:border-pm-accent-soft'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pm-card-soft p-5 sm:p-6">
                <p className="text-sm text-pm-ink-900">{activeOutcome.detail}</p>
                <div className="grid sm:grid-cols-3 gap-3 mt-4">
                  <div className="pm-card p-4">
                    <p className="text-xs text-pm-ink-500">Cash path</p>
                    <p className="text-lg font-bold text-pm-ink-700 mt-1">{activeOutcome.cash}</p>
                  </div>
                  <div className="pm-card p-4 border-pm-accent-soft bg-pm-accent-soft/30">
                    <p className="text-xs text-pm-accent-strong">Best path</p>
                    <p className="text-lg font-bold text-pm-accent mt-1">{activeOutcome.best}</p>
                  </div>
                  <div className="pm-card p-4 border-pm-success/30 bg-pm-success/10">
                    <p className="text-xs text-pm-success">Lift</p>
                    <p className="text-lg font-bold text-pm-success mt-1">{activeOutcome.lift}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-14 sm:py-16 border-y border-pm-border bg-pm-bg/45">
          <div className="pm-shell">
            <p className="pm-label mb-2">How it works</p>
            <h2 className="pm-heading text-3xl mb-7">A clean 3-step decision flow</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {PROCESS.map((item, idx) => (
                <div key={item.title} className="pm-card p-5 sm:p-6">
                  <p className="text-xs font-semibold text-pm-accent mb-2">Step {idx + 1}</p>
                  <h3 className="pm-heading text-lg mb-2">{item.title}</h3>
                  <p className="pm-subtle text-sm leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-20">
          <div className="pm-shell">
            <div className="pm-card-soft p-7 sm:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="pm-label mb-2">Start now</p>
                <h2 className="pm-heading text-2xl sm:text-3xl">Get your best next move in under a minute.</h2>
                <p className="pm-subtle text-sm sm:text-base mt-2">
                  Add balances, run ranking, then choose between award search or AI booking guidance.
                </p>
              </div>

              {user ? (
                <Link
                  href={`/${region}/calculator`}
                  className="pm-button whitespace-nowrap"
                  onClick={() => trackEvent('landing_cta_clicked', { location: 'footer', authenticated: true, region })}
                >
                  Go to calculator
                </Link>
              ) : (
                <button
                  onClick={() => {
                    trackEvent('landing_cta_clicked', { location: 'footer', authenticated: false, region })
                    signInWithGoogle()
                  }}
                  className="pm-button whitespace-nowrap"
                >
                  Continue with Google
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
