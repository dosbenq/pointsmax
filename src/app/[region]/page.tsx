'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { GlassCard } from '@/components/ui/GlassCard'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { useAuth } from '@/lib/auth-context'
import { trackEvent } from '@/lib/analytics'
import { type Region } from '@/lib/regions'
import { ArrowRight } from 'lucide-react'

// ─── Inline UI mockups ────────────────────────────────────────────────────────

function WalletMockup() {
  const params = useParams()
  const region = (params.region as Region) || 'us'
  const isIndia = region === 'in'
  
  const balances = isIndia
    ? [
        { name: 'HDFC Millennia Rewards', pts: '2,50,000', color: '#004C8F' },
        { name: 'Axis EDGE Rewards', pts: '1,50,000', color: '#5C258D' },
        { name: 'Air India Maharaja Club', pts: '75,000', color: '#B71C1C' },
      ]
    : [
        { name: 'Chase Ultimate Rewards', pts: '45,000', color: 'var(--pm-program-chase)' },
        { name: 'Amex Membership Rewards', pts: '30,000', color: 'var(--pm-program-amex)' },
        { name: 'United MileagePlus', pts: '12,500', color: 'var(--pm-program-united)' },
      ]
  
  return (
    <div className="pm-card p-6 select-none">
      <p className="pm-label mb-4">Your Wallet</p>
      <div className="space-y-2.5">
        {balances.map((b) => (
          <div
            key={b.name}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-pm-surface-soft"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: b.color }}
              />
              <span className="text-sm text-pm-ink-700 truncate">{b.name}</span>
            </div>
            <span className="text-sm font-semibold font-mono text-pm-ink-900 ml-3 flex-shrink-0">
              {b.pts}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-pm-border text-pm-ink-500 text-sm cursor-default">
          <span className="text-base leading-none">+</span>
          <span>Add program</span>
        </div>
      </div>
    </div>
  )
}

function RouteMockup() {
  const params = useParams()
  const region = (params.region as Region) || 'us'
  const origin = region === 'in' 
    ? { label: 'From', code: 'DEL', city: 'Delhi' }
    : { label: 'From', code: 'JFK', city: 'New York' }
  const destination = { label: 'To', code: 'LHR', city: 'London' }
  
  return (
    <div className="pm-card p-6 select-none">
      <p className="pm-label mb-4">Travel Goal</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[origin, destination].map((loc) => (
          <div key={loc.label} className="bg-pm-surface-soft rounded-xl p-4">
            <p className="text-xs text-pm-ink-500 mb-1">{loc.label}</p>
            <p className="text-3xl font-bold font-mono tracking-tight text-pm-ink-900">{loc.code}</p>
            <p className="text-xs text-pm-ink-500 mt-0.5">{loc.city}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Cabin', value: 'Business' },
          { label: 'Depart', value: 'Mar 15' },
          { label: 'Pax', value: '2 adults' },
        ].map((f) => (
          <div key={f.label} className="bg-pm-surface-soft rounded-xl p-3">
            <p className="text-xs text-pm-ink-500 mb-1">{f.label}</p>
            <p className="text-xs font-semibold text-pm-ink-900">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultsMockup() {
  const params = useParams()
  const region = (params.region as Region) || 'us'
  const isIndia = region === 'in'
  
  const results = isIndia 
    ? [
        {
          rank: 1,
          airline: 'Air India Business',
          cpp: '100 paise/pt',
          pts: '85,000 pts',
          via: 'HDFC → Air India',
          hi: true,
        },
        {
          rank: 2,
          airline: 'Singapore Airlines',
          cpp: '85 paise/pt',
          pts: '90,000 pts',
          via: 'Axis EDGE → KrisFlyer',
          hi: false,
        },
        {
          rank: 3,
          airline: 'Taj Hotels',
          cpp: '80 paise/pt',
          pts: '50,000 pts',
          via: 'HDFC → Taj InnerCircle',
          hi: false,
        },
      ]
    : [
        {
          rank: 1,
          airline: 'ANA Business',
          cpp: '4.2¢/pt',
          pts: '85,000 pts',
          via: 'Chase UR → ANA',
          hi: true,
        },
        {
          rank: 2,
          airline: 'JAL Business',
          cpp: '3.8¢/pt',
          pts: '90,000 pts',
          via: 'Amex MR → JAL',
          hi: false,
        },
        {
          rank: 3,
          airline: 'United Polaris',
          cpp: '3.1¢/pt',
          pts: '88,000 pts',
          via: 'United MP direct',
          hi: false,
        },
      ]
  
  const routeLabel = isIndia ? 'DEL → LHR · Biz' : 'JFK → LHR · Biz'
  
  return (
    <div className="pm-card p-6 select-none">
      <div className="flex items-center justify-between mb-4">
        <p className="pm-label">Best Redemptions</p>
        <span className="text-xs text-pm-accent font-medium">{routeLabel}</span>
      </div>
      <div className="space-y-2.5">
        {results.map((r) => (
          <div
            key={r.rank}
            className={`flex items-center justify-between p-3 rounded-xl ${
              r.hi
                ? 'bg-pm-accent-soft border border-pm-accent-border'
                : 'bg-pm-surface-soft'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <span
                className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ${
                  r.hi ? 'bg-pm-accent text-pm-bg' : 'text-pm-ink-500'
                }`}
              >
                {r.rank}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    r.hi ? 'text-pm-accent' : 'text-pm-ink-900'
                  }`}
                >
                  {r.airline}
                </p>
                <p className="text-xs text-pm-ink-500 truncate">{r.via}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p
                className={`text-sm font-bold font-mono ${
                  r.hi ? 'text-pm-accent' : 'text-pm-ink-900'
                }`}
              >
                {r.cpp}
              </p>
              <p className="text-xs text-pm-ink-500">{r.pts}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROCESS = [
  {
    title: 'Add your balances',
    body: 'Import what you actually have in one place — from transferable currencies to hotel points.',
    Mockup: WalletMockup,
  },
  {
    title: 'Pick your travel goal',
    body: 'Set route, dates, and cabin so recommendations match your real decision.',
    Mockup: RouteMockup,
  },
  {
    title: 'Get the best path',
    body: 'We rank every option and show you the highest-value redemption with clear booking steps.',
    Mockup: ResultsMockup,
  },
]

const HERO_COPY: Record<Region, {
  headline: string
  highlight: string
  suffix: string
  subhead: string
  trustSignal: string
}> = {
  us: {
    headline: 'Stop leaving',
    highlight: 'money',
    suffix: 'on the table.',
    subhead:
      'PointsMax calculates the real value of your points and shows you the highest-value redemption — before you transfer.',
    trustSignal: 'Free · No signup required · Takes 30 seconds',
  },
  in: {
    headline: 'Your credit card points are',
    highlight: 'worth more',
    suffix: 'than you think.',
    subhead:
      'PointsMax calculates the real value of your points and shows you the highest-value redemption — before you transfer.',
    trustSignal: 'Free · No signup required · Takes 30 seconds',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const params = useParams()
  const region = (params.region as Region) || 'us'
  const { user, signInWithGoogle } = useAuth()

  const [stats, setStats] = useState<SiteStats | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [pointInput, setPointInput] = useState<string>('')

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

  useEffect(() => {
    fetch(`/api/programs?region=${region.toUpperCase()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPrograms(data)
          setSelectedProgram(data[0]?.slug || '')
        }
      })
      .catch(() => {})
  }, [region])

  const quickValue = useMemo(() => {
    const points = parseInt(pointInput.replace(/[^\d]/g, ''), 10)
    if (!points || !selectedProgram) return null

    const program = programs.find((p) => p.slug === selectedProgram)
    const cppValue = program?.cpp_cents ?? (region === 'in' ? 75 : 2.0)

    if (region === 'in') {
      const inrValue = (points * cppValue) / 100
      return `₹${Math.round(inrValue).toLocaleString()}`
    }
    const usdValue = (points * cppValue) / 100
    return `$${Math.round(usdValue).toLocaleString()}`
  }, [pointInput, selectedProgram, programs, region])

  // Use real stats from API when available, fall back to conservative estimates
  const trustStats = useMemo(
    () => [
      {
        value: stats?.pointsOptimized
          ? `${(stats.pointsOptimized / 1_000_000).toFixed(1)}M+`
          : '2.3M+',
        label: 'Points Optimized',
      },
      { value: '340+', label: 'Transfer Partners' },
      { value: '4.7×', label: 'Avg Value Lift' },
    ],
    [stats],
  )

  return (
    <div className="min-h-screen bg-pm-bg">
      <NavBar />

      <main className="pt-[var(--navbar-height)]">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section
          className="relative min-h-[85vh] flex items-center"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgb(var(--pm-accent-rgb) / 0.15), transparent),
              radial-gradient(ellipse 60% 40% at 80% 80%, rgb(var(--pm-accent-strong-rgb) / 0.08), transparent),
              var(--pm-bg)
            `,
          }}
        >
          <div className="pm-shell w-full py-20">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95]">
                {heroCopy.headline}
                <br />
                <span className="text-pm-accent">{heroCopy.highlight}</span>
                <br />
                {heroCopy.suffix}
              </h1>

              <p className="mt-8 text-xl text-pm-ink-700 max-w-xl leading-relaxed">
                {heroCopy.subhead}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href={`/${region}/calculator`}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-pm-accent text-pm-bg font-semibold transition-all hover:bg-pm-accent-strong hover:shadow-glow hover:-translate-y-0.5 group"
                  onClick={() =>
                    trackEvent('landing_cta_clicked', {
                      location: 'hero',
                      authenticated: Boolean(user),
                      region,
                    })
                  }
                >
                  Check your points value
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href={`/${region}/how-it-works`}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-pm-border-strong text-pm-ink-900 font-medium transition-all hover:bg-pm-surface-soft hover:border-pm-accent"
                >
                  See how it works
                </Link>
              </div>

              <p className="mt-6 text-sm text-pm-ink-500">{heroCopy.trustSignal}</p>
            </motion.div>
          </div>
        </section>

        {/* ── Trust Stats ──────────────────────────────────────────────── */}
        <SectionReveal>
          <section className="border-y border-pm-border bg-pm-surface/30">
            <div className="pm-shell py-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0">
                {trustStats.map((stat, index) => (
                  <div
                    key={stat.label}
                    className={`text-center ${index < 2 ? 'md:border-r md:border-pm-border' : ''}`}
                  >
                    <p className="text-4xl md:text-5xl font-bold font-mono text-pm-ink-900">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-sm text-pm-ink-500 uppercase tracking-wider">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </SectionReveal>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section className="py-24 md:py-32 space-y-24 md:space-y-32">
          {PROCESS.map((step, index) => {
            const Mockup = step.Mockup
            return (
              <SectionReveal key={step.title} delay={0.05}>
                <div className="pm-shell">
                  <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                    {/* Text — left on even, right on odd */}
                    <div className={index % 2 === 1 ? 'lg:order-2' : 'lg:order-1'}>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pm-accent mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-pm-accent inline-block" />
                        Step {index + 1}
                      </span>
                      <h2 className="text-3xl md:text-4xl font-bold text-pm-ink-900 mb-4 tracking-tight">
                        {step.title}
                      </h2>
                      <p className="text-lg text-pm-ink-700 leading-relaxed">
                        {step.body}
                      </p>
                      <Link
                        href={`/${region}/calculator`}
                        className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-pm-accent hover:text-pm-accent-strong transition-colors group"
                      >
                        Try it
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>

                    {/* Mockup — right on even, left on odd */}
                    <div className={index % 2 === 1 ? 'lg:order-1' : 'lg:order-2'}>
                      <Mockup />
                    </div>

                  </div>
                </div>
              </SectionReveal>
            )
          })}
        </section>

        {/* ── Quick Value Calculator ───────────────────────────────────── */}
        <SectionReveal>
          <section className="py-24">
            <div className="pm-shell max-w-3xl">
              <div className="text-center mb-12">
                <p className="pm-label mb-2">Quick value check</p>
                <h2 className="text-3xl md:text-4xl font-bold text-pm-ink-900 tracking-tight">
                  What are your points worth?
                </h2>
              </div>

              <GlassCard className="p-8 md:p-10">
                <div className="space-y-6">
                  <div>
                    <label className="pm-label block mb-2">I have</label>
                    <select
                      value={selectedProgram}
                      onChange={(e) => setSelectedProgram(e.target.value)}
                      className="pm-input"
                    >
                      {programs.slice(0, 8).map((p) => (
                        <option key={p.id} value={p.slug}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="pm-label block mb-2">Points balance</label>
                    <input
                      type="text"
                      placeholder={region === 'in' ? '50000' : '100000'}
                      value={pointInput}
                      onChange={(e) => setPointInput(e.target.value)}
                      className="pm-input"
                    />
                  </div>

                  <div
                    className="pm-card p-5"
                    style={{
                      background: 'var(--pm-accent-soft)',
                      borderColor: 'var(--pm-accent-border)',
                    }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-pm-accent mb-1">
                      Best value potential
                    </p>
                    <p className="text-3xl font-bold text-pm-accent font-mono">
                      {quickValue || (region === 'in' ? '₹—' : '$—')}
                    </p>
                  </div>

                  <Link
                    href={`/${region}/calculator`}
                    className="block text-center text-sm font-semibold text-pm-accent hover:text-pm-accent-strong transition-colors"
                  >
                    See full breakdown →
                  </Link>
                </div>
              </GlassCard>
            </div>
          </section>
        </SectionReveal>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <SectionReveal>
          <section className="py-24 md:py-32">
            <div className="pm-shell text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-pm-ink-900 mb-6 tracking-tight">
                Ready to maximize your points?
              </h2>
              <p className="text-lg text-pm-ink-700 max-w-xl mx-auto mb-10">
                Join thousands of travelers who are getting 3–5× more value from their credit card
                points.
              </p>
              {user ? (
                <Link
                  href={`/${region}/calculator`}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-pm-accent text-pm-bg font-semibold text-lg transition-all hover:bg-pm-accent-strong hover:shadow-glow hover:-translate-y-0.5 group"
                >
                  Go to calculator
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-pm-accent text-pm-bg font-semibold text-lg transition-all hover:bg-pm-accent-strong hover:shadow-glow hover:-translate-y-0.5 group"
                >
                  Start free with Google
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              )}
            </div>
          </section>
        </SectionReveal>

      </main>

      <Footer />
    </div>
  )
}
