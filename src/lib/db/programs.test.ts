import { describe, expect, it } from 'vitest'
import { normalizeGeography } from './cards'
import { getActivePrograms, getProgramBySlug, getProgramsByIds } from './programs'

describe('programs repository', () => {
  it('returns region programs plus global ones', async () => {
    const us = await getActivePrograms('US')
    expect(us.map((p) => p.slug)).toEqual(expect.arrayContaining(['chase-ur', 'flying-blue']))
    expect(us.map((p) => p.slug)).not.toContain('hdfc-millennia')
    expect((await getActivePrograms()).length).toBeGreaterThan(us.length)
  })

  it('looks programs up by slug and id', async () => {
    const chase = await getProgramBySlug('chase-ur')
    expect(chase?.name).toBe('Chase Ultimate Rewards')
    expect(await getProgramBySlug('no-such-program')).toBeNull()
    expect((await getProgramsByIds([chase!.id, 'missing'])).map((p) => p.slug)).toEqual(['chase-ur'])
    expect(await getProgramsByIds([])).toEqual([])
  })

  describe('normalizeGeography (from cards)', () => {
    it('defaults to US and recognises IN', () => {
      expect(normalizeGeography(null)).toBe('US')
      expect(normalizeGeography('')).toBe('US')
      expect(normalizeGeography('in')).toBe('IN')
      expect(normalizeGeography('UK')).toBe('US')
    })
  })
})
