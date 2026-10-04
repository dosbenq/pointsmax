// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: <T,>(fn: T) => fn }))

import { setDbForTesting } from '@/lib/db/client'
import { cardEarningRates, cards, comparisonPages } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedTransfer, testId, type TestDb } from '@/test/utils/test-db'
import { getProgramBySlug, listCardsForRegion, listComparisonPagesForRegion, listProgramsForRegion } from './programmatic-content'

let db: TestDb
const env = { ...process.env }

beforeEach(async () => {
  process.env.DATABASE_URL = 'postgres://test'
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [
    { key: 'chase-ur', name: 'Chase Ultimate Rewards', geography: 'US', cpp: 2.05 },
    { key: 'hyatt', name: 'World of Hyatt', type: 'hotel_points', geography: 'global', cpp: 1.7 },
    { key: 'hdfc-smartbuy', name: 'HDFC SmartBuy', geography: 'IN', cpp: 120 },
  ])
  await seedTransfer(db, 'chase-ur', 'hyatt')
  await seedTransfer(db, 'hdfc-smartbuy', 'hyatt')
  await db.insert(cards).values([
    { id: testId('sapphire'), name: 'Chase Sapphire Preferred', issuer: 'Chase', programId: testId('chase-ur'), geography: 'US' },
    { id: testId('infinia'), name: 'HDFC Infinia', issuer: 'HDFC', programId: testId('hdfc-smartbuy'), geography: 'IN', currency: 'INR' },
  ])
  await db.insert(cardEarningRates).values({ cardId: testId('sapphire'), category: 'dining', earnMultiplier: 3 })
})

afterAll(() => {
  setDbForTesting(null)
  process.env = env
})

describe('programmatic content (database)', () => {
  it('lists region cards with programme, valuation and earning rates', async () => {
    const us = await listCardsForRegion('us')
    expect(us).toHaveLength(1)
    expect(us[0]).toMatchObject({ name: 'Chase Sapphire Preferred', cpp_cents: 2.05, program: { slug: 'chase-ur' } })
    expect(us[0].earning_rates).toEqual([{ card_id: testId('sapphire'), category: 'dining', earn_multiplier: 3 }])
    expect((await listCardsForRegion('in')).map((c) => c.name)).toEqual(['HDFC Infinia'])
  })

  it('lists region programmes with transfers in and out', async () => {
    const programs = await listProgramsForRegion('in')
    expect(programs.map((p) => p.slug).sort()).toEqual(['hdfc-smartbuy', 'hyatt'])

    const hyatt = await getProgramBySlug('in', 'hyatt')
    // Chase is a US programme, so only the India-visible source is listed.
    expect(hyatt?.transfer_in.map((t) => t.from_program_slug)).toEqual(['hdfc-smartbuy'])
    expect(hyatt?.cpp_cents).toBe(1.7)

    const hdfc = await getProgramBySlug('in', 'hdfc-smartbuy')
    expect(hdfc?.transfer_out.map((t) => t.to_program_slug)).toEqual(['hyatt'])
    expect(hdfc?.earning_cards.map((c) => c.name)).toEqual(['HDFC Infinia'])
  })

  it('lists published comparison pages', async () => {
    await db.insert(comparisonPages).values([
      { slug: 'travel', region: 'us', title: 'Travel cards', description: 'd', cardSlugs: ['a', 'b'], isPublished: true, displayOrder: 1 },
      { slug: 'draft', region: 'us', title: 'Draft', description: 'd', cardSlugs: [], isPublished: false },
    ])
    const pages = await listComparisonPagesForRegion('us')
    expect(pages.map((p) => p.slug)).toEqual(['travel'])
    expect(pages[0].href).toBe('/us/cards/compare?cards=a,b')
  })

  it('returns empty lists when no database is configured', async () => {
    delete process.env.DATABASE_URL
    delete process.env.SUPABASE_DB_URL
    expect(await listCardsForRegion('us')).toEqual([])
  })
})
