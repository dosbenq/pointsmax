/**
 * Reference data ("the rules"): programs, cards, point values, transfer
 * partners, redemption options, booking links, hotel award charts and
 * comparison pages.
 *
 * These live as versioned JSON in src/data/catalog and ship with the build,
 * so public pages and the calculator work even when the database is down.
 * IDs are the original database UUIDs; saved balances and affiliate clicks
 * reference them, so never change an existing ID. To update a value, edit the
 * JSON file and open a PR (the catalog tests check every reference).
 */
import bookingUrlsData from '@/data/catalog/booking-urls.json'
import cardEarningRatesData from '@/data/catalog/card-earning-rates.json'
import cardsData from '@/data/catalog/cards.json'
import comparisonPagesData from '@/data/catalog/comparison-pages.json'
import hotelAwardChartsData from '@/data/catalog/hotel-award-charts.json'
import hotelProgramsData from '@/data/catalog/hotel-programs.json'
import programsData from '@/data/catalog/programs.json'
import redemptionOptionsData from '@/data/catalog/redemption-options.json'
import transferPartnersData from '@/data/catalog/transfer-partners.json'
import valuationsData from '@/data/catalog/valuations.json'
import type { HotelAwardChartRow, HotelProgramRow } from '@/lib/hotel-search/types'
import type {
  BookingUrl,
  Card,
  CardEarningRate,
  LatestValuation,
  Program,
  RedemptionOption,
  TransferPartner,
  Valuation,
} from '@/types/database'

export type CatalogHotelProgram = HotelProgramRow & { geography: string; is_active: boolean }
export type CatalogHotelAwardChart = HotelAwardChartRow & { id: string }

export type CatalogComparisonPage = {
  slug: string
  region: 'us' | 'in'
  title: string
  description: string
  card_slugs: string[]
  category_focus: string
  is_published: boolean
  display_order: number
}

/** Production cards carry only the core columns; optional content fields stay unset. */
export type CatalogCard = Omit<Card, 'image_url'> & { image_url?: string | null }

const programs = programsData as Program[]
const cards = cardsData as CatalogCard[]
const cardEarningRates = cardEarningRatesData as CardEarningRate[]
const valuations = valuationsData as Valuation[]
const transferPartners = transferPartnersData as TransferPartner[]
const redemptionOptions = redemptionOptionsData as RedemptionOption[]
const bookingUrls = bookingUrlsData as BookingUrl[]
const hotelPrograms = hotelProgramsData as CatalogHotelProgram[]
const hotelAwardCharts = hotelAwardChartsData as CatalogHotelAwardChart[]
const comparisonPages = comparisonPagesData as CatalogComparisonPage[]

const programsById = new Map(programs.map((program) => [program.id, program]))
const programsBySlug = new Map(programs.map((program) => [program.slug, program]))

/** 'US' | 'IN' as stored on programs and cards; 'global' programs belong to every region. */
export type CatalogGeography = 'US' | 'IN'

function inGeography(geography: string | null | undefined, target: CatalogGeography | null | undefined): boolean {
  if (!target) return true
  const value = (geography ?? 'global').toLowerCase()
  return value === 'global' || value === target.toLowerCase()
}

export function getCatalogPrograms(options: { geography?: CatalogGeography | null; includeInactive?: boolean } = {}): Program[] {
  return programs.filter((program) =>
    (options.includeInactive || program.is_active) && inGeography(program.geography, options.geography),
  )
}

export function getCatalogProgramById(id: string): Program | null {
  return programsById.get(id) ?? null
}

export function getCatalogProgramBySlug(slug: string): Program | null {
  return programsBySlug.get(slug) ?? null
}

export function getCatalogCards(options: { geography?: CatalogGeography | null; includeInactive?: boolean } = {}): CatalogCard[] {
  return cards.filter((card) =>
    (options.includeInactive || card.is_active)
    && (!options.geography || card.geography.toUpperCase() === options.geography),
  )
}

export function getCatalogCardById(id: string): CatalogCard | null {
  return cards.find((card) => card.id === id) ?? null
}

export function getCatalogCardEarningRates(cardIds?: readonly string[]): CardEarningRate[] {
  if (!cardIds) return cardEarningRates
  const wanted = new Set(cardIds)
  return cardEarningRates.filter((rate) => wanted.has(rate.card_id))
}

/** Same shape as the former `latest_valuations` view: one value per active program. */
export function getCatalogLatestValuations(programIds?: readonly string[]): LatestValuation[] {
  const wanted = programIds ? new Set(programIds) : null
  const rows: LatestValuation[] = []
  for (const valuation of valuations) {
    if (wanted && !wanted.has(valuation.program_id)) continue
    const program = programsById.get(valuation.program_id)
    if (!program || !program.is_active) continue
    rows.push({
      ...valuation,
      program_name: program.name,
      program_slug: program.slug,
      program_type: program.type,
    })
  }
  return rows
}

export function getCatalogTransferPartners(options: { includeInactive?: boolean } = {}): TransferPartner[] {
  return options.includeInactive ? transferPartners : transferPartners.filter((partner) => partner.is_active)
}

export function getCatalogTransferPartnerById(id: string): TransferPartner | null {
  return transferPartners.find((partner) => partner.id === id) ?? null
}

export function getCatalogRedemptionOptions(): RedemptionOption[] {
  return redemptionOptions
}

export function getCatalogBookingUrls(): BookingUrl[] {
  return bookingUrls.filter((link) => link.is_active)
}

export function getCatalogHotelPrograms(): CatalogHotelProgram[] {
  return hotelPrograms.filter((program) => program.is_active)
}

export function getCatalogHotelAwardCharts(destinationRegion?: string): CatalogHotelAwardChart[] {
  return destinationRegion
    ? hotelAwardCharts.filter((row) => row.destination_region === destinationRegion)
    : hotelAwardCharts
}

export function getCatalogComparisonPages(region?: 'us' | 'in'): CatalogComparisonPage[] {
  return comparisonPages
    .filter((page) => page.is_published && (!region || page.region === region))
    .sort((left, right) => left.display_order - right.display_order)
}
