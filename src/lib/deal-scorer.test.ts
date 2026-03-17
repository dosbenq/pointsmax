import { describe, expect, it } from 'vitest'
import { scoreDeal } from './deal-scorer'
import type { AwardSearchResult } from '@/lib/award-search/types'

function buildResult(cpp: number): AwardSearchResult {
  return {
    program_slug: 'aeroplan',
    program_name: 'Aeroplan',
    program_color: '#123456',
    estimated_miles: 55000,
    estimated_cash_value_cents: 390000,
    cpp_cents: cpp,
    baseline_cpp_cents: 1.4,
    cash_value_source: 'live_fare_api',
    cash_value_confidence: 'high',
    transfer_chain: 'Amex MR → Aeroplan',
    transfer_is_instant: true,
    points_needed_from_wallet: 55000,
    availability: null,
    deep_link: { url: 'https://example.com', label: 'Book' },
    has_real_availability: true,
    is_reachable: true,
  }
}

describe('scoreDeal', () => {
  it('labels outsized value as exceptional', () => {
    const score = scoreDeal(buildResult(7.1), 1.4)
    expect(score.rating).toBe('exceptional')
    expect(score.vs_static_baseline_pct).toBe(507)
  })

  it('labels moderate uplift as good', () => {
    const score = scoreDeal(buildResult(2.6), 1.5)
    expect(score.rating).toBe('good')
  })

  it('labels below-baseline value as poor', () => {
    const score = scoreDeal(buildResult(0.9), 1.2)
    expect(score.rating).toBe('poor')
  })
})
