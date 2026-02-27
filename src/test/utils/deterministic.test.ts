import { describe, expect, it } from 'vitest'
import { fixedIsoDate, fixedUuid, withFixedNow } from './deterministic'

describe('deterministic test helpers', () => {
  it('provides stable values', () => {
    expect(fixedIsoDate()).toBe('2026-01-01T00:00:00.000Z')
    expect(fixedUuid()).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('overrides Date.now only in callback scope', () => {
    const before = Date.now()
    const within = withFixedNow(1234, () => Date.now())
    const after = Date.now()

    expect(within).toBe(1234)
    expect(after).toBeGreaterThanOrEqual(before)
  })
})
