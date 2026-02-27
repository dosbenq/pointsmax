// ============================================================
// Cards Repository Tests — Sprint 19
// Tests for data layer functions
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { normalizeGeography, normalizeCardCppCents } from './cards'

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  createPublicClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    })),
  })),
}))

describe('cards repository', () => {
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

  describe('normalizeCardCppCents', () => {
    it('returns original for USD cards', () => {
      expect(normalizeCardCppCents(2.05, 'USD')).toBe(2.05)
      expect(normalizeCardCppCents(1.5, 'USD')).toBe(1.5)
    })

    it('multiplies by 100 for INR when <= 5', () => {
      // Old seeds used rupees-per-point, need to convert to paise
      expect(normalizeCardCppCents(1.5, 'INR')).toBe(150)
      expect(normalizeCardCppCents(2, 'INR')).toBe(200)
      expect(normalizeCardCppCents(5, 'INR')).toBe(500)
    })

    it('returns original for INR when > 5', () => {
      // Already in paise format
      expect(normalizeCardCppCents(150, 'INR')).toBe(150)
      expect(normalizeCardCppCents(200, 'INR')).toBe(200)
    })
  })
})
