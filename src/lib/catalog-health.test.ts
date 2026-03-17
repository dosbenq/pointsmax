import { describe, expect, it } from 'vitest'
import { buildCatalogHealthReport } from './catalog-health'

describe('buildCatalogHealthReport', () => {
  it('categorizes missing and suspicious card data', () => {
    const report = buildCatalogHealthReport(
      [
        {
          id: 'card-1',
          name: 'Test Card',
          issuer: 'Issuer',
          geography: 'US',
          apply_url: null,
          image_url: '',
          signup_bonus_pts: 60000,
          signup_bonus_spend: 0,
          updated_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'card-2',
          name: 'Healthy Card',
          issuer: 'Issuer',
          geography: 'IN',
          apply_url: 'https://example.com',
          image_url: '/card.png',
          signup_bonus_pts: 0,
          signup_bonus_spend: 0,
          updated_at: new Date().toISOString(),
        },
      ],
      [
        { card_id: 'card-1', earn_multiplier: 1 },
        { card_id: 'card-2', earn_multiplier: 3 },
      ],
    )

    expect(report.missing_apply_url).toHaveLength(1)
    expect(report.missing_image_url).toHaveLength(1)
    expect(report.suspicious_signup_bonus).toHaveLength(1)
    expect(report.weak_earning_rates).toHaveLength(1)
    expect(report.stale_cards).toHaveLength(1)
  })
})
