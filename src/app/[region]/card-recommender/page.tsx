'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import type { CardWithRates, SpendCategory } from '@/types/database'
import {
  formatCurrencyRounded,
  getCategoriesForRegion,
  spendInputPrefix,
} from '@/lib/card-tools'
import { trackEvent } from '@/lib/analytics'
import { REGIONS, type Region } from '@/lib/regions'
import {
  useCardScorer,
  useSpendOnlyRanking,
  TRAVEL_GOALS,
  SOFT_BENEFIT_COPY,
  type SoftBenefitType,
  type RecommendationMode,
  type AnnualFeeTolerance,
} from '@/features/card-recommender'

type SpendInputs = Partial<Record<SpendCategory, string>>
type WalletBalanceSummary = {
  program_id: string
  balance: number
  source: 'manual' | 'connector'
  as_of: string | null
  confidence: 'high' | 'medium' | 'low'
  sync_status: string | null
  is_stale: boolean
  connected_account_id: string | null
}

function safeApplyUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

export default function CardRecommenderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const regionCode = (params.region as Region) || 'us'
  const config = REGIONS[regionCode]
  const reduceMotion = useReducedMotion()
  const initialView = searchParams.get('view') === 'earnings' ? 'earnings' : 'strategy'
  const [cards, setCards] = useState<CardWithRates[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [spend, setSpend] = useState<SpendInputs>(config.defaultSpend as SpendInputs)
  const [travelGoals, setTravelGoals] = useState<Set<string>>(new Set())
  const [ownedCards, setOwnedCards] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<RecommendationMode>('next_best_card')
  const [annualFeeTolerance, setAnnualFeeTolerance] = useState<AnnualFeeTolerance>('medium')
  const [recentOpenAccounts24m, setRecentOpenAccounts24m] = useState('0')
  const [targetPointsGoal, setTargetPointsGoal] = useState('')
  const [walletBalances, setWalletBalances] = useState<WalletBalanceSummary[]>([])
  const [walletLoaded, setWalletLoaded] = useState(false)
  const [showResults, setShowResults] = useState(initialView === 'earnings')
  const [activeView, setActiveView] = useState<'strategy' | 'earnings'>(initialView)
  const [redirectingCardId, setRedirectingCardId] = useState<string | null>(null)
  const categories = getCategoriesForRegion(regionCode)

  // Reset spend when region changes
  useEffect(() => {
    setSpend(config.defaultSpend as SpendInputs)
  }, [config.defaultSpend])

  useEffect(() => {
    const nextView = searchParams.get('view') === 'earnings' ? 'earnings' : 'strategy'
    setActiveView(nextView)
    if (nextView === 'earnings') {
      setMode('long_term_value')
      setShowResults(true)
    }
  }, [searchParams])

  useEffect(() => {
    fetch(`/api/cards?geography=${encodeURIComponent(regionCode.toUpperCase())}`)
      .then(async r => {
        if (!r.ok) {
          throw new Error(`Failed to load cards (${r.status})`)
        }
        return r.json()
      })
      .then(({ cards: data }: { cards: CardWithRates[] }) => {
        setCards(data ?? [])
        setLoadError(null)
        setLoading(false)
      })
      .catch(() => {
        setCards([])
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false
        setLoadError(
          offline
            ? 'You appear to be offline. Reconnect and try again.'
            : 'Server error while loading card data. Please try again.',
        )
        setLoading(false)
      })
  }, [regionCode])

  useEffect(() => {
    let cancelled = false

    fetch(`/api/user/balances?region=${encodeURIComponent(regionCode.toUpperCase())}`)
      .then(async response => {
        if (!response.ok) {
          return { balances: [] as WalletBalanceSummary[] }
        }
        return response.json() as Promise<{ balances?: WalletBalanceSummary[] }>
      })
      .then(payload => {
        if (cancelled) return
        setWalletBalances(payload.balances ?? [])
        setWalletLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setWalletBalances([])
        setWalletLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [regionCode])

  const spendPrefix = spendInputPrefix(config.currency)
  const trackedPrograms = walletBalances.filter(balance => balance.balance > 0)
  const staleWalletCount = trackedPrograms.filter(balance => balance.is_stale).length

  const toggleGoal = (key: string) => {
    setTravelGoals(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleOwned = (id: string) => {
    setOwnedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Use the extracted scorer hook for full recommendations
  const { visible: visibleResults, blocked: blockedResults } = useCardScorer({
    cards,
    spend,
    travelGoals,
    ownedCards,
    regionCode,
    programGoalMap: config.programGoalMap,
    annualFeeTolerance,
    mode,
    recentOpenAccounts24m: Number.parseInt(recentOpenAccounts24m || '0', 10) || 0,
    walletBalances,
    targetPointsGoal: Number.parseInt(targetPointsGoal || '0', 10) || null,
    showResults,
  })
  
  // Use extracted hook for spend-only ranking (earnings view)
  const spendOnlyResults = useSpendOnlyRanking({
    cards,
    spend,
    regionCode,
    enabled: activeView === 'earnings',
    limit: 5,
  })

  const handleApplyClick = async (
    card: CardWithRates,
    rank: number,
    firstYearValue: number,
  ) => {
    const fallbackUrl = safeApplyUrl(card.apply_url)
    if (!fallbackUrl) return

    setRedirectingCardId(card.id)
    try {
      const response = await fetch('/api/analytics/affiliate-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: card.id,
          program_id: card.program_id,
          source_page: 'card-recommender',
          rank,
          region: regionCode,
          recommendation_mode: mode,
        }),
      })

      const payload = await response.json().catch(() => ({} as { redirect_url?: string }))
      const trackedUrl = typeof payload.redirect_url === 'string'
        ? safeApplyUrl(payload.redirect_url)
        : null
      const redirectUrl = trackedUrl ?? fallbackUrl

      trackEvent('card_apply_click', {
        card_name: card.name,
        rank,
        first_year_value: Math.round(firstYearValue),
        region: regionCode,
        recommendation_mode: mode,
      })

      const popup = window.open(redirectUrl, '_blank', 'noopener,noreferrer')
      if (!popup) {
        window.location.assign(redirectUrl)
      }
    } catch {
      const popup = window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
      if (!popup) {
        window.location.assign(fallbackUrl)
      }
    } finally {
      setRedirectingCardId(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-[#9fc6ff]/18 bg-[#5ac7d4]/10 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#d6e4f7]/82">
                Card strategy {config.flag}
              </span>
              <h1 className="mt-5 text-[3.15rem] font-semibold leading-[0.93] tracking-[-0.065em] text-[#f4f8ff] sm:text-[4.5rem]">
                Decide what card should come next.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#dce8f8]/86">
                The recommender now scores cards with wallet context, travel goals, annual-fee tolerance, and issuer-rule signals instead of generic category math.
              </p>
            </div>

            <div className="pm-hero-frame rounded-[30px] p-5 text-[#f4f8ff]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#c6d9f4]/78">Strategy snapshot</p>
              <div className="mt-4 rounded-[24px] bg-[#f8fbff] px-5 py-5 text-[#0f2747]">
                <p className="text-lg font-semibold leading-8 tracking-[-0.03em]">
                  {mode === 'next_best_card' ? 'Best next card' : 'Best long-term value'} · {travelGoals.size} goal{travelGoals.size === 1 ? '' : 's'}
                </p>
                <div className="mt-5 space-y-3 border-t border-[#10243a]/8 pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#10243a]/54">Tracked balances</span>
                    <span className="font-semibold">{trackedPrograms.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#10243a]/54">Owned cards excluded</span>
                    <span className="font-semibold">{ownedCards.size}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#10243a]/54">24-month recent opens</span>
                    <span className="font-semibold">{recentOpenAccounts24m || '0'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="pm-shell py-8 w-full space-y-6 flex-1">
        <div className="pm-card p-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="pm-section-title mb-2">Decision flow</p>
              <h2 className="pm-heading text-xl">Use Card Strategy in three steps.</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ['1. Describe spend', 'Keep the spend profile directional, not perfect.'],
                  ['2. Add constraints', 'Goals, fee comfort, recent approvals, and owned cards shape the shortlist.'],
                  ['3. Pick one move', 'Use strategy mode for the next card. Use earnings mode only when you want pure spend math.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[22px] border border-pm-border bg-pm-surface-soft p-4">
                    <p className="text-sm font-semibold text-pm-ink-900">{title}</p>
                    <p className="mt-2 text-xs leading-6 text-pm-ink-700">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-pm-border bg-pm-surface-soft p-5">
              <p className="pm-section-title mb-2">Decision brief</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-pm-ink-500">Mode</span>
                  <span className="font-semibold text-pm-ink-900">
                    {activeView === 'earnings' ? 'Spend-only ranking' : mode === 'next_best_card' ? 'Best next card' : 'Best long-term value'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-pm-ink-500">Wallet balances</span>
                  <span className="font-semibold text-pm-ink-900">{trackedPrograms.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-pm-ink-500">Owned cards excluded</span>
                  <span className="font-semibold text-pm-ink-900">{ownedCards.size}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-pm-ink-500">Goal count</span>
                  <span className="font-semibold text-pm-ink-900">{travelGoals.size}</span>
                </div>
              </div>
              <p className="mt-4 text-xs leading-6 text-pm-ink-500">
                The page should answer one question: what should come next for this wallet, in this region, under these constraints?
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
        <div className="pm-card p-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveView('strategy')}
              className={`flex-1 min-w-[220px] rounded-[24px] border px-4 py-4 text-left transition-colors ${
                activeView === 'strategy'
                  ? 'border-pm-accent-border bg-pm-accent-soft'
                  : 'border-pm-border bg-pm-surface-soft hover:border-pm-accent-border'
              }`}
            >
              <p className="text-sm font-semibold text-pm-ink-900">Next card decision</p>
              <p className="mt-1 text-xs leading-6 text-pm-ink-700">
                Choose the best next card using wallet context, goals, and issuer rules.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('earnings')
                setMode('long_term_value')
                setShowResults(true)
              }}
              className={`flex-1 min-w-[220px] rounded-[24px] border px-4 py-4 text-left transition-colors ${
                activeView === 'earnings'
                  ? 'border-pm-accent-border bg-pm-accent-soft'
                  : 'border-pm-border bg-pm-surface-soft hover:border-pm-accent-border'
              }`}
            >
              <p className="text-sm font-semibold text-pm-ink-900">Pure earnings view</p>
              <p className="mt-1 text-xs leading-6 text-pm-ink-700">
                Rank cards only by your current spending pattern and net annual value.
              </p>
            </button>
          </div>
        </div>

        <div className="pm-card-soft p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="pm-section-title mb-2">Spend profile</p>
              <h2 className="pm-heading text-lg">Monthly spending ({config.id.toUpperCase()})</h2>
            </div>
            <div className="hidden rounded-full bg-[#0f2747] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#f4f8ff] sm:inline-flex">
              Intake
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {categories.map(({ key, label, icon }) => (
              <div key={key}>
                <label className="pm-label block mb-1.5">
                  {icon} {label}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pm-ink-500 text-sm">{spendPrefix}</span>
                  <input
                    type="number"
                    min="0"
                    value={spend[key] ?? ''}
                    onChange={e => setSpend(p => ({ ...p, [key]: e.target.value }))}
                    className="pm-input pl-7"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pm-card p-6">
          <p className="pm-section-title mb-2">Intent</p>
          <h2 className="pm-heading text-lg mb-1">Travel goals</h2>
          <p className="text-xs text-pm-ink-500 mb-4">Select all that apply. We&apos;ll boost cards that best match your goals.</p>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_GOALS.map(goal => {
              const active = travelGoals.has(goal.key)
              return (
                <button
                  key={goal.key}
                  onClick={() => toggleGoal(goal.key)}
                  className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                    active
                      ? 'bg-pm-accent text-pm-bg border-pm-accent'
                      : 'bg-pm-surface text-pm-ink-700 border-pm-border hover:border-pm-accent-border'
                  }`}
                >
                  {goal.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="pm-card p-6 space-y-5">
          <div>
            <p className="pm-section-title mb-2">Scoring model</p>
            <h2 className="pm-heading text-lg mb-1">Recommendation strategy</h2>
            <p className="text-xs text-pm-ink-500 mb-3">Pick the decision mode first. V2 uses a different scoring model for “best next card” versus long-term keeper value.</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'next_best_card', label: 'Best next card' },
                { value: 'long_term_value', label: 'Best long-term value' },
              ].map(option => {
                const active = mode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value as RecommendationMode)}
                    className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                      active
                        ? 'bg-pm-accent text-pm-bg border-pm-accent'
                        : 'bg-pm-surface text-pm-ink-700 border-pm-border hover:border-pm-accent-border'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="pm-heading text-sm mb-2">Annual fee tolerance</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'low', label: 'Keep fees low' },
                { value: 'medium', label: 'Balanced' },
                { value: 'high', label: 'Premium is OK' },
              ].map(option => {
                const active = annualFeeTolerance === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAnnualFeeTolerance(option.value as AnnualFeeTolerance)}
                    className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                      active
                        ? 'bg-pm-accent-soft text-pm-accent-strong border-pm-accent-border'
                        : 'bg-pm-surface text-pm-ink-700 border-pm-border hover:border-pm-accent-border'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="pm-label block mb-1.5">
                Cards opened in the last 24 months
              </label>
              <input
                type="number"
                min="0"
                value={recentOpenAccounts24m}
                onChange={event => setRecentOpenAccounts24m(event.target.value)}
                className="pm-input"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-pm-ink-500">Used for issuer-rule checks like Chase 5/24.</p>
            </div>
            <div>
              <label className="pm-label block mb-1.5">
                Optional points goal
              </label>
              <input
                type="number"
                min="0"
                value={targetPointsGoal}
                onChange={event => setTargetPointsGoal(event.target.value)}
                className="pm-input"
                placeholder={regionCode === 'in' ? '120000' : '80000'}
              />
              <p className="mt-1 text-xs text-pm-ink-500">Used for time-to-goal estimates when the card earns into a tracked program.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-pm-border bg-pm-surface-soft p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-pm-ink-900">Wallet context</p>
                <p className="text-xs text-pm-ink-500">
                  {walletLoaded
                    ? trackedPrograms.length > 0
                      ? `Using ${trackedPrograms.length} tracked balance${trackedPrograms.length === 1 ? '' : 's'} in this region.`
                      : 'No tracked balances found for this region. Recommendations will rely on spend inputs only.'
                    : 'Loading tracked balances...'}
                </p>
              </div>
              {walletLoaded && trackedPrograms.length > 0 && (
                <span className={`text-xs px-2 py-1 rounded-full border ${
                  staleWalletCount > 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-pm-success-soft text-pm-success border-pm-border'
                }`}>
                  {staleWalletCount > 0 ? `${staleWalletCount} stale balance${staleWalletCount === 1 ? '' : 's'}` : 'Fresh enough for scoring'}
                </span>
              )}
            </div>
          </div>
        </div>

        {!loading && (
          <div className="pm-card p-6">
            <p className="pm-section-title mb-2">Portfolio</p>
            <h2 className="pm-heading text-lg mb-1">Cards you already have</h2>
            <p className="text-xs text-pm-ink-500 mb-4">Use this to stop V2 from recommending a card you already hold. Those cards will move into the “not recommended right now” section.</p>
            <div className="flex flex-wrap gap-2">
              {cards.map(card => {
                const owned = ownedCards.has(card.id)
                return (
                  <button
                    key={card.id}
                  onClick={() => toggleOwned(card.id)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    owned
                      ? 'bg-pm-surface-soft text-pm-ink-500 border-pm-border line-through'
                      : 'bg-pm-surface text-pm-ink-700 border-pm-border hover:border-pm-accent-border'
                  }`}
                >
                  {card.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
          </div>

          <aside className="lg:col-span-4">
            <div className="pm-card sticky top-[calc(var(--navbar-height)+1.5rem)] p-6">
              <p className="pm-section-title mb-3">How to use this page</p>
              <div className="space-y-4">
                {[
                  ['Describe spend', 'Keep the spending profile directional, not perfect.'],
                  ['Set intent and constraints', 'Goals, annual-fee posture, and recent applications shape the shortlist.'],
                  ['Run one recommendation pass', 'The page should surface one best next move before the alternatives.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[22px] bg-pm-surface-soft p-4">
                    <p className="text-sm font-semibold text-pm-ink-900">{title}</p>
                    <p className="mt-1 text-xs leading-6 text-pm-ink-700">{body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[22px] border border-pm-border bg-pm-premium-soft px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pm-ink-500">Current inputs</p>
                <div className="mt-3 space-y-2 text-sm text-pm-ink-700">
                  <div className="flex items-center justify-between gap-4">
                    <span>Goals selected</span>
                    <span className="font-semibold">{travelGoals.size}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Wallet balances</span>
                    <span className="font-semibold">{trackedPrograms.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Fee posture</span>
                    <span className="font-semibold capitalize">{annualFeeTolerance}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowResults(true)}
                disabled={loading || !!loadError}
                className="pm-button mt-5 w-full"
              >
                {activeView === 'earnings' ? 'Refresh spend ranking' : 'Run recommender'}
              </button>

              <Link
                href={`/${regionCode}/card-recommender?view=earnings`}
                className="mt-3 inline-flex text-sm font-medium text-pm-accent hover:underline underline-offset-4"
              >
                Open spend-only earnings view
              </Link>

              {loadError && (
                <div className="mt-4 rounded-[22px] border border-pm-danger-border bg-pm-danger-soft p-4">
                  <p className="text-sm text-pm-danger">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-2 text-sm text-pm-danger underline underline-offset-4"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>

        {activeView === 'earnings' && spendOnlyResults.length > 0 && (
          <div className="pm-card-soft overflow-hidden" id="earnings-view">
            <div className="flex items-center justify-between gap-3 border-b border-pm-border px-6 py-4">
              <div>
                <h2 className="pm-heading text-lg">Spend-only leaderboard</h2>
                <p className="text-xs text-pm-ink-500">
                  This replaces the old earning calculator. It ranks cards using only your spend mix and annual fee impact.
                </p>
              </div>
              <Link
                href={`/${regionCode}/card-recommender`}
                className="text-sm font-medium text-pm-accent hover:underline underline-offset-4"
              >
                Back to full strategy
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pm-border text-xs uppercase tracking-[0.16em] text-pm-ink-500">
                    <th className="px-6 py-3 text-left font-semibold">Card</th>
                    <th className="px-4 py-3 text-right font-semibold">Annual points</th>
                    <th className="px-4 py-3 text-right font-semibold">Annual value</th>
                    <th className="px-6 py-3 text-right font-semibold">Net value</th>
                  </tr>
                </thead>
                <tbody>
                  {spendOnlyResults.map(({ card, pointsPerYear, annualValue, netValue }, index) => (
                    <tr key={card.id} className={`border-b border-pm-border/70 last:border-0 ${index === 0 ? 'bg-pm-surface-soft' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-pm-ink-500">#{index + 1}</span>
                          <div>
                            <p className="font-semibold text-pm-ink-900">{card.name}</p>
                            <p className="text-xs text-pm-ink-500">{card.program_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-pm-ink-900">{Math.round(pointsPerYear).toLocaleString()}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-pm-ink-900">{formatCurrencyRounded(annualValue, card.currency)}</td>
                      <td className={`px-6 py-4 text-right tabular-nums font-semibold ${netValue >= 0 ? 'text-pm-success' : 'text-pm-danger'}`}>
                        {netValue >= 0 ? '+' : ''}{formatCurrencyRounded(netValue, card.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showResults && visibleResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="pm-heading text-lg">Your Recommendations</h2>
                <p className="text-xs text-pm-ink-500">
                  Mode: {mode === 'next_best_card' ? 'Best next card' : 'Best long-term value'}
                </p>
              </div>
            </div>
            {visibleResults.map(({
              card,
              confidence,
              explanation,
              status,
              breakdown,
              annualRewardsValue,
              signupValueEligible,
              softBenefitValue,
              softBenefits,
              ongoingValue,
              firstYearValue,
              estimatedMonthsToGoal,
              walletBalance,
              goalCount,
              rank,
            }, i) => (
              <motion.div
                key={card.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={reduceMotion ? undefined : { duration: 0.2, delay: i * 0.05 }}
                className={`rounded-2xl border shadow-sm overflow-hidden ${
                  i === 0 ? 'border-pm-accent-border ring-1 ring-pm-accent-border bg-pm-surface-soft' : 'border-pm-border bg-pm-surface'
                }`}
              >
                <div className="px-6 py-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-pm-ink-500">#{rank}</span>
                        <span className="font-semibold text-pm-ink-900">{card.name}</span>
                        {i === 0 && (
                          <span className="text-xs bg-pm-accent-soft text-pm-accent-strong px-2 py-0.5 rounded-full font-medium border border-pm-accent-border">
                            Top Pick
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          confidence.level === 'high'
                            ? 'bg-pm-success-soft text-pm-success border-pm-border'
                            : confidence.level === 'medium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-pm-surface-soft text-pm-ink-500 border-pm-border'
                        }`}>
                          {confidence.level} confidence
                        </span>
                        {status === 'unknown' && (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                            needs verification
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-pm-ink-500 mt-0.5">{card.issuer} · {card.program_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-pm-success">
                        {firstYearValue >= 0 ? '+' : ''}{formatCurrencyRounded(firstYearValue, card.currency)}
                      </p>
                      <p className="text-xs text-pm-ink-500">{mode === 'next_best_card' ? 'next-card score leader' : 'first-year value'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center text-xs">
                    <div className="bg-pm-surface-soft rounded-xl p-2.5">
                      <p className="text-pm-ink-500 font-medium mb-0.5">Annual rewards</p>
                      <p className="font-bold text-pm-ink-900">{formatCurrencyRounded(annualRewardsValue, card.currency)}</p>
                    </div>
                    <div className="bg-pm-surface-soft rounded-xl p-2.5">
                      <p className="text-pm-ink-500 font-medium mb-0.5">Ongoing value</p>
                      <p className="font-bold text-pm-ink-900">
                        {ongoingValue >= 0 ? '+' : ''}{formatCurrencyRounded(ongoingValue, card.currency)}
                      </p>
                    </div>
                    <div className="bg-pm-surface-soft rounded-xl p-2.5">
                      <p className="text-pm-ink-500 font-medium mb-0.5">Signup bonus</p>
                      <p className="font-bold text-pm-ink-900">
                        {card.signup_bonus_pts > 0
                          ? `${card.signup_bonus_pts.toLocaleString()} pts (${formatCurrencyRounded(signupValueEligible, card.currency)})`
                          : 'None'}
                      </p>
                    </div>
                    <div className="bg-pm-surface-soft rounded-xl p-2.5">
                      <p className="text-pm-ink-500 font-medium mb-0.5">Score drivers</p>
                      <p className="font-bold text-pm-ink-900">
                        {softBenefitValue > 0 ? 'Benefits +' : ''}
                        {goalCount > 0 ? (softBenefitValue > 0 ? ' goals' : 'Goals') : ''}
                        {walletBalance > 0 ? (goalCount > 0 || softBenefitValue > 0 ? ' + wallet' : 'Wallet') : ''}
                        {softBenefitValue === 0 && goalCount === 0 && walletBalance === 0 ? 'Spend + bonus' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl border border-pm-border bg-pm-surface-soft p-3">
                      <p className="text-pm-ink-500 font-medium mb-1">Goal alignment bonus</p>
                      <p className="font-bold text-pm-ink-900">{goalCount > 0 ? formatCurrencyRounded(breakdown.goalAlignmentBonus, card.currency) : '—'}</p>
                    </div>
                    <div className="rounded-xl border border-pm-border bg-pm-surface-soft p-3">
                      <p className="text-pm-ink-500 font-medium mb-1">Wallet synergy</p>
                      <p className="font-bold text-pm-ink-900">
                        {walletBalance > 0
                          ? `${formatCurrencyRounded(breakdown.walletSynergyBonus, card.currency)} · ${Math.round(walletBalance).toLocaleString()} existing pts`
                          : 'No tracked balance match'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-pm-border bg-pm-surface-soft p-3">
                      <p className="text-pm-ink-500 font-medium mb-1">Fee penalty</p>
                      <p className="font-bold text-pm-ink-900">
                        {card.annual_fee_usd === 0
                          ? 'Free'
                          : `${formatCurrencyRounded(card.annual_fee_usd, card.currency)} fee, ${annualFeeTolerance} tolerance`}
                      </p>
                    </div>
                  </div>

                  {softBenefits.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {softBenefits.map((benefit: SoftBenefitType) => (
                        <span
                          key={`${card.id}-${benefit}`}
                          className="text-xs bg-pm-success-soft text-pm-ink-700 border border-pm-border px-2 py-0.5 rounded-full"
                        >
                          {SOFT_BENEFIT_COPY[benefit]}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* K4: Visual indicator for travel goal matching */}
                  {travelGoals.size > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {goalCount > 0 ? (
                        // Card matches selected goals - show which ones
                        <>
                          <span className="text-xs bg-pm-accent-soft text-pm-accent-strong border border-pm-accent-border px-2 py-0.5 rounded-full font-medium">
                            ✓ Excellent for your travel goals
                          </span>
                          {TRAVEL_GOALS.filter(g => travelGoals.has(g.key)).map(goal => (
                            <span key={goal.key} className="text-xs bg-pm-surface-soft text-pm-ink-500 border border-pm-border px-2 py-0.5 rounded-full">
                              {goal.label}
                            </span>
                          ))}
                        </>
                      ) : (
                        // Card doesn't match any goals - show warning
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          Not ideal for your travel goals
                        </span>
                      )}
                    </div>
                  )}

                  {estimatedMonthsToGoal !== null && (
                    <div className="mt-3 rounded-xl border border-pm-border bg-pm-accent-soft px-3 py-2 text-xs text-pm-accent-strong">
                      {estimatedMonthsToGoal === 0
                        ? 'You are already at this card’s target program threshold once the current balance and bonus are counted.'
                        : `Estimated time to your stated points goal: about ${estimatedMonthsToGoal} month${estimatedMonthsToGoal === 1 ? '' : 's'}.`}
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-pm-border bg-pm-surface-soft p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-pm-ink-500 mb-2">Why this card</p>
                      <ul className="space-y-1.5 text-sm text-pm-ink-700">
                        {explanation.whyThisCard.map(line => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-pm-border bg-pm-surface-soft p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-pm-ink-500 mb-2">Assumptions and warnings</p>
                      <ul className="space-y-1.5 text-sm text-pm-ink-700">
                        {[...explanation.assumptions, ...explanation.whyNow, ...explanation.warnings].map(line => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-pm-surface-soft">
                    {safeApplyUrl(card.apply_url) ? (
                      <button
                        type="button"
                        onClick={() => handleApplyClick(card, rank, firstYearValue)}
                        disabled={redirectingCardId === card.id}
                        className="pm-button w-full inline-flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {redirectingCardId === card.id ? 'Opening offer…' : 'Apply Now →'}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="pm-button-secondary w-full opacity-60 cursor-not-allowed"
                      >
                        Offer link unavailable
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {showResults && visibleResults.length === 0 && (
          <div className="pm-card p-8 text-center">
            <p className="text-pm-ink-500 text-sm">
              No cards match your current filters. Try broadening spend categories or resetting travel goals.
            </p>
            <button
              onClick={() => { setTravelGoals(new Set()); setShowResults(false) }}
              className="mt-4 text-sm text-pm-accent hover:underline underline-offset-4"
            >
              Clear goals and try again
            </button>
          </div>
        )}

        {showResults && blockedResults.length > 0 && (
          <div className="pm-card p-6">
            <h3 className="pm-heading text-lg mb-2">Not recommended right now</h3>
            <p className="text-xs text-pm-ink-500 mb-4">These cards were filtered out by ownership or issuer-rule checks.</p>
            <div className="space-y-3">
              {blockedResults.map(result => (
                <div key={result.card.id} className="rounded-xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-pm-ink-900">{result.card.name}</p>
                      <p className="text-xs text-pm-ink-500 mt-1">{result.eligibility.reasons.join(' · ')}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full border bg-pm-surface text-pm-ink-500 border-pm-border">
                      blocked
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showResults && (
          <>
            <button
              onClick={() => setShowResults(false)}
              className="w-full text-sm text-pm-ink-500 hover:text-pm-ink-900 py-2 transition-colors"
            >
              ← Adjust and re-run
            </button>

            <div className="pm-card p-4 bg-pm-surface-soft border-pm-border">
              <p className="text-xs text-pm-ink-500 leading-relaxed">
                PointsMax may earn a commission when you apply for cards through our links.
                This doesn&apos;t affect our rankings, which are based on your spending profile,
                wallet context, issuer-rule filters, and the scoring model above.
              </p>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
