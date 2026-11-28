import { yearlyPointsFromSpend } from '@/lib/card-tools'
import type { Region } from '@/lib/regions'
import type { SpendCategory } from '@/types/database'
import { resolveCppCents } from '@/lib/cpp-fallback'
import { getCanonicalCardSlug } from '@/lib/card-slugs'
import {
  getCatalogCardEarningRates,
  getCatalogCards,
  getCatalogComparisonPages,
  getCatalogLatestValuations,
  getCatalogPrograms,
  getCatalogTransferPartners,
} from '@/lib/catalog'

type ProgramRow = {
  id: string
  name: string
  slug: string
  type: string
  geography: string | null
}

type CardRow = {
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

type EarningRateRow = {
  card_id: string
  category: SpendCategory
  earn_multiplier: number
}

type ValuationRow = {
  program_id: string
  cpp_cents: number
  notes: string | null
}

type CardIdentityRow = Pick<CardRow, 'id' | 'name' | 'issuer'>

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

function geographyForRegion(region: Region): 'US' | 'IN' {
  return region === 'in' ? 'IN' : 'US'
}

function parseBestUses(raw: unknown): string[] {
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

async function listCardsForRegionUncached(region: Region): Promise<ProgrammaticCard[]> {
  const geography = geographyForRegion(region)
  const cardRows = getCatalogCards({ geography })
    .sort((left, right) => left.display_order - right.display_order)
    .map((card) => ({ ...card, image_url: card.image_url ?? null })) as unknown as CardRow[]
  if (cardRows.length === 0) return []

  const cardIds = cardRows.map((card) => card.id)
  const programIds = new Set(cardRows.map((card) => card.program_id))
  const rates = getCatalogCardEarningRates(cardIds)
  const programs = getCatalogPrograms({ includeInactive: true }).filter((program) => programIds.has(program.id))
  const valuations = getCatalogLatestValuations([...programIds])

  const ratesByCardId = new Map<string, EarningRateRow[]>()
  for (const row of ((rates ?? []) as EarningRateRow[])) {
    const list = ratesByCardId.get(row.card_id) ?? []
    list.push(row)
    ratesByCardId.set(row.card_id, list)
  }

  const programById = new Map(((programs ?? []) as ProgramRow[]).map((program) => [program.id, program]))
  const valuationByProgramId = new Map(((valuations ?? []) as ValuationRow[]).map((row) => [row.program_id, row.cpp_cents]))

  const slugByCardId = buildCardSlugById(cardRows)

  return cardRows.map((card) => ({
    ...card,
    slug: slugByCardId.get(card.id) ?? getCanonicalCardSlug(card),
    program: programById.get(card.program_id) ?? null,
    cpp_cents: resolveProgrammaticCppCents(
      valuationByProgramId.get(card.program_id),
      programById.get(card.program_id)?.type,
    ),
    earning_rates: ratesByCardId.get(card.id) ?? [],
  }))
}

export async function listCardsForRegion(region: Region): Promise<ProgrammaticCard[]> {
  return listCardsForRegionUncached(region)
}

export async function getCardBySlug(region: Region, slug: string): Promise<ProgrammaticCard | null> {
  const cards = await listCardsForRegion(region)
  return cards.find((card) => card.slug === slug) ?? null
}

async function listProgramsForRegionUncached(region: Region): Promise<ProgrammaticProgram[]> {
  const geography = geographyForRegion(region)
  const programRows = getCatalogPrograms({ geography })
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name)) as Array<ProgramRow & { best_uses?: unknown }>
  if (programRows.length === 0) return []

  const programIds = programRows.map((program) => program.id)
  const programIdSet = new Set(programIds)
  const valuations = getCatalogLatestValuations(programIds)
  const cards = getCatalogCards({ geography }).filter((card) => programIdSet.has(card.program_id))
  const partners = getCatalogTransferPartners()
    .filter((row) => programIdSet.has(row.from_program_id) || programIdSet.has(row.to_program_id))

  const valuationByProgramId = new Map(((valuations ?? []) as ValuationRow[]).map((row) => [row.program_id, row.cpp_cents]))
  const valuationNotesByProgramId = new Map(((valuations ?? []) as ValuationRow[]).map((row) => [row.program_id, row.notes ?? null]))
  const cardsByProgramId = new Map<string, Array<{ id: string; name: string; slug: string; issuer: string; apply_url: string | null }>>()
  const cardRows = (cards ?? []) as Array<{ id: string; name: string; issuer: string; program_id: string; apply_url: string | null; image_url?: string | null }>
  const slugByCardId = buildCardSlugById(cardRows)
  for (const card of cardRows) {
    const list = cardsByProgramId.get(card.program_id) ?? []
    list.push({
      id: card.id,
      name: card.name,
      slug: slugByCardId.get(card.id) ?? getCanonicalCardSlug(card),
      issuer: card.issuer,
      apply_url: card.apply_url,
    })
    cardsByProgramId.set(card.program_id, list)
  }

  const programNameById = new Map(programRows.map((program) => [program.id, { name: program.name, slug: program.slug }]))

  return programRows.map((program) => {
    const transferOut: ProgrammaticProgram['transfer_out'] = []
    const transferIn: ProgrammaticProgram['transfer_in'] = []
    for (const row of (partners ?? []) as Array<{ from_program_id: string; to_program_id: string; ratio_from: number; ratio_to: number }>) {
      if (!programIds.includes(row.from_program_id) && !programIds.includes(row.to_program_id)) continue
      if (row.from_program_id === program.id) {
        const target = programNameById.get(row.to_program_id)
        if (target) {
          transferOut.push({
            to_program_id: row.to_program_id,
            to_program_name: target.name,
            to_program_slug: target.slug,
            ratio_from: row.ratio_from,
            ratio_to: row.ratio_to,
          })
        }
      }
      if (row.to_program_id === program.id) {
        const source = programNameById.get(row.from_program_id)
        if (source) {
          transferIn.push({
            from_program_id: row.from_program_id,
            from_program_name: source.name,
            from_program_slug: source.slug,
            ratio_from: row.ratio_from,
            ratio_to: row.ratio_to,
          })
        }
      }
    }

    return {
      id: program.id,
      name: program.name,
      slug: program.slug,
      type: program.type,
      geography: program.geography,
      cpp_cents: resolveProgrammaticCppCents(
        valuationByProgramId.get(program.id),
        program.type,
      ),
      valuation_notes: valuationNotesByProgramId.get(program.id) ?? null,
      earning_cards: cardsByProgramId.get(program.id) ?? [],
      transfer_out: transferOut,
      transfer_in: transferIn,
      best_uses: parseBestUses(program.best_uses),
    }
  })
}

export async function listProgramsForRegion(region: Region): Promise<ProgrammaticProgram[]> {
  return listProgramsForRegionUncached(region)
}

export async function getProgramBySlug(region: Region, slug: string): Promise<ProgrammaticProgram | null> {
  const programs = await listProgramsForRegion(region)
  return programs.find((program) => program.slug === slug) ?? null
}

export type ProgrammaticComparisonPage = {
  slug: string
  region: Region
  title: string
  description: string
  cardSlugs: string[]
  categoryFocus: string | null
  displayOrder: number
  href: string
}

export async function listComparisonPagesForRegion(region: Region): Promise<ProgrammaticComparisonPage[]> {
  return getCatalogComparisonPages(region).map((row) => ({
    slug: row.slug,
    region,
    title: row.title,
    description: row.description,
    cardSlugs: row.card_slugs,
    categoryFocus: row.category_focus,
    displayOrder: row.display_order,
    href: `/${region}/cards/compare?cards=${row.card_slugs.join(',')}`,
  }))
}

export async function getComparisonPageBySlug(
  region: Region,
  slug: string,
): Promise<ProgrammaticComparisonPage | null> {
  const pages = await listComparisonPagesForRegion(region)
  return pages.find((page) => page.slug === slug) ?? null
}

export async function getComparisonPagesForCard(
  cardSlug: string,
  region: Region,
): Promise<ProgrammaticComparisonPage[]> {
  const pages = await listComparisonPagesForRegion(region)
  return pages.filter((page) => page.cardSlugs.includes(cardSlug))
}
