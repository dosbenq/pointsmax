'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSpendOnlyRanking } from '@/features/card-recommender'
import { formatCurrencyRounded, getCategoriesForRegion, spendInputPrefix } from '@/lib/card-tools'
import { REGIONS, type Region } from '@/lib/regions'
import type { CardWithRates, SpendCategory } from '@/types/database'

type SpendInputs = Partial<Record<SpendCategory, string>>

function sanitizeNumericInput(value: string): string {
  return value.replace(/[^\d]/g, '')
}

export function EarningCalculatorClient({ region }: { region: Region }) {
  const config = REGIONS[region]
  const categories = getCategoriesForRegion(region)
  const prefix = spendInputPrefix(config.currency)
  const [cards, setCards] = useState<CardWithRates[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [spend, setSpend] = useState<SpendInputs>(config.defaultSpend as SpendInputs)

  useEffect(() => {
    setSpend(config.defaultSpend as SpendInputs)
  }, [config.defaultSpend])

  useEffect(() => {
    let active = true

    async function loadCards() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/cards?geography=${encodeURIComponent(region.toUpperCase())}`)
        if (!response.ok) {
          throw new Error(`Failed to load cards (${response.status})`)
        }
        const payload = await response.json()
        if (!active) return
        setCards(Array.isArray(payload.cards) ? payload.cards : [])
      } catch {
        if (!active) return
        setCards([])
        setError('Unable to load card data right now.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadCards()
    return () => {
      active = false
    }
  }, [region])

  const results = useSpendOnlyRanking({
    cards,
    spend,
    regionCode: region,
    enabled: cards.length > 0,
    limit: 10,
  })

  const totalMonthlySpend = useMemo(
    () => categories.reduce((sum, category) => sum + (Number.parseInt(spend[category.key] ?? '0', 10) || 0), 0),
    [categories, spend],
  )

  return (
    <div className="min-h-screen bg-pm-bg">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="pm-label text-pm-accent">Standalone earning tool</p>
          <h1 className="pm-display mt-3 text-4xl text-pm-ink-900 sm:text-5xl">
            Earning Calculator
          </h1>
          <p className="mt-4 text-base text-pm-ink-500 sm:text-lg">
            Enter your monthly spend once and see which cards generate the most annual points value for your wallet.
          </p>
        </div>

        <section className="mt-10 rounded-[28px] border border-pm-border bg-pm-surface p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="pm-label">Monthly spend</p>
              <p className="mt-1 text-sm text-pm-ink-500">
                Adjust the categories below. Results update automatically.
              </p>
            </div>
            <div className="rounded-full border border-pm-border bg-pm-surface-soft px-4 py-2 text-sm text-pm-ink-700">
              Total monthly spend: <span className="font-semibold">{formatCurrencyRounded(totalMonthlySpend, config.currency)}</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <label key={category.key} className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-4">
                <div className="flex items-center justify-between text-sm text-pm-ink-700">
                  <span>{category.label}</span>
                  <span>{category.icon}</span>
                </div>
                <div className="mt-3 flex items-center rounded-xl border border-pm-border bg-pm-surface px-3">
                  <span className="text-sm text-pm-ink-500">{prefix}</span>
                  <input
                    value={spend[category.key] ?? ''}
                    onChange={(event) => {
                      const next = sanitizeNumericInput(event.target.value)
                      setSpend((current) => ({ ...current, [category.key]: next }))
                    }}
                    inputMode="numeric"
                    className="w-full bg-transparent px-2 py-3 text-base text-pm-ink-900 outline-none"
                    placeholder="0"
                  />
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border border-pm-border bg-pm-surface p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="pm-label">Top cards by annual earning value</p>
              <p className="mt-1 text-sm text-pm-ink-500">
                Rankings are based on ongoing annual points value minus the annual fee.
              </p>
            </div>
          </div>

          {loading && <p className="mt-6 text-sm text-pm-ink-500">Loading card data…</p>}
          {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="mt-6 text-sm text-pm-ink-500">No cards are available for this region yet.</p>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-pm-border text-sm">
                <thead>
                  <tr className="text-left text-pm-ink-500">
                    <th className="py-3 pr-4 font-medium">Card</th>
                    <th className="py-3 pr-4 font-medium">Issuer</th>
                    <th className="py-3 pr-4 font-medium">Annual points</th>
                    <th className="py-3 pr-4 font-medium">Estimated value</th>
                    <th className="py-3 pr-4 font-medium">Annual fee</th>
                    <th className="py-3 font-medium">Net value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pm-border">
                  {results.map(({ card, pointsPerYear, annualValue, netValue }) => (
                    <tr key={card.id}>
                      <td className="py-4 pr-4">
                        <Link href={`/${region}/cards/${card.id}`} className="font-medium text-pm-ink-900 hover:text-pm-accent">
                          {card.name}
                        </Link>
                        <p className="mt-1 text-xs text-pm-ink-500">{card.program_name}</p>
                      </td>
                      <td className="py-4 pr-4 text-pm-ink-700">{card.issuer}</td>
                      <td className="py-4 pr-4 text-pm-ink-700">{Math.round(pointsPerYear).toLocaleString()}</td>
                      <td className="py-4 pr-4 text-pm-ink-700">{formatCurrencyRounded(annualValue, card.currency)}</td>
                      <td className="py-4 pr-4 text-pm-ink-700">{formatCurrencyRounded(card.annual_fee_usd, card.currency)}</td>
                      <td className={`py-4 font-medium ${netValue >= 0 ? 'text-pm-success-strong' : 'text-pm-ink-900'}`}>
                        {formatCurrencyRounded(netValue, card.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
