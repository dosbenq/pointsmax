import { describe, expect, it } from 'vitest'
import { getCardRouteCandidates } from '@/lib/card-slugs'
import {
  getCatalogBookingUrls,
  getCatalogCardEarningRates,
  getCatalogCards,
  getCatalogComparisonPages,
  getCatalogHotelAwardCharts,
  getCatalogHotelPrograms,
  getCatalogLatestValuations,
  getCatalogProgramById,
  getCatalogPrograms,
  getCatalogRedemptionOptions,
  getCatalogTransferPartners,
} from './index'

const all = { includeInactive: true } as const

function expectUnique(values: string[], label: string) {
  const dupes = values.filter((value, index) => values.indexOf(value) !== index)
  expect(dupes, `duplicate ${label}`).toEqual([])
}

describe('catalog integrity', () => {
  const programs = getCatalogPrograms(all)
  const programIds = new Set(programs.map((program) => program.id))
  const cards = getCatalogCards(all)
  const cardIds = new Set(cards.map((card) => card.id))

  it('has unique ids and slugs', () => {
    expectUnique(programs.map((p) => p.id), 'program ids')
    expectUnique(programs.map((p) => p.slug), 'program slugs')
    expectUnique(cards.map((c) => c.id), 'card ids')
    expectUnique(getCatalogCardEarningRates().map((r) => r.id), 'earning rate ids')
    expectUnique(getCatalogTransferPartners(all).map((t) => t.id), 'transfer partner ids')
    expectUnique(getCatalogRedemptionOptions().map((r) => r.id), 'redemption option ids')
    expectUnique(getCatalogHotelAwardCharts().map((r) => r.id), 'hotel chart ids')
    expectUnique(getCatalogComparisonPages().map((p) => p.slug), 'comparison page slugs')
  })

  it('resolves every reference', () => {
    for (const card of cards) expect(programIds, `card ${card.name}`).toContain(card.program_id)
    for (const rate of getCatalogCardEarningRates()) expect(cardIds, `rate ${rate.id}`).toContain(rate.card_id)
    for (const partner of getCatalogTransferPartners(all)) {
      expect(programIds, `partner ${partner.id} from`).toContain(partner.from_program_id)
      expect(programIds, `partner ${partner.id} to`).toContain(partner.to_program_id)
    }
    for (const option of getCatalogRedemptionOptions()) expect(programIds, `option ${option.label}`).toContain(option.program_id)
    const programSlugs = new Set(programs.map((p) => p.slug))
    for (const link of getCatalogBookingUrls()) expect(programSlugs, `booking url ${link.label}`).toContain(link.program_slug)
    const hotelIds = new Set(getCatalogHotelPrograms().map((p) => p.id))
    for (const row of getCatalogHotelAwardCharts()) expect(hotelIds).toContain(row.program_id)
  })

  it('has exactly one point value per active program, in the right unit', () => {
    const valuations = getCatalogLatestValuations()
    expectUnique(valuations.map((v) => v.program_id), 'valuation program ids')
    expect(valuations).toHaveLength(getCatalogPrograms().length)
    for (const valuation of valuations) {
      const program = getCatalogProgramById(valuation.program_id)!
      // India values are stored in paise per point, everything else in US cents per point.
      if (program.geography === 'IN') {
        expect(valuation.cpp_cents, program.slug).toBeGreaterThanOrEqual(10)
      } else {
        expect(valuation.cpp_cents, program.slug).toBeLessThan(10)
      }
      expect(valuation.cpp_cents, program.slug).toBeGreaterThan(0)
    }
  })

  it('links every comparison page to at least two real cards', () => {
    const candidatesByCard = cards.map((card) => getCardRouteCandidates({
      id: card.id,
      name: card.name,
      issuer: card.issuer,
      program_slug: getCatalogProgramById(card.program_id)?.slug,
    }))
    for (const page of getCatalogComparisonPages()) {
      const resolved = page.card_slugs.filter((slug) => candidatesByCard.some((candidates) => candidates.has(slug)))
      expect(resolved, page.slug).toEqual(page.card_slugs)
      expect(resolved.length, page.slug).toBeGreaterThanOrEqual(2)
    }
  })

  it('filters programs and cards by region, keeping global programs everywhere', () => {
    const us = getCatalogPrograms({ geography: 'US' })
    const india = getCatalogPrograms({ geography: 'IN' })
    expect(us.some((p) => p.slug === 'chase-ur')).toBe(true)
    expect(us.some((p) => p.slug === 'hdfc-millennia')).toBe(false)
    expect(india.some((p) => p.slug === 'hdfc-millennia')).toBe(true)
    expect(india.some((p) => p.slug === 'flying-blue')).toBe(true)
    expect(getCatalogCards({ geography: 'IN' }).every((c) => c.geography === 'IN')).toBe(true)
  })
})
