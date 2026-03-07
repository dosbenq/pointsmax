import type { SpendCategory } from '@/types/database'

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
  { key: 'other', label: 'Other', icon: '🛍️' },
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

export const PROGRAM_GOAL_MAP: Record<string, string[]> = {
  // Current program slugs in database
  'chase-ur': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'amex-mr': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'capital-one': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'citi-thankyou': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  bilt: ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  united: ['domestic', 'intl_econ', 'intl_biz'],
  delta: ['domestic', 'intl_econ', 'intl_biz'],
  american: ['domestic', 'intl_econ', 'intl_biz'],
  southwest: ['domestic'],
  alaska: ['domestic', 'intl_econ', 'intl_biz'],
  hyatt: ['hotels'],
  marriott: ['hotels'],
  hilton: ['hotels'],
  ihg: ['hotels'],
  wyndham: ['hotels'],

  // Legacy/alternate slugs (compatibility)
  // Transferable points for flexibility and international travel
  'chase-ultimate-rewards': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'amex-membership-rewards': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'capital-one-miles': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'citi-thankyou-points': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'bilt-rewards': ['intl_econ', 'intl_biz', 'hotels', 'flex'],

  // Airline miles for domestic travel
  'united-mileageplus': ['domestic', 'intl_econ', 'intl_biz'],
  'delta-skymiles': ['domestic', 'intl_econ', 'intl_biz'],
  'american-aadvantage': ['domestic', 'intl_econ', 'intl_biz'],
  'southwest-rapid-rewards': ['domestic'],
  'alaska-mileage-plan': ['domestic', 'intl_econ', 'intl_biz'],

  // Hotel points
  'world-of-hyatt': ['hotels'],
  'marriott-bonvoy': ['hotels'],
  'hilton-honors': ['hotels'],
  'ihg-one-rewards': ['hotels'],

  // India programs
  'hdfc-millennia': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'axis-edge': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'amex-india-mr': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
  'air-india': ['domestic', 'intl_econ', 'intl_biz'],
  'indigo-6e': ['domestic'],
  'taj-innercircle': ['hotels'],
}

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
