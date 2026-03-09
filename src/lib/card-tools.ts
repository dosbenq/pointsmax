import type { SpendCategory } from '@/types/database'
import { PROGRAM_GOAL_MAP as REGION_PROGRAM_GOAL_MAP } from '@/lib/regions'

// Hand-sourced official card art for the most popular US cards.
// These are mapped directly to the `name` column in the cards table.
export const CARD_ART_MAP: Record<string, string> = {
  'Chase Sapphire Preferred': 'https://creditcards.chase.com/K-OPPORTUNITY/images/cardart/sapphire_preferred.png',
  'Chase Sapphire Reserve': 'https://creditcards.chase.com/K-OPPORTUNITY/images/cardart/sapphire_reserve.png',
  'Amex Gold': 'https://icm.aexp-static.com/Internet/Acquisition/US_en/Appleseed/EquipmentFronts/1-1-1/Gold.png',
  'Amex Platinum': 'https://icm.aexp-static.com/Internet/Acquisition/US_en/Appleseed/EquipmentFronts/1-1-1/Platinum.png',
  'Capital One Venture X': 'https://ecm.capitalone.com/WCM/card/products/venture-x/venture_x_card_art_1x.png',
  'Citi Premier': 'https://www.citi.com/CRD/images/citi-strata-premier/citi-strata-premier.png',
  'Bilt Mastercard': 'https://wfp.biltrewards.com/images/card/card_Bilt_Mastercard_black.png',
  'United Explorer': 'https://creditcards.chase.com/K-OPPORTUNITY/images/cardart/united_explorer.png',
  'Delta Gold Amex': 'https://icm.aexp-static.com/Internet/Acquisition/US_en/Appleseed/EquipmentFronts/1-1-1/SkyMilesGold.png',
}

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
