'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import type { CardWithRates, SpendCategory } from '@/types/database'
import {
  formatCurrencyRounded,
  getCategoriesForRegion,
  spendInputPrefix,
  yearlyPointsFromSpend,
} from '@/lib/card-tools'
import { trackEvent } from '@/lib/analytics'
import { REGIONS, type Region } from '@/lib/regions'

const TRAVEL_GOALS = [
  { key: 'domestic',   label: 'Domestic economy' },
  { key: 'intl_econ',  label: 'International economy' },
  { key: 'intl_biz',   label: 'International business class' },
  { key: 'hotels',     label: 'Hotel nights' },
  { key: 'flex',       label: 'Transferable points flexibility' },
]

type SpendInputs = Partial<Record<SpendCategory, string>>

type SoftBenefitType =
  | 'lounge_access'
  | 'golf'
  | 'concierge'
  | 'hotel_status'
  | 'travel_insurance'

const SOFT_BENEFIT_COPY: Record<SoftBenefitType, string> = {
  lounge_access: 'Lounge Access',
  golf: 'Golf',
  concierge: 'Concierge',
  hotel_status: 'Hotel Status',
  travel_insurance: 'Travel Insurance',
}

const SOFT_BENEFIT_VALUES: Record<'US' | 'IN', Record<SoftBenefitType, number>> = {
  US: {
    lounge_access: 500,
    golf: 0,
    concierge: 100,
    hotel_status: 200,
    travel_insurance: 150,
  },
  IN: {
    lounge_access: 20000,
    golf: 15000,
    concierge: 10000,
    hotel_status: 12000,
    travel_insurance: 6000,
  },
}

const CARD_SOFT_BENEFITS: Record<string, SoftBenefitType[]> = {
  // India
  'hdfc infinia': ['lounge_access', 'golf', 'concierge'],
  'amex platinum (india)': ['lounge_access', 'hotel_status', 'concierge'],
  'axis atlas': ['lounge_access', 'travel_insurance'],
  // US
  'amex platinum': ['lounge_access', 'hotel_status', 'concierge'],
  'chase sapphire reserve': ['lounge_access', 'travel_insurance'],
  'capital one venture x': ['lounge_access', 'travel_insurance'],
}

function getSoftBenefits(cardName: string): SoftBenefitType[] {
  return CARD_SOFT_BENEFITS[cardName.trim().toLowerCase()] ?? []
}

function getSoftBenefitAnnualValue(cardName: string, regionCode: Region): number {
  const regionKey = regionCode === 'in' ? 'IN' : 'US'
  return getSoftBenefits(cardName)
    .reduce((sum, benefit) => sum + (SOFT_BENEFIT_VALUES[regionKey][benefit] ?? 0), 0)
}

function goalMatchScore(card: CardWithRates, goals: Set<string>, programGoalMap: Record<string, string[]>): number {
  const programGoals = programGoalMap[card.program_slug] ?? []
  let count = 0
  for (const goal of goals) {
    if (programGoals.includes(goal)) {
      count++
    }
  }
  return count
}

function safeApplyUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

export default function CardRecommenderPage() {
  const params = useParams()
  const regionCode = (params.region as Region) || 'us'
  const config = REGIONS[regionCode]
  const reduceMotion = useReducedMotion()
  const [cards, setCards] = useState<CardWithRates[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [spend, setSpend] = useState<SpendInputs>(config.defaultSpend as SpendInputs)
  const [travelGoals, setTravelGoals] = useState<Set<string>>(new Set())
  const [ownedCards, setOwnedCards] = useState<Set<string>>(new Set())
  const [showResults, setShowResults] = useState(false)
  const [redirectingCardId, setRedirectingCardId] = useState<string | null>(null)
  const categories = useMemo(() => getCategoriesForRegion(regionCode), [regionCode])

  // Reset spend when region changes
  useEffect(() => {
    setSpend(config.defaultSpend as SpendInputs)
  }, [config.defaultSpend])

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

  const spendPrefix = spendInputPrefix(config.currency)

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

  const results = useMemo(() => {
    if (!showResults) return []
    return cards
      .map(card => {
        const pointsPerYear = categories.reduce((sum, { key }) => {
          const monthly = parseFloat((spend[key] ?? '0').replace(/,/g, '')) || 0
          return sum + yearlyPointsFromSpend({
            monthlySpend: monthly,
            earnMultiplier: key === 'shopping'
              ? (card.earning_rates.shopping ?? card.earning_rates.other ?? 1)
              : (card.earning_rates[key] ?? 1),
            earnUnit: card.earn_unit,
          })
        }, 0)
        const annualRewardsValue = (pointsPerYear * card.cpp_cents) / 100
        const signupValue = (card.signup_bonus_pts * card.cpp_cents) / 100
        const hasCardAlready = ownedCards.has(card.id)
        const signupValueEligible = hasCardAlready ? 0 : signupValue
        const softBenefitValue = getSoftBenefitAnnualValue(card.name, regionCode)
        const firstYearValue = annualRewardsValue + signupValueEligible + softBenefitValue - card.annual_fee_usd
        const goalCount = goalMatchScore(card, travelGoals, config.programGoalMap)
        // K4: Heavy penalty/boost based on travel goal matching
        let finalScore: number
        if (travelGoals.size > 0) {
          const hasAnyMatch = goalCount > 0
          if (!hasAnyMatch) {
            // Card doesn't serve this goal at all — heavy penalty
            finalScore = firstYearValue * 0.3
          } else {
            // Card matches — boost scales with match quality
            finalScore = firstYearValue * (1 + 0.4 * goalCount)
          }
        } else {
          // No goal selected — rank purely by value
          finalScore = firstYearValue
        }
        return {
          card,
          pointsPerYear,
          annualRewardsValue,
          signupValue,
          signupValueEligible,
          softBenefitValue,
          softBenefits: getSoftBenefits(card.name),
          firstYearValue,
          goalCount,
          finalScore,
          hasCardAlready,
        }
      })
      .sort((a, b) => b.finalScore - a.finalScore)
  }, [cards, ownedCards, spend, travelGoals, showResults, config.programGoalMap, categories, regionCode])

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
      })
      trackEvent('card_apply_clicked', {
        card_name: card.name,
        rank,
        first_year_value: Math.round(firstYearValue),
        region: regionCode,
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

      <section className="border-b border-pm-border bg-pm-surface-soft/50">
        <div className="pm-shell py-10">
          <span className="pm-pill mb-3">Card strategy tools {config.flag}</span>
          <h1 className="pm-heading text-3xl mb-2">Card Recommender</h1>
          <p className="pm-subtle">Find your next card based on how you spend and where you want to go.</p>
        </div>
      </section>

      <main className="pm-shell py-8 w-full space-y-6 flex-1">

        <div className="pm-card-soft p-6">
          <h2 className="pm-heading text-lg mb-4">Monthly Spending ({config.id.toUpperCase()})</h2>
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
          <h2 className="pm-heading text-lg mb-1">Travel Goals</h2>
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

        {!loading && (
          <div className="pm-card p-6">
            <h2 className="pm-heading text-lg mb-1">Cards You Already Have</h2>
            <p className="text-xs text-pm-ink-500 mb-4">We&apos;ll keep them visible, but remove signup bonus value from scoring.</p>
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

        <button
          onClick={() => setShowResults(true)}
          disabled={loading || !!loadError}
          className="pm-button w-full"
        >
          Find My Best Card →
        </button>

        {loadError && (
          <div className="pm-card p-4 border border-pm-danger-border bg-pm-danger-soft">
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

        {showResults && results.length > 0 && (
          <div className="space-y-4">
            <h2 className="pm-heading text-lg">Your Recommendations</h2>
            {results.map(({
              card,
              annualRewardsValue,
              signupValue,
              signupValueEligible,
              softBenefitValue,
              softBenefits,
              firstYearValue,
              goalCount,
              hasCardAlready,
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
                        <span className="text-xs font-bold text-pm-ink-500">#{i + 1}</span>
                        <span className="font-semibold text-pm-ink-900">{card.name}</span>
                        {i === 0 && (
                          <span className="text-xs bg-pm-accent-soft text-pm-accent-strong px-2 py-0.5 rounded-full font-medium border border-pm-accent-border">
                            Top Pick
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-pm-ink-500 mt-0.5">{card.issuer} · {card.program_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-pm-success">
                        {firstYearValue >= 0 ? '+' : ''}{formatCurrencyRounded(firstYearValue, card.currency)}
                      </p>
                      <p className="text-xs text-pm-ink-500">first-year value</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="inline-flex items-center gap-2 text-xs text-pm-ink-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasCardAlready}
                        onChange={() => toggleOwned(card.id)}
                        className="h-3.5 w-3.5 rounded border-pm-border text-pm-accent focus:ring-pm-accent"
                      />
                      Already have this card (exclude signup bonus)
                    </label>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center text-xs">
                    <div className="bg-pm-surface-soft rounded-xl p-2.5">
                      <p className="text-pm-ink-500 font-medium mb-0.5">Annual rewards</p>
                      <p className="font-bold text-pm-ink-900">{formatCurrencyRounded(annualRewardsValue, card.currency)}</p>
                    </div>
                    <div className="bg-pm-surface-soft rounded-xl p-2.5">
                      <p className="text-pm-ink-500 font-medium mb-0.5">Signup bonus</p>
                      <p className="font-bold text-pm-ink-900">
                        {card.signup_bonus_pts > 0
                          ? hasCardAlready
                            ? `Already held (was ${formatCurrencyRounded(signupValue, card.currency)})`
                            : `${card.signup_bonus_pts.toLocaleString()} pts (${formatCurrencyRounded(signupValueEligible, card.currency)})`
                          : 'None'}
                      </p>
                    </div>
                    <div className="bg-pm-surface-soft rounded-xl p-2.5">
                      <p className="text-pm-ink-500 font-medium mb-0.5">Soft benefits</p>
                      <p className="font-bold text-pm-ink-900">
                        {softBenefitValue > 0 ? formatCurrencyRounded(softBenefitValue, card.currency) : '—'}
                      </p>
                    </div>
                    <div className="bg-pm-surface-soft rounded-xl p-2.5">
                      <p className="text-pm-ink-500 font-medium mb-0.5">Annual fee</p>
                      <p className="font-bold text-pm-ink-900">
                        {card.annual_fee_usd === 0
                          ? <span className="text-pm-success">Free</span>
                          : formatCurrencyRounded(card.annual_fee_usd, card.currency)}
                      </p>
                    </div>
                  </div>

                  {softBenefits.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {softBenefits.map((benefit) => (
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

                  <div className="mt-4 pt-4 border-t border-pm-surface-soft">
                    {safeApplyUrl(card.apply_url) ? (
                      <button
                        type="button"
                        onClick={() => handleApplyClick(card, i + 1, firstYearValue)}
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

        {showResults && results.length === 0 && (
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
                This doesn&apos;t affect our rankings, which are based solely on your spending profile.
              </p>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
