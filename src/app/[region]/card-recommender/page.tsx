'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import type { CardWithRates, SpendCategory } from '@/types/database'
import {
  CATEGORIES,
  formatCurrencyRounded,
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

type SpendInputs = Record<SpendCategory, string>

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
      .filter(c => !ownedCards.has(c.id))
      .map(card => {
        const pointsPerYear = CATEGORIES.reduce((sum, { key }) => {
          const monthly = parseFloat(spend[key].replace(/,/g, '')) || 0
          return sum + yearlyPointsFromSpend({
            monthlySpend: monthly,
            earnMultiplier: card.earning_rates[key] ?? 1,
            earnUnit: card.earn_unit,
          })
        }, 0)
        const annualValue = (pointsPerYear * card.cpp_cents) / 100
        const signupValue = (card.signup_bonus_pts * card.cpp_cents) / 100
        const firstYearValue = annualValue + signupValue - card.annual_fee_usd
        const goalCount = goalMatchScore(card, travelGoals, config.programGoalMap)
        const finalScore = firstYearValue * (1 + 0.1 * goalCount)
        return { card, pointsPerYear, annualValue, signupValue, firstYearValue, goalCount, finalScore }
      })
      .sort((a, b) => b.finalScore - a.finalScore)
  }, [cards, ownedCards, spend, travelGoals, showResults, config.programGoalMap])

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

      <section className="border-b border-[#d7e8dd] bg-[rgba(236,246,240,0.52)]">
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
            {CATEGORIES.map(({ key, label, icon }) => (
              <div key={key}>
                <label className="pm-label block mb-1.5">
                  {icon} {label}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f978c] text-sm">{spendPrefix}</span>
                  <input
                    type="number"
                    min="0"
                    value={spend[key]}
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
          <p className="text-xs text-[#6a8579] mb-4">Select all that apply. We&apos;ll boost cards that best match your goals.</p>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_GOALS.map(goal => {
              const active = travelGoals.has(goal.key)
              return (
                <button
                  key={goal.key}
                  onClick={() => toggleGoal(goal.key)}
                  className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                    active
                      ? 'bg-[#0f766e] text-white border-[#0f766e]'
                      : 'bg-white text-[#365649] border-[#d5e5d9] hover:border-[#99ccbe]'
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
            <p className="text-xs text-[#6a8579] mb-4">We&apos;ll exclude these from recommendations.</p>
            <div className="flex flex-wrap gap-2">
              {cards.map(card => {
                const owned = ownedCards.has(card.id)
                return (
                  <button
                    key={card.id}
                  onClick={() => toggleOwned(card.id)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    owned
                      ? 'bg-[#e7f1ea] text-[#5f7c70] border-[#d5e5d9] line-through'
                      : 'bg-white text-[#365649] border-[#d5e5d9] hover:border-[#99ccbe]'
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
          <div className="pm-card p-4 border border-[#f2c7c5] bg-[#fff4f3]">
            <p className="text-sm text-[#8d2f2b]">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-[#7a1e16] underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {showResults && results.length > 0 && (
          <div className="space-y-4">
            <h2 className="pm-heading text-lg">Your Recommendations</h2>
            {results.map(({ card, annualValue, signupValue, firstYearValue, goalCount }, i) => (
              <motion.div
                key={card.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={reduceMotion ? undefined : { duration: 0.2, delay: i * 0.05 }}
                className={`rounded-2xl border shadow-sm overflow-hidden ${
                  i === 0 ? 'border-[#8ed3c8] ring-1 ring-[#b8e3da] bg-[#f7fcf9]' : 'border-[#d5e5d9] bg-white'
                }`}
              >
                <div className="px-6 py-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#8ea599]">#{i + 1}</span>
                        <span className="font-semibold text-[#173f34]">{card.name}</span>
                        {i === 0 && (
                          <span className="text-xs bg-[#def4ef] text-[#0f5f57] px-2 py-0.5 rounded-full font-medium border border-[#b8e3da]">
                            Top Pick
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6a8579] mt-0.5">{card.issuer} · {card.program_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-[#157347]">
                        {firstYearValue >= 0 ? '+' : ''}{formatCurrencyRounded(firstYearValue, card.currency)}
                      </p>
                      <p className="text-xs text-[#6a8579]">first-year value</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-[#f4faf7] rounded-xl p-2.5">
                      <p className="text-[#6a8579] font-medium mb-0.5">Annual value</p>
                      <p className="font-bold text-[#244437]">{formatCurrencyRounded(annualValue, card.currency)}</p>
                    </div>
                    <div className="bg-[#f4faf7] rounded-xl p-2.5">
                      <p className="text-[#6a8579] font-medium mb-0.5">Signup bonus</p>
                      <p className="font-bold text-[#244437]">
                        {card.signup_bonus_pts > 0
                          ? `${card.signup_bonus_pts.toLocaleString()} pts (${formatCurrencyRounded(signupValue, card.currency)})`
                          : 'None'}
                      </p>
                    </div>
                    <div className="bg-[#f4faf7] rounded-xl p-2.5">
                      <p className="text-[#6a8579] font-medium mb-0.5">Annual fee</p>
                      <p className="font-bold text-[#244437]">
                        {card.annual_fee_usd === 0
                          ? <span className="text-[#157347]">Free</span>
                          : formatCurrencyRounded(card.annual_fee_usd, card.currency)}
                      </p>
                    </div>
                  </div>

                  {goalCount > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {TRAVEL_GOALS.filter(g => travelGoals.has(g.key)).map(goal => (
                        <span key={goal.key} className="text-xs bg-[#ecf9f7] text-[#0f5f57] border border-[#b8e3da] px-2 py-0.5 rounded-full">
                          {goal.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-[#e5f0e9]">
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
            <p className="text-[#5f7c70] text-sm">
              No cards match your current filters. Try broadening spend categories or unmarking owned cards.
            </p>
            <button
              onClick={() => { setOwnedCards(new Set()); setShowResults(false) }}
              className="mt-4 text-sm text-[#0f766e] hover:underline underline-offset-4"
            >
              Clear owned cards and try again
            </button>
          </div>
        )}

        {showResults && (
          <>
            <button
              onClick={() => setShowResults(false)}
              className="w-full text-sm text-[#5f7c70] hover:text-[#173f34] py-2 transition-colors"
            >
              ← Adjust and re-run
            </button>

            <div className="pm-card p-4 bg-[#f8fcf9] border-[#dce9e2]">
              <p className="text-xs text-[#5f7c70] leading-relaxed">
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
