// ============================================================
// Formatters — Sprint 19
// Pure formatting functions for region-aware display
// Extracted from calculator for testability
// ============================================================

import type { Region } from './regions'

/**
 * Format cents to currency string with symbol
 * Pure function - no external dependencies
 */
export function fmtCents(cents: number | null | undefined, symbol: string): string {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return `${symbol}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(cents / 100)}`
}

/**
 * Format CPP (cents per point) with region-aware units
 * US: shows "cents/pt" (e.g., "2.05¢/pt")
 * IN: shows "paise/pt" (e.g., "185 paise/pt")
 */
export function formatCpp(cppCents: number | null | undefined, region: Region): string {
  if (cppCents == null || !Number.isFinite(cppCents)) return '—'
  if (region === 'in') {
    return `${Math.round(cppCents)} paise/pt`
  }
  return `${cppCents.toFixed(2)}¢/pt`
}

/**
 * Format a points number with commas
 */
export function formatPoints(points: number | null | undefined): string {
  if (points == null || !Number.isFinite(points)) return '—'
  return points.toLocaleString('en-US')
}

/**
 * Parse points input string to number
 * Removes non-digit characters
 */
export function parsePointsInput(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '')
  if (!digitsOnly) return NaN
  return Number.parseInt(digitsOnly, 10)
}

/**
 * Format transfer time for display
 */
export function formatTransferTime(isInstant: boolean, maxHours?: number): string {
  if (isInstant) return 'Instant'
  const hrs = maxHours ?? 72
  if (hrs <= 2) return '~2 hrs'
  if (hrs <= 48) return '1–2 days'
  return 'Up to 3 days'
}

/**
 * Format currency value from cents
 */
export function formatCurrency(cents: number, currency: 'USD' | 'INR' = 'USD'): string {
  if (!Number.isFinite(cents)) return '—'
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
}
