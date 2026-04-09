'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { estimateEffectiveCashbackPct, type ProgrammaticCard } from '@/lib/programmatic-content'
import { formatCurrencyRounded, spendUnitLabel, CARD_ART_MAP } from '@/lib/card-tools'

interface CardsClientProps {
  cards: ProgrammaticCard[]
  region: string
}

export function CardsClient({ cards, region }: CardsClientProps) {
  const [search, setSearch] = useState('')
  const [issuerFilter, setIssuerFilter] = useState('')
  const [feeFilter, setFeeFilter] = useState('')

  const issuers = useMemo(() => [...new Set(cards.map(c => c.issuer))].sort(), [cards])

  const filtered = useMemo(() => {
    return cards.filter(card => {
      if (search && !card.name.toLowerCase().includes(search.toLowerCase()) && !card.issuer.toLowerCase().includes(search.toLowerCase())) return false
      if (issuerFilter && card.issuer !== issuerFilter) return false
      if (feeFilter === 'free' && card.annual_fee_usd > 0) return false
      if (feeFilter === 'low' && (card.annual_fee_usd <= 0 || card.annual_fee_usd > 100)) return false
      if (feeFilter === 'mid' && (card.annual_fee_usd <= 100 || card.annual_fee_usd > 400)) return false
      if (feeFilter === 'premium' && card.annual_fee_usd <= 400) return false
      return true
    })
  }, [cards, search, issuerFilter, feeFilter])

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search cards..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 border border-pm-border rounded-xl bg-pm-surface text-pm-ink-700 focus:ring-2 focus:ring-pm-accent focus:outline-none flex-1 min-w-[200px]"
        />
        <select
          value={issuerFilter}
          onChange={e => setIssuerFilter(e.target.value)}
          className="px-4 py-2 border border-pm-border rounded-xl bg-pm-surface text-pm-ink-700"
        >
          <option value="">All Issuers</option>
          {issuers.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select
          value={feeFilter}
          onChange={e => setFeeFilter(e.target.value)}
          className="px-4 py-2 border border-pm-border rounded-xl bg-pm-surface text-pm-ink-700"
        >
          <option value="">Any Fee</option>
          <option value="free">No Fee</option>
          <option value="low">Under $100</option>
          <option value="mid">$100-$400</option>
          <option value="premium">$400+</option>
        </select>
      </div>
      <p className="text-sm text-pm-ink-500 mb-4">{filtered.length} cards found</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((card) => {
          const defaultRate =
            card.earning_rates.find((row) => row.category === 'other')?.earn_multiplier ??
            card.earning_rates[0]?.earn_multiplier ??
            0
          const modeledReturn = estimateEffectiveCashbackPct(card)

          return (
            <Link key={card.id} href={`/${region}/cards/${card.slug}`} className="pm-card-soft p-5 hover:shadow-md transition-shadow">
              <div className="mb-4 overflow-hidden rounded-[18px] border border-pm-border bg-white/80">
                {(CARD_ART_MAP[card.name] || card.image_url) ? (
                  <Image
                    src={CARD_ART_MAP[card.name] || card.image_url!}
                    alt={`${card.name} card art`}
                    width={640}
                    height={404}
                    className="h-auto w-full"
                  />
                ) : (
                  <div className="aspect-[1.58/1] bg-gradient-to-br from-[#0d2848] to-[#1a7ea3] flex items-center justify-center">
                    <span className="text-white font-bold text-lg text-center px-4">{card.name}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-pm-ink-500">{card.issuer}</p>
                <span className="rounded-full bg-pm-accent-soft px-2.5 py-1 text-[11px] font-semibold text-pm-accent">
                  {modeledReturn > 0 ? `${modeledReturn.toFixed(1)}% modeled` : `${card.cpp_cents.toFixed(2)} cpp`}
                </span>
              </div>
              <h2 className="pm-heading text-lg mt-2">{card.name}</h2>
              <p className="text-sm text-pm-ink-500 mt-2">
                Fee: {formatCurrencyRounded(card.annual_fee_usd, card.currency)}
              </p>
              <p className="text-sm text-pm-ink-500 mt-1">
                Base earn: {Number(defaultRate).toFixed(2)} pts {spendUnitLabel(card.earn_unit, card.currency)}
              </p>
              <p className="text-sm text-pm-ink-500 mt-1">
                Program: {card.program?.name ?? 'Unknown'}
              </p>
              {card.expert_summary && (
                <p className="mt-3 text-sm text-pm-ink-600 leading-relaxed line-clamp-3">
                  {card.expert_summary.slice(0, 120)}...
                </p>
              )}
              <p className="mt-4 text-sm text-pm-ink-700">
                Best next step: review the card, then jump straight into the linked program and booking workflow.
              </p>
            </Link>
          )
        })}
      </div>
    </>
  )
}
