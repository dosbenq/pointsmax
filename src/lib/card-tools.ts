import type { SpendCategory } from '@/types/database'
import { PROGRAM_GOAL_MAP as REGION_PROGRAM_GOAL_MAP } from '@/lib/regions'

// Card art served from public/card-art (issuer-hosted images move or block
// hotlinking, which left broken images on the site). Keyed by card name.
export const CARD_ART_MAP: Record<string, string> = Object.fromEntries(
  [
    'Chase Sapphire Preferred',
    'Chase Sapphire Reserve',
    'Amex Gold',
    'Amex Platinum',
    'Capital One Venture X',
    'Citi Premier',
    'Bilt Mastercard',
    'United Explorer',
    'Delta Gold Amex',
    'World of Hyatt',
    'Marriott Bonvoy Boundless',
    'HDFC Infinia',
    'HDFC Regalia Gold',
    'Axis Atlas',
    'Axis Ace',
    'Amex Platinum (India)',
    'Amex Gold (India)',
    'Air India SBI Signature',
  ].map((name) => [name, `/card-art/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.svg`]),
)

export type CardRegion = 'US' | 'IN'

export const CARD_REGION_OPTIONS: Array<{ value: CardRegion; label: string }> = [
  { value: 'US', label: '🇺🇸 US Cards' },
  { value: 'IN', label: '🇮🇳 India Cards' },
]

export const CATEGORIES: { key: SpendCategory; label: string; icon: string }[] = [
  { key: 'dining', label: 'Dining', icon: '🍽️' },
  { key: 'groceries', label: 'Groceries', icon: '🛒' },
  { key: 'travel', label: 'Travel', icon: '✈️' },
  { key: 'gas', label: 'Gas', icon: '⛽' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️' },
  { key: 'streaming', label: 'Streaming', icon: '📺' },
  { key: 'other', label: 'Other', icon: '📦' },
]

export function getCategoriesForRegion(region: 'us' | 'in'): { key: SpendCategory; label: string; icon: string }[] {
  if (region === 'in') {
    return [
      { key: 'dining', label: 'Dining', icon: '🍽️' },
      { key: 'groceries', label: 'Groceries', icon: '🛒' },
      { key: 'travel', label: 'Travel', icon: '✈️' },
      { key: 'gas', label: 'Fuel', icon: '⛽' },
      { key: 'shopping', label: 'Shopping', icon: '🛍️' },
      { key: 'streaming', label: 'Streaming', icon: '📺' },
      { key: 'other', label: 'Other', icon: '📦' },
    ]
  }

  return [
    { key: 'dining', label: 'Dining', icon: '🍽️' },
    { key: 'groceries', label: 'Groceries', icon: '🛒' },
    { key: 'travel', label: 'Travel', icon: '✈️' },
    { key: 'gas', label: 'Gas', icon: '⛽' },
    { key: 'shopping', label: 'Shopping', icon: '🛍️' },
    { key: 'streaming', label: 'Streaming', icon: '📺' },
    { key: 'other', label: 'Other', icon: '📦' },
  ]
}

export const PROGRAM_GOAL_MAP: Record<string, string[]> = REGION_PROGRAM_GOAL_MAP

export function formatUsdRounded(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function formatCurrencyRounded(amount: number, currency: string): string {
  const normalized = currency === 'INR' ? 'INR' : 'USD'
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: normalized,
    maximumFractionDigits: 0,
  })
}

export function spendInputPrefix(currency: string): string {
  return currency === 'INR' ? '₹' : '$'
}

export function spendUnitLabel(earnUnit: string, currency: string): string {
  if (earnUnit === '100_inr') return 'per ₹100'
  if (earnUnit === '1_dollar') return 'per $1'
  const unitMatch = earnUnit.match(/^(\d+)_([a-z_]+)$/)
  if (!unitMatch) return `per ${currency === 'INR' ? '₹' : '$'}1`
  const divisor = Number.parseInt(unitMatch[1], 10)
  if (!Number.isFinite(divisor) || divisor <= 0) return `per ${currency === 'INR' ? '₹' : '$'}1`
  const prefix = currency === 'INR' ? '₹' : '$'
  return `per ${prefix}${divisor.toLocaleString('en-US')}`
}

export function yearlyPointsFromSpend(opts: {
  monthlySpend: number
  earnMultiplier: number
  earnUnit: string
}): number {
  const { monthlySpend, earnMultiplier, earnUnit } = opts
  if (!Number.isFinite(monthlySpend) || monthlySpend <= 0) return 0
  if (!Number.isFinite(earnMultiplier) || earnMultiplier <= 0) return 0

  if (earnUnit === '100_inr') return (monthlySpend / 100) * earnMultiplier * 12
  if (earnUnit === '1_dollar') return monthlySpend * earnMultiplier * 12

  const unitMatch = earnUnit.match(/^(\d+)_([a-z_]+)$/)
  if (!unitMatch) return monthlySpend * earnMultiplier * 12

  const divisor = Number.parseInt(unitMatch[1], 10)
  if (!Number.isFinite(divisor) || divisor <= 0) return monthlySpend * earnMultiplier * 12
  return (monthlySpend / divisor) * earnMultiplier * 12
}
