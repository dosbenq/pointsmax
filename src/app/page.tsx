'use client'

import { useState } from 'react'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
import { trackEvent } from '@/lib/analytics'

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

const OUTCOMES = [
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

export default function LandingPage() {
  const { user, signInWithGoogle } = useAuth()
  const [activeOutcome, setActiveOutcome] = useState(OUTCOMES[0])

  const handleStart = () => {
    trackEvent('landing_cta_clicked', { location: 'hero', authenticated: Boolean(user) })
    if (!user) signInWithGoogle()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1">
        <section className="pt-16 pb-12 sm:pt-22 sm:pb-14">
          <div className="pm-shell">
            <div className="grid gap-10 lg:grid-cols-12 items-end">
              <div className="lg:col-span-7 space-y-6">
                <span className="pm-pill">Points decisions made simple</span>
                <h1 className="pm-heading text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
                  Know your best redemption
                  <br />
                  before you transfer.
                </h1>
                <p className="pm-subtle text-base sm:text-lg max-w-xl leading-relaxed">
                  PointsMax shows what your points are worth right now, where to move them, and what to book next.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {user ? (
                    <Link
                      href="/calculator"
                      className="pm-button"
                      onClick={() => trackEvent('landing_cta_clicked', { location: 'hero', authenticated: true })}
                    >
                      Start free analysis
                    </Link>
                  ) : (
                    <button onClick={handleStart} className="pm-button">
                      Start free analysis
                    </button>
                  )}
                  <Link
                    href="/how-it-works"
                    className="text-sm font-semibold text-[#0f766e] hover:text-[#0b5e57]"
                    onClick={() => trackEvent('landing_secondary_cta_clicked', { location: 'hero', target: 'how_it_works' })}
                  >
                    See how it works
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="pm-card-soft p-6 sm:p-7">
                  <p className="pm-label mb-2">Quick answer customers want</p>
                  <h2 className="pm-heading text-xl mb-4">How much value am I missing?</h2>

                  <div className="space-y-3">
                    <div className="pm-card p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-[#5a7468]">Simple cash redemption</p>
                        <p className="text-sm font-semibold text-[#183d33]">Safe baseline</p>
                      </div>
                      <p className="text-xl font-bold text-[#2a5b4d]">{activeOutcome.cash}</p>
                    </div>
                    <div className="pm-card p-4 flex items-center justify-between border-[#8ed3c8] bg-[#ecfaf7]">
                      <div>
                        <p className="text-xs text-[#43766c]">Best practical path</p>
                        <p className="text-sm font-semibold text-[#154a42]">With transfer strategy</p>
                      </div>
                      <p className="text-xl font-bold text-[#0f766e]">{activeOutcome.best}</p>
                    </div>
                    <div className="rounded-xl border border-[#c7e7d4] bg-[#ecf9f1] px-4 py-3">
                      <p className="text-xs text-[#4f8c66]">Value lift</p>
                      <p className="text-lg font-bold text-[#157347]">{activeOutcome.lift}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#d7e8dd] bg-[rgba(236,246,240,0.54)]">
          <div className="pm-shell py-5">
            <div className="flex flex-wrap gap-2">
              {PROOF_STRIP.map((item) => (
                <span key={item} className="pm-pill text-[11px]">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="pm-shell grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="pm-label mb-2">Illustrative scenarios</p>
              <h2 className="pm-heading text-2xl sm:text-3xl">See outcomes by travel goal</h2>
              <p className="pm-subtle text-sm mt-2">Switch sample scenarios to see how recommendations can change by trip type.</p>
            </div>

            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap gap-2">
                {OUTCOMES.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveOutcome(item)
                      trackEvent('landing_outcome_scenario_selected', { scenario: item.id })
                    }}
                    className={`px-3 py-2 rounded-full text-sm font-semibold border transition-colors ${
                      activeOutcome.id === item.id
                        ? 'bg-[#0f766e] text-white border-[#0f766e]'
                        : 'bg-white text-[#365649] border-[#d5e5d9] hover:border-[#99ccbe]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pm-card-soft p-5 sm:p-6">
                <p className="text-sm text-[#2a4b3f]">{activeOutcome.detail}</p>
                <div className="grid sm:grid-cols-3 gap-3 mt-4">
                  <div className="pm-card p-4">
                    <p className="text-xs text-[#688377]">Cash path</p>
                    <p className="text-lg font-bold text-[#2a5b4d] mt-1">{activeOutcome.cash}</p>
                  </div>
                  <div className="pm-card p-4 border-[#8ed3c8] bg-[#ecfaf7]">
                    <p className="text-xs text-[#43766c]">Best path</p>
                    <p className="text-lg font-bold text-[#0f766e] mt-1">{activeOutcome.best}</p>
                  </div>
                  <div className="pm-card p-4 border-[#c7e7d4] bg-[#ecf9f1]">
                    <p className="text-xs text-[#4f8c66]">Lift</p>
                    <p className="text-lg font-bold text-[#157347] mt-1">{activeOutcome.lift}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16 border-y border-[#d7e8dd] bg-[rgba(236,246,240,0.45)]">
          <div className="pm-shell">
            <p className="pm-label mb-2">How it works</p>
            <h2 className="pm-heading text-3xl mb-7">A clean 3-step decision flow</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {PROCESS.map((item, idx) => (
                <div key={item.title} className="pm-card p-5 sm:p-6">
                  <p className="text-xs font-semibold text-[#0f766e] mb-2">Step {idx + 1}</p>
                  <h3 className="pm-heading text-lg mb-2">{item.title}</h3>
                  <p className="pm-subtle text-sm leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

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
                  href="/calculator"
                  className="pm-button whitespace-nowrap"
                  onClick={() => trackEvent('landing_cta_clicked', { location: 'footer', authenticated: true })}
                >
                  Go to calculator
                </Link>
              ) : (
                <button
                  onClick={() => {
                    trackEvent('landing_cta_clicked', { location: 'footer', authenticated: false })
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
