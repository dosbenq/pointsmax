import { describe, expect, it } from 'vitest'
import {
  uuidSchema,
  iataCodeSchema,
  dateStringSchema,
  positiveIntSchema,
  balanceInputSchema,
  calculateRequestSchema,
  cabinClassSchema,
  awardSearchRequestSchema,
  aiRecommendRequestSchema,
  affiliateClickRequestSchema,
  userBalancesRequestSchema,
  userPreferencesRequestSchema,
  tripBuilderRequestSchema,
  validateRequest,
  validateDateRange,
  validateIataCode,
  formatZodErrors,
} from './validation'

describe('validation schemas', () => {
  describe('uuidSchema', () => {
    it('accepts valid UUIDs', () => {
      expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true)
      expect(uuidSchema.safeParse('11111111-1111-1111-1111-111111111111').success).toBe(true)
    })

    it('rejects invalid UUIDs', () => {
      expect(uuidSchema.safeParse('').success).toBe(false)
      expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false)
      expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716').success).toBe(false)
      expect(uuidSchema.safeParse(123).success).toBe(false)
    })
  })

  describe('iataCodeSchema', () => {
    it('accepts valid 3-letter IATA codes', () => {
      expect(iataCodeSchema.safeParse('JFK').success).toBe(true)
      expect(iataCodeSchema.safeParse('LHR').success).toBe(true)
      expect(iataCodeSchema.safeParse('NRT').success).toBe(true)
    })

    it('rejects invalid IATA codes', () => {
      expect(iataCodeSchema.safeParse('JF').success).toBe(false)
      expect(iataCodeSchema.safeParse('JFKK').success).toBe(false)
      expect(iataCodeSchema.safeParse('jfk').success).toBe(false)
      expect(iataCodeSchema.safeParse('123').success).toBe(false)
      expect(iataCodeSchema.safeParse('').success).toBe(false)
    })
  })

  describe('dateStringSchema', () => {
    it('accepts valid YYYY-MM-DD dates', () => {
      expect(dateStringSchema.safeParse('2026-03-15').success).toBe(true)
      expect(dateStringSchema.safeParse('2025-12-31').success).toBe(true)
    })

    it('rejects invalid date formats', () => {
      expect(dateStringSchema.safeParse('03-15-2026').success).toBe(false)
      expect(dateStringSchema.safeParse('2026/03/15').success).toBe(false)
      expect(dateStringSchema.safeParse('2026-3-15').success).toBe(false)
      expect(dateStringSchema.safeParse('invalid').success).toBe(false)
      expect(dateStringSchema.safeParse('').success).toBe(false)
    })
  })

  describe('positiveIntSchema', () => {
    it('accepts positive integers', () => {
      expect(positiveIntSchema.safeParse(1).success).toBe(true)
      expect(positiveIntSchema.safeParse(100).success).toBe(true)
      expect(positiveIntSchema.safeParse(999999).success).toBe(true)
    })

    it('rejects non-positive integers', () => {
      expect(positiveIntSchema.safeParse(0).success).toBe(false)
      expect(positiveIntSchema.safeParse(-1).success).toBe(false)
      expect(positiveIntSchema.safeParse(3.14).success).toBe(false)
      expect(positiveIntSchema.safeParse('100').success).toBe(false)
    })
  })

  describe('cabinClassSchema', () => {
    it('accepts valid cabin classes', () => {
      expect(cabinClassSchema.safeParse('economy').success).toBe(true)
      expect(cabinClassSchema.safeParse('premium_economy').success).toBe(true)
      expect(cabinClassSchema.safeParse('business').success).toBe(true)
      expect(cabinClassSchema.safeParse('first').success).toBe(true)
    })

    it('rejects invalid cabin classes', () => {
      expect(cabinClassSchema.safeParse('first_class').success).toBe(false)
      expect(cabinClassSchema.safeParse('ECONOMY').success).toBe(false)
      expect(cabinClassSchema.safeParse('').success).toBe(false)
    })
  })
})

describe('balanceInputSchema', () => {
  it('accepts valid balance input', () => {
    const result = balanceInputSchema.safeParse({
      program_id: '11111111-1111-1111-1111-111111111111',
      amount: 50000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing program_id', () => {
    const result = balanceInputSchema.safeParse({ amount: 50000 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid program_id', () => {
    const result = balanceInputSchema.safeParse({
      program_id: 'not-a-uuid',
      amount: 50000,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative amount', () => {
    const result = balanceInputSchema.safeParse({
      program_id: '11111111-1111-1111-1111-111111111111',
      amount: -100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero amount', () => {
    const result = balanceInputSchema.safeParse({
      program_id: '11111111-1111-1111-1111-111111111111',
      amount: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('calculateRequestSchema', () => {
  it('accepts valid calculate request', () => {
    const result = calculateRequestSchema.safeParse({
      balances: [
        { program_id: '11111111-1111-1111-1111-111111111111', amount: 50000 },
        { program_id: '22222222-2222-2222-2222-222222222222', amount: 25000 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty balances array', () => {
    const result = calculateRequestSchema.safeParse({ balances: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing balances', () => {
    const result = calculateRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('awardSearchRequestSchema', () => {
  const validSearchRequest = {
    origin: 'JFK',
    destination: 'NRT',
    start_date: '2026-03-01',
    end_date: '2026-03-05',
    cabin: 'business',
    passengers: 2,
    balances: [{ program_id: '11111111-1111-1111-1111-111111111111', amount: 50000 }],
  }

  it('accepts valid award search request', () => {
    const result = awardSearchRequestSchema.safeParse(validSearchRequest)
    expect(result.success).toBe(true)
  })

  it('rejects invalid origin', () => {
    const result = awardSearchRequestSchema.safeParse({
      ...validSearchRequest,
      origin: 'JF',
    })
    expect(result.success).toBe(false)
  })

  it('rejects too many passengers', () => {
    const result = awardSearchRequestSchema.safeParse({
      ...validSearchRequest,
      passengers: 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero passengers', () => {
    const result = awardSearchRequestSchema.safeParse({
      ...validSearchRequest,
      passengers: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('aiRecommendRequestSchema', () => {
  it('accepts valid AI recommend request', () => {
    const result = aiRecommendRequestSchema.safeParse({
      message: 'I want to go to Tokyo',
      balances: [{ name: 'Chase UR', amount: 100000 }],
      region: 'us',
    })
    expect(result.success).toBe(true)
  })

  it('accepts request without optional fields', () => {
    const result = aiRecommendRequestSchema.safeParse({
      message: 'Hello',
      balances: [{ name: 'Amex MR', amount: 50000 }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty message', () => {
    const result = aiRecommendRequestSchema.safeParse({
      message: '',
      balances: [{ name: 'Chase UR', amount: 100000 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects message too long', () => {
    const result = aiRecommendRequestSchema.safeParse({
      message: 'a'.repeat(2001),
      balances: [{ name: 'Chase UR', amount: 100000 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid region', () => {
    const result = aiRecommendRequestSchema.safeParse({
      message: 'Hello',
      balances: [{ name: 'Chase UR', amount: 100000 }],
      region: 'eu',
    })
    expect(result.success).toBe(false)
  })
})

describe('affiliateClickRequestSchema', () => {
  it('accepts valid affiliate click request', () => {
    const result = affiliateClickRequestSchema.safeParse({
      card_id: '11111111-1111-1111-1111-111111111111',
      source_page: '/calculator',
    })
    expect(result.success).toBe(true)
  })

  it('accepts request without optional source_page', () => {
    const result = affiliateClickRequestSchema.safeParse({
      card_id: '11111111-1111-1111-1111-111111111111',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid card_id', () => {
    const result = affiliateClickRequestSchema.safeParse({
      card_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

describe('userBalancesRequestSchema', () => {
  it('accepts valid user balances request', () => {
    const result = userBalancesRequestSchema.safeParse({
      balances: [
        { program_id: '11111111-1111-1111-1111-111111111111', balance: 50000 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative balance', () => {
    const result = userBalancesRequestSchema.safeParse({
      balances: [
        { program_id: '11111111-1111-1111-1111-111111111111', balance: -100 },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('userPreferencesRequestSchema', () => {
  it('accepts valid preferences', () => {
    const result = userPreferencesRequestSchema.safeParse({
      home_airport: 'JFK',
      preferred_cabin: 'business',
      preferred_airlines: ['United', 'Delta'],
      avoided_airlines: ['Spirit'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty preferences', () => {
    const result = userPreferencesRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts null home_airport', () => {
    const result = userPreferencesRequestSchema.safeParse({
      home_airport: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid cabin', () => {
    const result = userPreferencesRequestSchema.safeParse({
      preferred_cabin: 'luxury',
    })
    expect(result.success).toBe(false)
  })
})

describe('tripBuilderRequestSchema', () => {
  it('accepts valid trip builder request', () => {
    const result = tripBuilderRequestSchema.safeParse({
      destination: 'Tokyo',
      dates: 'March 2026',
      travelers: 2,
      budget: 'moderate',
    })
    expect(result.success).toBe(true)
  })

  it('accepts request with optional fields', () => {
    const result = tripBuilderRequestSchema.safeParse({
      destination: 'Paris',
      dates: 'Summer 2026',
      travelers: 4,
      budget: 'luxury',
      pointsBudget: 'high',
      balances: [{ program: 'Chase UR', points: 100000 }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects too many travelers', () => {
    const result = tripBuilderRequestSchema.safeParse({
      destination: 'Tokyo',
      dates: 'March 2026',
      travelers: 21,
      budget: 'moderate',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid budget', () => {
    const result = tripBuilderRequestSchema.safeParse({
      destination: 'Tokyo',
      dates: 'March 2026',
      travelers: 2,
      budget: 'extravagant',
    })
    expect(result.success).toBe(false)
  })
})

describe('validateRequest', () => {
  it('returns success for valid data', () => {
    const result = validateRequest(
      { program_id: '11111111-1111-1111-1111-111111111111', amount: 50000 },
      balanceInputSchema
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.program_id).toBe('11111111-1111-1111-1111-111111111111')
      expect(result.data.amount).toBe(50000)
    }
  })

  it('returns errors for invalid data', () => {
    const result = validateRequest(
      { program_id: 'invalid', amount: -100 },
      balanceInputSchema
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toHaveProperty('field')
      expect(result.errors[0]).toHaveProperty('message')
    }
  })
})

describe('formatZodErrors', () => {
  it('formats ZodError correctly', () => {
    const result = balanceInputSchema.safeParse({
      program_id: 'invalid',
      amount: -100,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatZodErrors(result.error)
      expect(formatted.length).toBeGreaterThan(0)
      expect(formatted[0].field).toBeDefined()
      expect(formatted[0].message).toBeDefined()
    }
  })
})

describe('validateDateRange', () => {
  it('returns null for valid date range', () => {
    const result = validateDateRange('2026-03-01', '2026-03-05')
    expect(result).toBeNull()
  })

  it('returns error when end_date is before start_date', () => {
    const result = validateDateRange('2026-03-05', '2026-03-01')
    expect(result).toContain('end_date must be after start_date')
  })

  it('returns error for invalid start_date', () => {
    const result = validateDateRange('invalid', '2026-03-05')
    expect(result).toContain('Invalid start_date')
  })

  it('returns error for date too far in the past', () => {
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const start = twoYearsAgo.toISOString().split('T')[0]
    const end = '2026-03-05'
    const result = validateDateRange(start, end)
    expect(result).toContain('cannot be more than 1 year in the past')
  })

  it('returns error for date too far in the future', () => {
    const twoYearsFuture = new Date()
    twoYearsFuture.setFullYear(twoYearsFuture.getFullYear() + 2)
    const start = '2026-03-01'
    const end = twoYearsFuture.toISOString().split('T')[0]
    const result = validateDateRange(start, end)
    expect(result).toContain('cannot be more than 1 year in the future')
  })
})

describe('validateIataCode', () => {
  it('returns true for valid IATA codes', () => {
    expect(validateIataCode('JFK')).toBe(true)
    expect(validateIataCode('LHR')).toBe(true)
    expect(validateIataCode('NRT')).toBe(true)
  })

  it('returns false for invalid IATA codes', () => {
    expect(validateIataCode('JF')).toBe(false)
    expect(validateIataCode('JFKK')).toBe(false)
    expect(validateIataCode('jfk')).toBe(false)
    expect(validateIataCode('123')).toBe(false)
    expect(validateIataCode('')).toBe(false)
  })
})
