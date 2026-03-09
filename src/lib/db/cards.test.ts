import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

type QueryResult = { data: unknown[] | Record<string, unknown> | null; error: { message: string; code?: string } | null }

function makeBuilder(result: QueryResult, operations: Array<{ method: string; args: unknown[] }>) {
  const builder = {
    select(...args: unknown[]) {
      operations.push({ method: 'select', args })
      return builder
    },
    eq(...args: unknown[]) {
      operations.push({ method: 'eq', args })
      return builder
    },
    order(...args: unknown[]) {
      operations.push({ method: 'order', args })
      return builder
    },
    in(...args: unknown[]) {
      operations.push({ method: 'in', args })
      return builder
    },
    single() {
      operations.push({ method: 'single', args: [] })
      return Promise.resolve(result)
    },
    then(onfulfilled?: (value: QueryResult) => unknown) {
      return Promise.resolve(result).then(onfulfilled)
    },
  }

  return builder
}

vi.mock('@/lib/supabase', () => ({
  createPublicClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

const { getActiveCards, getCardById, normalizeGeography } = await import('./cards')

describe('cards repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('normalizeGeography', () => {
    it('returns US by default', () => {
      expect(normalizeGeography(null)).toBe('US')
      expect(normalizeGeography('')).toBe('US')
    })

    it('normalizes IN correctly', () => {
      expect(normalizeGeography('IN')).toBe('IN')
      expect(normalizeGeography('in')).toBe('IN')
      expect(normalizeGeography('In')).toBe('IN')
    })

    it('returns US for non-IN values', () => {
      expect(normalizeGeography('US')).toBe('US')
      expect(normalizeGeography('us')).toBe('US')
      expect(normalizeGeography('EU')).toBe('US')
      expect(normalizeGeography('random')).toBe('US')
    })
  })

  it('filters valuation queries to active card programs in getActiveCards', async () => {
    const cardOps: Array<{ method: string; args: unknown[] }> = []
    const valuationOps: Array<{ method: string; args: unknown[] }> = []
    const rateOps: Array<{ method: string; args: unknown[] }> = []

    mockFrom.mockImplementation((table: string) => {
      if (table === 'cards') {
        return makeBuilder({
          data: [
            {
              id: 'card-1',
              name: 'Card One',
              issuer: 'Issuer',
              annual_fee_usd: 95,
              signup_bonus_pts: 10000,
              signup_bonus_spend: 1000,
              program_id: 'prog-1',
              is_active: true,
              display_order: 1,
              created_at: '2024-01-01',
              currency: 'USD',
              earn_unit: '1_dollar',
              geography: 'US',
              apply_url: 'https://example.com',
              image_url: null,
            },
          ],
          error: null,
        }, cardOps)
      }

      if (table === 'latest_valuations') {
        return makeBuilder({
          data: [
            {
              program_id: 'prog-1',
              cpp_cents: 1.5,
              program_name: 'Program One',
              program_slug: 'prog-one',
              program_type: 'transferable_points',
            },
          ],
          error: null,
        }, valuationOps)
      }

      return makeBuilder({
        data: [{ card_id: 'card-1', category: 'other', earn_multiplier: 1 }],
        error: null,
      }, rateOps)
    })

    await getActiveCards('US')

    expect(valuationOps).toContainEqual({
      method: 'in',
      args: ['program_id', ['prog-1']],
    })
    expect(rateOps).toContainEqual({
      method: 'in',
      args: ['card_id', ['card-1']],
    })
  })

  it('filters single-card valuation queries by program id in getCardById', async () => {
    const cardOps: Array<{ method: string; args: unknown[] }> = []
    const valuationOps: Array<{ method: string; args: unknown[] }> = []
    const rateOps: Array<{ method: string; args: unknown[] }> = []

    mockFrom.mockImplementation((table: string) => {
      if (table === 'cards') {
        return makeBuilder({
          data: {
            id: 'card-1',
            name: 'Card One',
            issuer: 'Issuer',
            annual_fee_usd: 95,
            signup_bonus_pts: 10000,
            signup_bonus_spend: 1000,
            program_id: 'prog-1',
            is_active: true,
            display_order: 1,
            created_at: '2024-01-01',
            currency: 'USD',
            earn_unit: '1_dollar',
            geography: 'US',
            apply_url: 'https://example.com',
            image_url: null,
          },
          error: null,
        }, cardOps)
      }

      if (table === 'latest_valuations') {
        return makeBuilder({
          data: [
            {
              program_id: 'prog-1',
              cpp_cents: 1.5,
              program_name: 'Program One',
              program_slug: 'prog-one',
              program_type: 'transferable_points',
            },
          ],
          error: null,
        }, valuationOps)
      }

      return makeBuilder({
        data: [{ card_id: 'card-1', category: 'other', earn_multiplier: 1 }],
        error: null,
      }, rateOps)
    })

    await getCardById('card-1')

    expect(cardOps).toContainEqual({ method: 'single', args: [] })
    expect(valuationOps).toContainEqual({
      method: 'eq',
      args: ['program_id', 'prog-1'],
    })
    expect(rateOps).toContainEqual({
      method: 'eq',
      args: ['card_id', 'card-1'],
    })
  })
})
