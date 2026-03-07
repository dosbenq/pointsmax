// ============================================================
// Cards Repository Tests — Sprint 19
// Tests for data layer functions
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { normalizeGeography } from './cards'

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

})
