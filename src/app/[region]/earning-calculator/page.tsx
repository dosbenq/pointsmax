'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import type { CardWithRates, SpendCategory } from '@/types/database'
import {
  formatCurrencyRounded,
  getCategoriesForRegion,
  spendInputPrefix,
  yearlyPointsFromSpend,
} from '@/lib/card-tools'
import { REGIONS, type Region } from '@/lib/regions'

type SpendInputs = Partial<Record<SpendCategory, string>>

export default function EarningCalculatorPage() {
  const params = useParams()
  const regionCode = (params.region as Region) || 'us'
  const config = REGIONS[regionCode]
  const [cards, setCards] = useState<CardWithRates[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [spend, setSpend] = useState<SpendInputs>(config.defaultSpend as SpendInputs)
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [allSelected, setAllSelected] = useState(true)
  const categories = useMemo(() => getCategoriesForRegion(regionCode), [regionCode])

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
        setSelectedCards(new Set((data ?? []).map(c => c.id)))
        setLoadError(null)
        setLoading(false)
      })
      .catch(() => {
        setCards([])
        setSelectedCards(new Set())
        setLoadError('Unable to load card data right now. Please refresh and try again.')
        setLoading(false)
      })
  }, [regionCode])

  const spendPrefix = spendInputPrefix(config.currency)

  const toggleCard = (id: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setAllSelected(next.size === cards.length)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedCards(new Set())
      setAllSelected(false)
    } else {
      setSelectedCards(new Set(cards.map(c => c.id)))
      setAllSelected(true)
    }
  }

  const results = useMemo(() => {
    return cards
        .filter(c => selectedCards.has(c.id))
      .map(card => {
        const pointsPerYear = categories.reduce((sum, { key }) => {
          const monthly = parseFloat((spend[key] ?? '0').replace(/,/g, '')) || 0
          const multiplier = key === 'shopping'
            ? (card.earning_rates.shopping ?? card.earning_rates.other ?? 1)
            : (card.earning_rates[key] ?? 1)
          return sum + yearlyPointsFromSpend({
            monthlySpend: monthly,
            earnMultiplier: multiplier,
            earnUnit: card.earn_unit,
          })
        }, 0)
        const annualValue = (pointsPerYear * card.cpp_cents) / 100
        const netValue = annualValue - card.annual_fee_usd
        return { card, pointsPerYear, annualValue, netValue }
      })
      .sort((a, b) => b.netValue - a.netValue)
  }, [cards, selectedCards, spend, categories])

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <span className="pm-pill mb-4 inline-block">Card strategy {config.flag}</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-3">Maximize your earning</h1>
          <p className="pm-subtle max-w-xl text-base">Enter your monthly spend to see which cards earn the most points for your categories.</p>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="pm-heading text-lg">Compare Cards</h2>
            <button
              onClick={toggleAll}
              disabled={loading || !!loadError}
              className="text-sm text-pm-accent hover:text-pm-accent-strong font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          {loading ? (
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="h-8 w-40 bg-pm-surface-soft rounded-full animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cards.map(card => {
                const checked = selectedCards.has(card.id)
                return (
                  <button
                    key={card.id}
                    onClick={() => toggleCard(card.id)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                      checked
                        ? 'bg-pm-accent text-pm-bg border-pm-accent'
                        : 'bg-pm-surface text-pm-ink-700 border-pm-border hover:border-pm-accent-border'
                    }`}
                  >
                    {card.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {loadError && (
          <div className="pm-card p-4 border border-pm-danger-border bg-pm-danger-soft">
            <p className="text-sm text-pm-danger">{loadError}</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="pm-card-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-pm-border flex items-center justify-between">
              <h2 className="pm-heading text-base">Results</h2>
              <p className="text-xs text-pm-ink-500">Ranked by net annual value</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pm-border text-xs text-pm-ink-500 uppercase tracking-wider">
                    <th className="text-left px-6 py-3 font-semibold">Card</th>
                    <th className="text-right px-4 py-3 font-semibold">Annual pts</th>
                    <th className="text-right px-4 py-3 font-semibold">Annual value</th>
                    <th className="text-right px-4 py-3 font-semibold">Annual fee</th>
                    <th className="text-right px-6 py-3 font-semibold">Net value</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(({ card, pointsPerYear, annualValue, netValue }, i) => (
                    <tr
                      key={card.id}
                      className={`border-b border-pm-surface-soft last:border-0 ${i === 0 ? 'bg-pm-success-soft' : 'hover:bg-pm-surface-soft'} transition-colors`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-pm-ink-900">{card.name}</span>
                              {i === 0 && (
                                <span className="text-xs bg-pm-accent-soft text-pm-accent-strong px-2 py-0.5 rounded-full font-medium border border-pm-accent-border">
                                  Best for your spending
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-pm-ink-500">{card.program_name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-pm-ink-900 tabular-nums">
                        {Math.round(pointsPerYear).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-pm-ink-900 tabular-nums">
                        {formatCurrencyRounded(annualValue, card.currency)}
                      </td>
                      <td className="px-4 py-4 text-right text-pm-ink-500 tabular-nums">
                        {card.annual_fee_usd === 0
                          ? <span className="text-pm-success">Free</span>
                          : formatCurrencyRounded(card.annual_fee_usd, card.currency)}
                      </td>
                      <td className={`px-6 py-4 text-right font-bold tabular-nums ${netValue >= 0 ? 'text-pm-success' : 'text-pm-danger'}`}>
                        {netValue >= 0 ? '+' : ''}{formatCurrencyRounded(netValue, card.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center py-4">
          <p className="text-pm-ink-500 text-sm">
            Ready to find your next card?{' '}
            <Link href={`/${regionCode}/card-recommender`} className="text-pm-accent hover:underline underline-offset-4 font-medium">
              Try the Card Recommender →
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
