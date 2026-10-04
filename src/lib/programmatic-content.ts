import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import { getDb, hasDatabaseUrl } from '@/lib/db/client'
import {
  cardEarningRates,
  cards as cardsTable,
  comparisonPages,
  latestValuations,
  programs as programsTable,
  transferPartners,
} from '@/lib/db/schema'
import type { Region } from '@/lib/regions'
import { unstable_cache } from 'next/cache'
import { getCanonicalCardSlug } from '@/lib/card-slugs'
import {
  buildCardSlugById,
  geographyForRegion,
  parseBestUses,
  resolveProgrammaticCppCents,
  type CardRow,
  type ComparisonPageRow,
  type EarningRateRow,
  type ProgrammaticCard,
  type ProgrammaticProgram,
  type ProgramRow,
  type ValuationRow,
} from '@/lib/programmatic-content-shared'

export * from '@/lib/programmatic-content-shared'

async function listCardsForRegionUncached(region: Region): Promise<ProgrammaticCard[]> {
  if (!hasDatabaseUrl()) return []
  const db = getDb()
  const geography = geographyForRegion(region)

  let cardRows: CardRow[]
  let rates: EarningRateRow[]
  let programRows: ProgramRow[]
  let valuations: ValuationRow[]
  try {
    cardRows = await db
      .select({
        id: cardsTable.id,
        name: cardsTable.name,
        issuer: cardsTable.issuer,
        image_url: cardsTable.imageUrl,
        annual_fee_usd: cardsTable.annualFeeUsd,
        currency: cardsTable.currency,
        earn_unit: cardsTable.earnUnit,
        geography: cardsTable.geography,
        signup_bonus_pts: cardsTable.signupBonusPts,
        signup_bonus_spend: cardsTable.signupBonusSpend,
        program_id: cardsTable.programId,
        apply_url: cardsTable.applyUrl,
        display_order: cardsTable.displayOrder,
        expert_summary: cardsTable.expertSummary,
      })
      .from(cardsTable)
      .where(and(eq(cardsTable.isActive, true), eq(cardsTable.geography, geography)))
      .orderBy(asc(cardsTable.displayOrder)) as CardRow[]
    if (cardRows.length === 0) return []

    const cardIds = cardRows.map((card) => card.id)
    const programIds = [...new Set(cardRows.map((card) => card.program_id))]
    ;[rates, programRows, valuations] = await Promise.all([
      db.select({
        card_id: cardEarningRates.cardId,
        category: cardEarningRates.category,
        earn_multiplier: cardEarningRates.earnMultiplier,
      }).from(cardEarningRates).where(inArray(cardEarningRates.cardId, cardIds)).then((rows) => rows as unknown as EarningRateRow[]),
      db.select({
        id: programsTable.id,
        name: programsTable.name,
        slug: programsTable.slug,
        type: programsTable.type,
        geography: programsTable.geography,
      }).from(programsTable).where(inArray(programsTable.id, programIds)).then((rows) => rows as unknown as ProgramRow[]),
      db.select({
        program_id: latestValuations.programId,
        cpp_cents: latestValuations.cppCents,
      }).from(latestValuations).where(inArray(latestValuations.programId, programIds)).then((rows) => rows as unknown as ValuationRow[]),
    ])
  } catch {
    return []
  }

  const ratesByCardId = new Map<string, EarningRateRow[]>()
  for (const row of rates) {
    const list = ratesByCardId.get(row.card_id) ?? []
    list.push(row)
    ratesByCardId.set(row.card_id, list)
  }

  const programById = new Map(programRows.map((program) => [program.id, program]))
  const valuationByProgramId = new Map(valuations.map((row) => [row.program_id, row.cpp_cents]))

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

const listCardsForRegionCached = unstable_cache(
  async (region: Region) => listCardsForRegionUncached(region),
  ['programmatic-cards-v1'],
  {
    revalidate: 3600,
    tags: ['programmatic-cards', 'valuations'],
  },
)

export async function listCardsForRegion(region: Region): Promise<ProgrammaticCard[]> {
  return listCardsForRegionCached(region)
}

export async function getCardBySlug(region: Region, slug: string): Promise<ProgrammaticCard | null> {
  const cards = await listCardsForRegion(region)
  return cards.find((card) => card.slug === slug) ?? null
}

async function listProgramsForRegionUncached(region: Region): Promise<ProgrammaticProgram[]> {
  if (!hasDatabaseUrl()) return []
  const db = getDb()
  const geography = geographyForRegion(region)

  let programRows: Array<ProgramRow & { best_uses?: unknown }>
  let programIds: string[]
  let valuations: ValuationRow[]
  let cards: Array<{ id: string; name: string; issuer: string; program_id: string; apply_url: string | null; geography: string }>
  let partners: Array<{ from_program_id: string; to_program_id: string; ratio_from: number; ratio_to: number }>
  try {
    programRows = await db
      .select({
        id: programsTable.id,
        name: programsTable.name,
        slug: programsTable.slug,
        type: programsTable.type,
        geography: programsTable.geography,
        best_uses: programsTable.bestUses,
      })
      .from(programsTable)
      .where(and(
        eq(programsTable.isActive, true),
        or(isNull(programsTable.geography), eq(programsTable.geography, geography), eq(programsTable.geography, 'global')),
      ))
      .orderBy(asc(programsTable.name)) as Array<ProgramRow & { best_uses?: unknown }>
    if (programRows.length === 0) return []

    programIds = programRows.map((program) => program.id)
    ;[valuations, cards, partners] = await Promise.all([
      db.select({
        program_id: latestValuations.programId,
        cpp_cents: latestValuations.cppCents,
        notes: latestValuations.notes,
      }).from(latestValuations).where(inArray(latestValuations.programId, programIds)).then((rows) => rows as unknown as ValuationRow[]),
      db.select({
        id: cardsTable.id,
        name: cardsTable.name,
        issuer: cardsTable.issuer,
        program_id: cardsTable.programId,
        apply_url: cardsTable.applyUrl,
        geography: cardsTable.geography,
      }).from(cardsTable).where(and(
        eq(cardsTable.isActive, true),
        eq(cardsTable.geography, geography),
        inArray(cardsTable.programId, programIds),
      )),
      db.select({
        from_program_id: transferPartners.fromProgramId,
        to_program_id: transferPartners.toProgramId,
        ratio_from: transferPartners.ratioFrom,
        ratio_to: transferPartners.ratioTo,
      }).from(transferPartners).where(and(
        eq(transferPartners.isActive, true),
        or(inArray(transferPartners.fromProgramId, programIds), inArray(transferPartners.toProgramId, programIds)),
      )),
    ])
  } catch {
    return []
  }

  const valuationByProgramId = new Map(valuations.map((row) => [row.program_id, row.cpp_cents]))
  const valuationNotesByProgramId = new Map(valuations.map((row) => [row.program_id, row.notes ?? null]))
  const cardsByProgramId = new Map<string, Array<{ id: string; name: string; slug: string; issuer: string; apply_url: string | null }>>()
  const cardRows = cards
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
    for (const row of partners) {
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

const listProgramsForRegionCached = unstable_cache(
  async (region: Region) => listProgramsForRegionUncached(region),
  ['programmatic-programs-v1'],
  {
    revalidate: 3600,
    tags: ['programmatic-programs', 'valuations'],
  },
)

export async function listProgramsForRegion(region: Region): Promise<ProgrammaticProgram[]> {
  return listProgramsForRegionCached(region)
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

async function listComparisonPagesForRegionUncached(region: Region): Promise<ProgrammaticComparisonPage[]> {
  if (!hasDatabaseUrl()) return []
  let data: ComparisonPageRow[]
  try {
    data = await getDb()
      .select({
        slug: comparisonPages.slug,
        region: comparisonPages.region,
        title: comparisonPages.title,
        description: comparisonPages.description,
        card_slugs: comparisonPages.cardSlugs,
        category_focus: comparisonPages.categoryFocus,
        is_published: comparisonPages.isPublished,
        display_order: comparisonPages.displayOrder,
      })
      .from(comparisonPages)
      .where(and(eq(comparisonPages.region, region), eq(comparisonPages.isPublished, true)))
      .orderBy(asc(comparisonPages.displayOrder)) as ComparisonPageRow[]
  } catch {
    return []
  }

  return data.map((row) => ({
    slug: row.slug,
    region,
    title: row.title,
    description: row.description,
    cardSlugs: Array.isArray(row.card_slugs) ? row.card_slugs.filter((value): value is string => typeof value === 'string') : [],
    categoryFocus: row.category_focus,
    displayOrder: row.display_order,
    href: `/${region}/cards/compare?cards=${Array.isArray(row.card_slugs) ? row.card_slugs.join(',') : ''}`,
  }))
}

const listComparisonPagesForRegionCached = unstable_cache(
  async (region: Region) => listComparisonPagesForRegionUncached(region),
  ['programmatic-comparison-pages-v1'],
  {
    revalidate: 3600,
    tags: ['programmatic-comparison-pages'],
  },
)

export async function listComparisonPagesForRegion(region: Region): Promise<ProgrammaticComparisonPage[]> {
  return listComparisonPagesForRegionCached(region)
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
