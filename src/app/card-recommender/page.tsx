'use client'

import { useState, useEffect, useMemo } from 'react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import type { CardWithRates, SpendCategory } from '@/types/database'
import { CATEGORIES, formatUsdRounded, PROGRAM_GOAL_MAP } from '@/lib/card-tools'

const TRAVEL_GOALS = [
  { key: 'domestic',   label: 'Domestic economy' },
  { key: 'intl_econ',  label: 'International economy' },
  { key: 'intl_biz',   label: 'International business class' },
  { key: 'hotels',     label: 'Hotel nights' },
  { key: 'flex',       label: 'Transferable points flexibility' },
]

type SpendInputs = Record<SpendCategory, string>

function goalMatchScore(card: CardWithRates, goals: Set<string>): number {
  const programGoals = PROGRAM_GOAL_MAP[card.program_slug] ?? []
  let count = 0
  for (const goal of goals) {
    if (programGoals.includes(goal)) {
      count++
    }
  }
  return count
}

export default function CardRecommenderPage() {
  const [cards, setCards] = useState<CardWithRates[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [spend, setSpend] = useState<SpendInputs>({
    dining: '500', groceries: '400', travel: '300',
    gas: '200', streaming: '50', other: '500',
  })
  const [travelGoals, setTravelGoals] = useState<Set<string>>(new Set())
  const [ownedCards, setOwnedCards] = useState<Set<string>>(new Set())
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    fetch('/api/cards')
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
        setLoadError('Unable to load card data right now. Please refresh and try again.')
        setLoading(false)
      })
  }, [])

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
          return sum + monthly * (card.earning_rates[key] ?? 1) * 12
        }, 0)
        const annualValue = (pointsPerYear * card.cpp_cents) / 100
        const signupValue = (card.signup_bonus_pts * card.cpp_cents) / 100
        const firstYearValue = annualValue + signupValue - card.annual_fee_usd
        const goalCount = goalMatchScore(card, travelGoals)
        const finalScore = firstYearValue * (1 + 0.1 * goalCount)
        return { card, pointsPerYear, annualValue, signupValue, firstYearValue, goalCount, finalScore }
      })
      .sort((a, b) => b.finalScore - a.finalScore)
  }, [cards, ownedCards, spend, travelGoals, showResults])

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="border-b border-[#d7e8dd] bg-[rgba(236,246,240,0.52)]">
        <div className="pm-shell py-10">
          <span className="pm-pill mb-3">Card strategy tools</span>
          <h1 className="pm-heading text-3xl mb-2">Card Recommender</h1>
          <p className="pm-subtle">Find your next card based on how you spend and where you want to go.</p>
        </div>
      </section>

      <main className="pm-shell py-8 w-full space-y-6 flex-1">

        <div className="pm-card-soft p-6">
          <h2 className="pm-heading text-lg mb-4">Monthly Spending</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {CATEGORIES.map(({ key, label, icon }) => (
              <div key={key}>
                <label className="pm-label block mb-1.5">
                  {icon} {label}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f978c] text-sm">$</span>
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
          </div>
        )}

        {showResults && results.length > 0 && (
          <div className="space-y-4">
            <h2 className="pm-heading text-lg">Your Recommendations</h2>
            {results.map(({ card, annualValue, signupValue, firstYearValue, goalCount }, i) => (
              <div
                key={card.id}
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
                        {firstYearValue >= 0 ? '+' : ''}{formatUsdRounded(firstYearValue)}
                      </p>
                      <p className="text-xs text-[#6a8579]">first-year value</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-[#f4faf7] rounded-xl p-2.5">
                      <p className="text-[#6a8579] font-medium mb-0.5">Annual value</p>
                      <p className="font-bold text-[#244437]">{formatUsdRounded(annualValue)}</p>
                    </div>
                    <div className="bg-[#f4faf7] rounded-xl p-2.5">
                      <p className="text-[#6a8579] font-medium mb-0.5">Signup bonus</p>
                      <p className="font-bold text-[#244437]">
                        {card.signup_bonus_pts > 0
                          ? `${card.signup_bonus_pts.toLocaleString()} pts (${formatUsdRounded(signupValue)})`
                          : 'None'}
                      </p>
                    </div>
                    <div className="bg-[#f4faf7] rounded-xl p-2.5">
                      <p className="text-[#6a8579] font-medium mb-0.5">Annual fee</p>
                      <p className="font-bold text-[#244437]">
                        {card.annual_fee_usd === 0 ? <span className="text-[#157347]">$0</span> : `$${card.annual_fee_usd}`}
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
                </div>
              </div>
            ))}
          </div>
        )}

        {showResults && results.length === 0 && (
          <div className="pm-card p-8 text-center">
            <p className="text-[#5f7c70] text-sm">No cards to recommend. You already have all of them.</p>
            <button
              onClick={() => { setOwnedCards(new Set()); setShowResults(false) }}
              className="mt-4 text-sm text-[#0f766e] hover:underline underline-offset-4"
            >
              Clear owned cards and try again
            </button>
          </div>
        )}

        {showResults && (
          <button
            onClick={() => setShowResults(false)}
            className="w-full text-sm text-[#5f7c70] hover:text-[#173f34] py-2 transition-colors"
          >
            ← Adjust and re-run
          </button>
        )}
      </main>

      <Footer />
    </div>
  )
}
