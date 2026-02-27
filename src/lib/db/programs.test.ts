// ============================================================
// Programs Repository Tests — Sprint 19
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

describe('programs repository', () => {
  describe('normalizeGeography (from cards)', () => {
    it('returns US for null/empty input (cards behavior)', () => {
      expect(normalizeGeography(null)).toBe('US')
      expect(normalizeGeography('')).toBe('US')
    })

    it('normalizes valid regions', () => {
      expect(normalizeGeography('US')).toBe('US')
      expect(normalizeGeography('us')).toBe('US')
      expect(normalizeGeography('IN')).toBe('IN')
      expect(normalizeGeography('in')).toBe('IN')
    })

    it('returns US for invalid regions (cards behavior)', () => {
      expect(normalizeGeography('EU')).toBe('US')
      expect(normalizeGeography('random')).toBe('US')
      expect(normalizeGeography('123')).toBe('US')
    })
  })
})
