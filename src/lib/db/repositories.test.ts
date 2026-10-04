// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { setDbForTesting } from './client'
import { getActiveBookingUrls } from './booking-urls'
import { getActiveCards, getCardById, normalizeGeography } from './cards'
import { getActivePrograms, getProgramBySlug, getProgramsByIds } from './programs'
import { bookingUrls, cardEarningRates, cards } from './schema'
import { createTestDb, seedPrograms, testId, type TestDb } from '@/test/utils/test-db'

let db: TestDb

beforeEach(async () => {
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [
    { key: 'chase-ur', name: 'Chase Ultimate Rewards', geography: 'US', cpp: 2.05 },
    { key: 'hdfc-smartbuy', name: 'HDFC SmartBuy', geography: 'IN', cpp: 120 },
    { key: 'marriott', name: 'Marriott Bonvoy', type: 'hotel_points', geography: 'global', cpp: 0.75 },
    { key: 'no-value', name: 'Unvalued Programme', geography: 'US' },
  ])
})

afterAll(() => setDbForTesting(null))

describe('normalizeGeography', () => {
  it('defaults to US and recognises IN', () => {
    expect(normalizeGeography(null)).toBe('US')
    expect(normalizeGeography('in')).toBe('IN')
    expect(normalizeGeography('EU')).toBe('US')
  })
})

describe('programs repository', () => {
  it('returns a region plus global programmes', async () => {
    const india = await getActivePrograms('IN')
    expect(india.map((p) => p.slug).sort()).toEqual(['hdfc-smartbuy', 'marriott'])
    expect((await getActivePrograms()).length).toBe(4)
  })

  it('looks programmes up by slug and ids', async () => {
    expect((await getProgramBySlug('chase-ur'))?.name).toBe('Chase Ultimate Rewards')
    expect(await getProgramBySlug('missing')).toBeNull()
    const byIds = await getProgramsByIds([testId('marriott'), testId('chase-ur')])
    expect(byIds.map((p) => p.slug).sort()).toEqual(['chase-ur', 'marriott'])
    expect(await getProgramsByIds([])).toEqual([])
  })
})

describe('booking urls repository', () => {
  it('returns active region and global urls in sort order', async () => {
    await db.insert(bookingUrls).values([
      { programSlug: 'chase-ur', label: 'Chase', url: 'https://example.com/chase', region: 'us', sortOrder: 2 },
      { programSlug: 'marriott', label: 'Marriott', url: 'https://example.com/marriott', region: 'global', sortOrder: 1 },
      { programSlug: 'hdfc-smartbuy', label: 'HDFC', url: 'https://example.com/hdfc', region: 'in', sortOrder: 0 },
      { programSlug: 'chase-ur', label: 'Old', url: 'https://example.com/old', region: 'us', sortOrder: 0, isActive: false },
    ])
    expect((await getActiveBookingUrls('us')).map((u) => u.label)).toEqual(['Marriott', 'Chase'])
    expect((await getActiveBookingUrls()).map((u) => u.label)).toEqual(['HDFC', 'Marriott', 'Chase'])
  })
})

describe('cards repository', () => {
  beforeEach(async () => {
    await db.insert(cards).values([
      { id: testId('sapphire'), name: 'Sapphire Preferred', issuer: 'Chase', programId: testId('chase-ur'), geography: 'US', displayOrder: 1 },
      { id: testId('odd'), name: 'Odd Card', issuer: 'X', programId: testId('no-value'), geography: 'US', displayOrder: 2 },
      { id: testId('infinia'), name: 'Infinia', issuer: 'HDFC', programId: testId('hdfc-smartbuy'), geography: 'IN', currency: 'INR' },
      { id: testId('retired'), name: 'Retired', issuer: 'Chase', programId: testId('chase-ur'), geography: 'US', isActive: false },
    ])
    await db.insert(cardEarningRates).values([
      { cardId: testId('sapphire'), category: 'dining', earnMultiplier: 3 },
      { cardId: testId('sapphire'), category: 'travel', earnMultiplier: 2 },
    ])
  })

  it('returns active cards for a region with valuations and earning rates', async () => {
    const us = await getActiveCards('US')
    expect(us.map((c) => c.name)).toEqual(['Sapphire Preferred', 'Odd Card'])
    const sapphire = us[0]
    expect(sapphire.program_slug).toBe('chase-ur')
    expect(sapphire.cpp_cents).toBe(2.05)
    expect(sapphire.earning_rates).toMatchObject({ dining: 3, travel: 2, other: 1, shopping: 1 })

    // A programme without a valuation keeps its real name and falls back on type defaults.
    expect(us[1]).toMatchObject({ program_name: 'Unvalued Programme', program_slug: 'no-value', cpp_cents: 2 })

    const india = await getActiveCards('IN')
    expect(india).toHaveLength(1)
    expect(india[0]).toMatchObject({ currency: 'INR', earn_unit: '1_dollar', cpp_cents: 120 })
  })

  it('fetches a single card, returning null when missing or inactive', async () => {
    expect((await getCardById(testId('sapphire')))?.name).toBe('Sapphire Preferred')
    expect(await getCardById(testId('retired'))).toBeNull()
    expect(await getCardById(testId('nope'))).toBeNull()
  })

  it('reports query failures as errors', async () => {
    await db.execute(sql`drop table card_earning_rates`)
    await expect(getActiveCards('US')).rejects.toThrow('Failed to fetch card metadata')
  })
})
