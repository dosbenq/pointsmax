import { describe, expect, it } from 'vitest'
import { dealAlertKey } from './deal-scout'

describe('dealAlertKey', () => {
  it('changes only when the deal itself changes', () => {
    const deal = { program_slug: 'flying-blue', availability: { date: '2026-11-02' }, points_needed_from_wallet: 55_000 }
    expect(dealAlertKey(deal)).toBe(dealAlertKey({ ...deal }))
    expect(dealAlertKey(deal)).not.toBe(dealAlertKey({ ...deal, points_needed_from_wallet: 60_000 }))
    expect(dealAlertKey(deal)).not.toBe(dealAlertKey({ ...deal, availability: { date: '2026-11-03' } }))
    expect(dealAlertKey({ ...deal, availability: null })).toBe('flying-blue||55000')
  })
})
