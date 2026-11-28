import { describe, expect, it } from 'vitest'
import { getActiveCards, getCardById, normalizeGeography } from './cards'

describe('cards repository', () => {
  it('normalizes geography', () => {
    expect(normalizeGeography(null)).toBe('US')
    expect(normalizeGeography('IN')).toBe('IN')
    expect(normalizeGeography('UK')).toBe('US')
  })

  it('returns region cards with their program value and earning rates', async () => {
    const usCards = await getActiveCards('US')
    expect(usCards.length).toBeGreaterThan(0)
    expect(usCards.every((card) => card.geography === 'US' && card.currency === 'USD')).toBe(true)

    const sapphire = usCards.find((card) => card.name === 'Chase Sapphire Preferred')!
    expect(sapphire.program_slug).toBe('chase-ur')
    expect(sapphire.cpp_cents).toBeGreaterThan(0)
    expect(sapphire.earning_rates.dining).toBeGreaterThan(1)

    const indiaCards = await getActiveCards('IN')
    expect(indiaCards.length).toBeGreaterThan(0)
    expect(indiaCards.every((card) => card.geography === 'IN')).toBe(true)
  })

  it('loads a single card by id and returns null for unknown ids', async () => {
    const [first] = await getActiveCards('US')
    const card = await getCardById(first.id)
    expect(card?.name).toBe(first.name)
    expect(card?.program_slug).toBe(first.program_slug)
    expect(await getCardById('00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})
