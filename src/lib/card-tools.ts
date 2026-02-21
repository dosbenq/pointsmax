import type { SpendCategory } from '@/types/database'

export const CATEGORIES: { key: SpendCategory; label: string; icon: string }[] = [
  { key: 'dining', label: 'Dining', icon: '🍽️' },
  { key: 'groceries', label: 'Groceries', icon: '🛒' },
  { key: 'travel', label: 'Travel', icon: '✈️' },
  { key: 'gas', label: 'Gas', icon: '⛽' },
  { key: 'streaming', label: 'Streaming', icon: '📺' },
  { key: 'other', label: 'Other', icon: '🛍️' },
]

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
}

export function formatUsdRounded(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}
