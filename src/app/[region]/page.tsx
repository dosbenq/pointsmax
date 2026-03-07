'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, Bell, CreditCard, Map, Wallet } from 'lucide-react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { GlassCard } from '@/components/ui/GlassCard'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { useAuth } from '@/lib/auth-context'
import { trackEvent } from '@/lib/analytics'
import { type Region } from '@/lib/regions'

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

const HERO_COPY: Record<Region, {
  eyebrow: string
  headline: string
  subhead: string
  memo: string
  value: string
  route: string
}> = {
  us: {
    eyebrow: 'Wallet-aware rewards strategy',
    headline: 'The premium way to decide what your points should do next.',
    subhead:
      'PointsMax turns scattered balances into one clear move: what to book, what to transfer, and what is not worth your attention.',
    memo: 'Transfer 80k Chase to Aeroplan. Book business to London. Keep Hyatt for hotel value instead of diluting it into a generic portal redemption.',
    value: '$3,420 projected trip value',
    route: 'Featured route: Chase → Aeroplan',
  },
  in: {
    eyebrow: 'Wallet-aware rewards strategy',
    headline: 'A sharper rewards product for Indian cardholders.',
    subhead:
      'PointsMax turns scattered bank and airline balances into one clear move: what to transfer, what to keep, and how to avoid low-value redemptions.',
    memo: 'Move HDFC rewards when the Air India transfer path is strongest. Preserve premium hotel value instead of cashing everything out into vouchers.',
    value: '₹1,84,000 projected trip value',
    route: 'Featured route: HDFC → Air India',
  },
}

function FeaturedDecision({ region }: { region: Region }) {
  const wallet = region === 'in'
    ? [
        ['HDFC Reward Points', '2,50,000'],
        ['Axis EDGE Rewards', '1,10,000'],
        ['Maharaja Club', '72,000'],
      ]
    : [
        ['Chase Ultimate Rewards', '85,000'],
        ['Amex Membership Rewards', '42,000'],
        ['World of Hyatt', '19,000'],
      ]

  const copy = HERO_COPY[region]

  return (
    <div className="pm-hero-frame rounded-[34px] p-6 text-[#f4fbff] sm:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-[#9fc6ff]/18 pb-5">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#c7edf4]/82">Featured decision</p>
          <h2 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.04em] text-[#f4fbff]">What your wallet should do now.</h2>
        </div>
        <div className="rounded-full border border-[#b6e2f0]/24 bg-[#7ce8dc]/12 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#dff7fa]/88">
          Live strategy
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#c7edf4]/82">Current balances</p>
          <div className="mt-4 space-y-3">
            {wallet.map(([name, value]) => (
              <div key={name} className="flex items-center justify-between rounded-[20px] border border-[#b6e2f0]/18 bg-[#7ce8dc]/10 px-4 py-3">
                <span className="text-sm text-[#def3f8]/88">{name}</span>
                <span className="text-sm font-semibold text-[#f4fbff]">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#c7edf4]/82">Featured move</p>
          <div className="mt-4 rounded-[26px] bg-[#f8fbff] px-5 py-5 text-[#0f2747] shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:px-6">
            <p className="text-lg font-semibold leading-8 tracking-[-0.03em]">{copy.memo}</p>
            <div className="mt-6 space-y-3 border-t border-[#10243a]/8 pt-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#10243a]/54">Projected value</span>
                <span className="font-semibold">{copy.value}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#10243a]/54">Transfer path</span>
                <span className="font-semibold">{copy.route.replace('Featured route: ', '')}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#10243a]/54">Why it wins</span>
                <span className="font-semibold">Higher redemption yield</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const params = useParams()
  const region = (params.region as Region) || 'us'
  const { user } = useAuth()
  const [stats, setStats] = useState<SiteStats | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [pointInput, setPointInput] = useState<string>('')

  const heroCopy = HERO_COPY[region]

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.users === 'number') setStats(data as SiteStats)
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
    const cppValue = program?.cpp_cents ?? (region === 'in' ? 75 : 2)
    return region === 'in'
      ? `₹${Math.round((points * cppValue) / 100).toLocaleString()}`
      : `$${Math.round((points * cppValue) / 100).toLocaleString()}`
  }, [pointInput, selectedProgram, programs, region])

  const trustStats = useMemo(
    () => [
      {
        value: stats?.pointsOptimized ? `${(stats.pointsOptimized / 1_000_000).toFixed(1)}M+` : '2.3M+',
        label: 'points analysed',
      },
      { value: '340+', label: 'partner mappings' },
      { value: 'wallet-aware', label: 'recommendation model' },
    ],
    [stats],
  )

  const coreFeatures = [
    {
      href: `/${region}/calculator`,
      title: 'Planner',
      body: 'Use your existing points with one flagship planning flow. Value them, verify routes, and turn a trip idea into a booking path.',
      icon: Wallet,
      eyebrow: 'Use my points',
      sublinks: [
        { href: `/${region}/calculator`, label: 'Route verification' },
        { href: `/${region}/calculator`, label: 'Booking path' },
      ],
    },
    {
      href: `/${region}/card-recommender`,
      title: 'Card Strategy',
      body: 'Decide what card should come next, compare earning potential, and understand the card landscape without treating each tool as a separate product.',
      icon: CreditCard,
      eyebrow: 'Improve my card setup',
      sublinks: [
        { href: `/${region}/card-recommender`, label: 'Next card decision' },
        { href: `/${region}/card-recommender`, label: 'Earnings view' },
      ],
    },
    {
      href: `/${region}/profile`,
      title: 'Wallet',
      body: 'Keep balances, connected accounts, alerts, and preferences in one place so the rest of the product stays current.',
      icon: Bell,
      eyebrow: 'Keep everything current',
      sublinks: [
        { href: `/${region}/profile`, label: 'Balances & alerts' },
        { href: `/${region}/pricing`, label: 'Pricing' },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-pm-bg">
      <NavBar />

      <main className="pt-[var(--navbar-height)]">
        <section className="overflow-hidden bg-[linear-gradient(135deg,#0c4263_0%,#0f5972_48%,#0a6880_100%)] text-[#f4fbff]">
          <div className="pm-shell py-16 sm:py-20 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-2xl"
              >
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[#c7edf4]/82">{heroCopy.eyebrow}</p>
                <h1 className="mt-5 text-[3.65rem] font-semibold leading-[0.92] tracking-[-0.065em] text-[#f4fbff] sm:text-[5.3rem] lg:text-[6.2rem]">
                  {heroCopy.headline}
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-[#d8eef4]/88 sm:text-xl">
                  {heroCopy.subhead}
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/${region}/calculator`}
                    className="inline-flex items-center justify-center rounded-full bg-[#f8fbff] px-7 py-3.5 text-sm font-semibold text-[#10243a] transition hover:opacity-92 sm:text-base"
                    onClick={() =>
                      trackEvent('landing_cta_clicked', {
                        location: 'hero_primary',
                        authenticated: Boolean(user),
                        region,
                      })
                    }
                  >
                    Open the calculator
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    href={`/${region}/how-it-works`}
                    className="inline-flex items-center justify-center rounded-full border border-[#b6e2f0]/28 px-7 py-3.5 text-sm font-semibold text-[#eefcff]/96 transition hover:bg-[#7ce8dc]/10 sm:text-base"
                  >
                    See how it works
                  </Link>
                </div>

                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  {trustStats.map((stat) => (
                    <div key={stat.label} className="rounded-[22px] border border-[#b6e2f0]/18 bg-[#7ce8dc]/8 px-4 py-4">
                      <p className="text-2xl font-semibold tracking-[-0.05em] text-[#f4fbff]">{stat.value}</p>
                      <p className="mt-2 text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-[#c7edf4]/82">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
              >
                <FeaturedDecision region={region} />
              </motion.div>
            </div>
          </div>
        </section>

        <SectionReveal>
          <section className="border-b border-[#113656]/8 bg-[#eef9fb] py-16 sm:py-20">
            <div className="pm-shell">
              <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
                <div>
                  <p className="pm-section-title mb-4">Start with the question you actually have</p>
                  <h2 className="pm-display text-[2.8rem] sm:text-[4.2rem]">Each primary page should feel like a different decision, not the same tool in disguise.</h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-pm-ink-700 sm:text-lg">
                    The fastest way to reduce friction is to start users from intent. If they need valuation, take them to the calculator. If they need a next card, take them to strategy. If they need a real trip plan, take them straight to trip-building.
                  </p>
                </div>

                <div className="grid gap-4">
                  {coreFeatures.map((item) => (
                    <Link key={item.href} href={item.href} className="pm-metric-tile group p-5 sm:p-6 transition-all hover:-translate-y-[1px]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-pm-ink-500">{item.eyebrow}</p>
                          <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-pm-ink-900">{item.title}</h3>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pm-premium-soft text-pm-ink-900">
                          <item.icon className="h-5 w-5" />
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-pm-ink-700">{item.body}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.sublinks.map((link) => (
                          <span key={link.href} className="rounded-full border border-pm-border bg-pm-surface px-3 py-1 text-xs font-medium text-pm-ink-500">
                            {link.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-pm-ink-900">
                        Open this feature
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </SectionReveal>

        <SectionReveal>
          <section className="py-16 sm:py-20">
            <div className="pm-shell grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
              <div className="pm-card-soft p-7 sm:p-8">
                <p className="pm-section-title mb-3">What PointsMax should always give you</p>
                <h2 className="pm-display text-[2.6rem] sm:text-[3.8rem]">One best move first. Supporting detail second.</h2>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    ['A primary recommendation', 'The best route, redemption, or card should be surfaced before the alternatives.'],
                    ['A transfer path', 'If a move requires bank points, the transfer chain should be obvious.'],
                    ['A reason to trust it', 'Confidence, freshness, and assumptions should travel with the result.'],
                    ['An action to take', 'Every major page should end with something you can do now.'],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-[22px] border border-pm-border bg-pm-surface px-5 py-5">
                      <h3 className="text-base font-semibold tracking-[-0.03em] text-pm-ink-900">{title}</h3>
                      <p className="mt-2 text-sm leading-7 text-pm-ink-700">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-5">
                <GlassCard className="p-7 sm:p-8">
                  <p className="pm-section-title mb-3">Quick value check</p>
                  <h3 className="pm-heading text-[1.9rem] tracking-[-0.04em]">Get a fast read before the full decision.</h3>
                  <p className="mt-3 text-sm leading-7 text-pm-ink-700">
                    This should stay lightweight: estimate value here, then move into the full calculator once you want actual ranking and transfer logic.
                  </p>
                  <div className="mt-6 space-y-6">
                    <div>
                      <label className="pm-label mb-2 block">Program</label>
                      <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} className="pm-input">
                        {programs.slice(0, 10).map((p) => (
                          <option key={p.id} value={p.slug}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="pm-label mb-2 block">Points balance</label>
                      <input
                        type="text"
                        placeholder={region === 'in' ? '50000' : '100000'}
                        value={pointInput}
                        onChange={(e) => setPointInput(e.target.value)}
                        className="pm-input"
                      />
                    </div>

                    <div className="rounded-[24px] bg-[linear-gradient(135deg,#0c4263_0%,#0f5972_52%,#0a6880_100%)] p-5 text-[#f4fbff]">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#c7edf4]/82">Estimated value</p>
                      <p className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{quickValue || (region === 'in' ? '₹—' : '$—')}</p>
                    </div>

                    <Link href={`/${region}/calculator`} className="pm-button w-full justify-center py-3 text-sm sm:text-base">
                      Continue to the calculator
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </GlassCard>

                <Link href={`/${region}/trip-builder`} className="pm-card group p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="pm-section-title mb-2">Subflow inside Planner</p>
                      <h3 className="pm-heading text-[1.5rem] tracking-[-0.04em]">Need the booking path, not just the valuation?</h3>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pm-surface-soft text-pm-ink-900">
                      <Map className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-pm-ink-700">
                    Trip Builder and Award Search still exist, but they should be understood as supporting paths inside Planner rather than separate top-level products.
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-pm-ink-900">
                    Open Trip Builder
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </div>
            </div>
          </section>
        </SectionReveal>
      </main>

      <Footer />
    </div>
  )
}
