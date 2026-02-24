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

      <section className="border-b border-[#d7e8dd] bg-[rgba(236,246,240,0.52)]">
        <div className="pm-shell py-10">
          <span className="pm-pill mb-3">Card strategy tools {config.flag}</span>
          <h1 className="pm-heading text-3xl mb-2">Earning Calculator</h1>
          <p className="pm-subtle">Enter your monthly spend to see which cards earn the most points for you.</p>
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f978c] text-sm">{spendPrefix}</span>
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
              className="text-sm text-[#0f766e] hover:text-[#0b5e57] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          {loading ? (
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="h-8 w-40 bg-[#e8f1eb] rounded-full animate-pulse" />
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
                        ? 'bg-[#0f766e] text-white border-[#0f766e]'
                        : 'bg-white text-[#365649] border-[#d5e5d9] hover:border-[#99ccbe]'
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
          <div className="pm-card p-4 border border-[#f2c7c5] bg-[#fff4f3]">
            <p className="text-sm text-[#8d2f2b]">{loadError}</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="pm-card-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-[#dbe9e2] flex items-center justify-between">
              <h2 className="pm-heading text-base">Results</h2>
              <p className="text-xs text-[#6a8579]">Ranked by net annual value</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2ece6] text-xs text-[#6a8579] uppercase tracking-wider">
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
                      className={`border-b border-[#edf4ef] last:border-0 ${i === 0 ? 'bg-[#edf9f2]' : 'hover:bg-[#f6fbf8]'} transition-colors`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[#173f34]">{card.name}</span>
                              {i === 0 && (
                                <span className="text-xs bg-[#def4ef] text-[#0f5f57] px-2 py-0.5 rounded-full font-medium border border-[#b8e3da]">
                                  Best for your spending
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[#6a8579]">{card.program_name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-[#244437] tabular-nums">
                        {Math.round(pointsPerYear).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-[#244437] tabular-nums">
                        {formatCurrencyRounded(annualValue, card.currency)}
                      </td>
                      <td className="px-4 py-4 text-right text-[#5f7c70] tabular-nums">
                        {card.annual_fee_usd === 0
                          ? <span className="text-[#157347]">Free</span>
                          : formatCurrencyRounded(card.annual_fee_usd, card.currency)}
                      </td>
                      <td className={`px-6 py-4 text-right font-bold tabular-nums ${netValue >= 0 ? 'text-[#157347]' : 'text-[#b42318]'}`}>
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
          <p className="text-[#5f7c70] text-sm">
            Ready to find your next card?{' '}
            <Link href={`/${regionCode}/card-recommender`} className="text-[#0f766e] hover:underline underline-offset-4 font-medium">
              Try the Card Recommender →
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
