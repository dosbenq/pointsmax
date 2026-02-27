import { describe, expect, it } from 'vitest'
import { sortAwardResultsByPoints } from './sort-results'
import type { AwardSearchResult } from './types'

function makeResult(partial: Partial<AwardSearchResult>): AwardSearchResult {
  return {
    program_slug: 'test',
    program_name: 'Test Program',
    program_color: '#000000',
    estimated_miles: 50000,
    estimated_cash_value_cents: 100000,
    cpp_cents: 2,
    transfer_chain: null,
    transfer_is_instant: true,
    points_needed_from_wallet: 50000,
    availability: null,
    deep_link: { url: 'https://example.com', label: 'Book' },
    has_real_availability: false,
    is_reachable: true,
    ...partial,
  }
}

describe('sortAwardResultsByPoints', () => {
  it('sorts by lowest points needed first', () => {
    const input = [
      makeResult({ program_slug: 'b', points_needed_from_wallet: 70000, estimated_miles: 70000 }),
      makeResult({ program_slug: 'a', points_needed_from_wallet: 45000, estimated_miles: 45000 }),
      makeResult({ program_slug: 'c', points_needed_from_wallet: 90000, estimated_miles: 90000 }),
    ]

    const sorted = sortAwardResultsByPoints(input)
    expect(sorted.map(r => r.program_slug)).toEqual(['a', 'b', 'c'])
  })

  it('prefers higher cpp on tied points', () => {
    const input = [
      makeResult({ program_slug: 'low-cpp', points_needed_from_wallet: 50000, cpp_cents: 100 }),
      makeResult({ program_slug: 'high-cpp', points_needed_from_wallet: 50000, cpp_cents: 250 }),
    ]

    const sorted = sortAwardResultsByPoints(input)
    expect(sorted.map(r => r.program_slug)).toEqual(['high-cpp', 'low-cpp'])
  })

  it('prefers live availability on ties', () => {
    const input = [
      makeResult({ program_slug: 'estimate', points_needed_from_wallet: 50000, cpp_cents: 200, has_real_availability: false }),
      makeResult({ program_slug: 'live', points_needed_from_wallet: 50000, cpp_cents: 200, has_real_availability: true }),
    ]

    const sorted = sortAwardResultsByPoints(input)
    expect(sorted.map(r => r.program_slug)).toEqual(['live', 'estimate'])
  })
})
