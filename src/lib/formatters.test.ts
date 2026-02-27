// ============================================================
// Formatters Tests — Sprint 19
// Pure function tests for region-aware formatting
// ============================================================

import { describe, it, expect } from 'vitest'
import { fmtCents, formatCpp, formatPoints, parsePointsInput, formatTransferTime, formatCurrency } from './formatters'
import type { Region } from './regions'

describe('formatters', () => {
  describe('fmtCents', () => {
    it('formats cents with dollar symbol', () => {
      expect(fmtCents(10000, '$')).toBe('$100')
      expect(fmtCents(2050, '$')).toBe('$21')
      expect(fmtCents(99999, '₹')).toBe('₹1,000')
    })

    it('returns em-dash for null/undefined/NaN', () => {
      expect(fmtCents(null, '$')).toBe('—')
      expect(fmtCents(undefined, '$')).toBe('—')
      expect(fmtCents(NaN, '$')).toBe('—')
    })
  })

  describe('formatCpp', () => {
    it('formats US CPP as cents per point', () => {
      expect(formatCpp(2.05, 'us' as Region)).toBe('2.05¢/pt')
      expect(formatCpp(1.5, 'us' as Region)).toBe('1.50¢/pt')
      expect(formatCpp(3.14159, 'us' as Region)).toBe('3.14¢/pt')
    })

    it('formats India CPP as paise per point', () => {
      expect(formatCpp(185, 'in' as Region)).toBe('185 paise/pt')
      expect(formatCpp(150.5, 'in' as Region)).toBe('151 paise/pt') // rounded
    })

    it('returns em-dash for null/undefined/NaN', () => {
      expect(formatCpp(null, 'us' as Region)).toBe('—')
      expect(formatCpp(undefined, 'in' as Region)).toBe('—')
      expect(formatCpp(NaN, 'us' as Region)).toBe('—')
    })
  })

  describe('formatPoints', () => {
    it('formats points with commas', () => {
      expect(formatPoints(80000)).toBe('80,000')
      expect(formatPoints(1000000)).toBe('1,000,000')
      expect(formatPoints(500)).toBe('500')
    })

    it('returns em-dash for null/undefined/NaN', () => {
      expect(formatPoints(null)).toBe('—')
      expect(formatPoints(undefined)).toBe('—')
      expect(formatPoints(NaN)).toBe('—')
    })
  })

  describe('parsePointsInput', () => {
    it('parses numeric input', () => {
      expect(parsePointsInput('80000')).toBe(80000)
      expect(parsePointsInput('80,000')).toBe(80000)
      expect(parsePointsInput('80 000')).toBe(80000)
    })

    it('returns NaN for empty input', () => {
      expect(parsePointsInput('')).toBeNaN()
      expect(parsePointsInput('abc')).toBeNaN()
    })

    it('handles edge cases', () => {
      expect(parsePointsInput('0')).toBe(0)
      expect(parsePointsInput('   500   ')).toBe(500)
    })
  })

  describe('formatTransferTime', () => {
    it('returns Instant for instant transfers', () => {
      expect(formatTransferTime(true)).toBe('Instant')
      expect(formatTransferTime(true, 48)).toBe('Instant')
    })

    it('formats non-instant times', () => {
      expect(formatTransferTime(false, 1)).toBe('~2 hrs')
      expect(formatTransferTime(false, 2)).toBe('~2 hrs')
      expect(formatTransferTime(false, 24)).toBe('1–2 days')
      expect(formatTransferTime(false, 48)).toBe('1–2 days')
      expect(formatTransferTime(false, 72)).toBe('Up to 3 days')
      expect(formatTransferTime(false)).toBe('Up to 3 days')
    })
  })

  describe('formatCurrency', () => {
    it('formats USD', () => {
      expect(formatCurrency(10000, 'USD')).toBe('$100')
      expect(formatCurrency(2050, 'USD')).toBe('$21')
    })

    it('formats INR', () => {
      expect(formatCurrency(10000, 'INR')).toBe('₹100')  // 10000 cents = 100 rupees
    })

    it('returns em-dash for invalid input', () => {
      expect(formatCurrency(NaN, 'USD')).toBe('—')
    })
  })
})
