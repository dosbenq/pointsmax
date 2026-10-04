// Pure types and helpers for programmatic (SEO) content.
// Safe to import from client components; the database loaders live in
// programmatic-content.ts.
import { yearlyPointsFromSpend } from '@/lib/card-tools'
import type { Region } from '@/lib/regions'
import type { SpendCategory } from '@/types/database'
import { resolveCppCents } from '@/lib/cpp-fallback'
import { getCanonicalCardSlug } from '@/lib/card-slugs'

export type ProgramRow = {
  id: string
  name: string
  slug: string
  type: string
  geography: string | null
}

export type CardRow = {
  id: string
  name: string
  issuer: string
  image_url: string | null
  annual_fee_usd: number
  currency: string
  earn_unit: string
  geography: string
  signup_bonus_pts: number
  signup_bonus_spend: number
  program_id: string
  apply_url: string | null
  display_order: number
  expert_summary: string | null
}

export type EarningRateRow = {
  card_id: string
  category: SpendCategory
  earn_multiplier: number
}

export type ValuationRow = {
  program_id: string
  cpp_cents: number
  notes: string | null
}

export type CardIdentityRow = Pick<CardRow, 'id' | 'name' | 'issuer'>

export type ComparisonPageRow = {
  slug: string
  region: string
  title: string
  description: string
  card_slugs: string[]
  category_focus: string | null
  is_published: boolean
  display_order: number
}

export function resolveProgrammaticCppCents(cppCents: number | undefined, programType: string | undefined): number {
  return resolveCppCents(cppCents, programType)
}

export type ProgrammaticCard = CardRow & {
  slug: string
  program: ProgramRow | null
  cpp_cents: number
  earning_rates: EarningRateRow[]
}

export type ProgrammaticProgram = ProgramRow & {
  cpp_cents: number
  valuation_notes: string | null
  earning_cards: Array<{ id: string; name: string; slug: string; issuer: string; apply_url: string | null }>
  transfer_out: Array<{ to_program_id: string; to_program_name: string; to_program_slug: string; ratio_from: number; ratio_to: number }>
  transfer_in: Array<{ from_program_id: string; from_program_name: string; from_program_slug: string; ratio_from: number; ratio_to: number }>
  best_uses: string[]
}

function buildCardSlug(card: CardIdentityRow, used = new Set<string>()): string {
  const base = getCanonicalCardSlug(card)
  if (!used.has(base)) {
    used.add(base)
    return base
  }

  const idSuffix = card.id.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(-6)
  const withId = `${base}-${idSuffix}`
  used.add(withId)
  return withId
}

export function buildCardSlugById(cards: CardIdentityRow[]): Map<string, string> {
  const used = new Set<string>()
  return new Map(cards.map((card) => [card.id, buildCardSlug(card, used)]))
}

export function geographyForRegion(region: Region): 'US' | 'IN' {
  return region === 'in' ? 'IN' : 'US'
}

export function parseBestUses(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  }
  return []
}

export function estimateEffectiveCashbackPct(card: ProgrammaticCard): number {
  const cpp = Number(card.cpp_cents) / 100
  if (!Number.isFinite(cpp) || cpp <= 0) return 0
  const baselineRate =
    card.earning_rates.find((row) => row.category === 'other')?.earn_multiplier ??
    Math.max(...card.earning_rates.map((row) => Number(row.earn_multiplier) || 0), 0)
  if (!Number.isFinite(baselineRate) || baselineRate <= 0) return 0
  const yearly = yearlyPointsFromSpend({
    monthlySpend: card.earn_unit === '100_inr' ? 100 : 1,
    earnMultiplier: baselineRate,
    earnUnit: card.earn_unit,
  })
  const value = yearly * cpp
  const spend = card.earn_unit === '100_inr' ? 1200 : 12
  return (value / spend) * 100
}
