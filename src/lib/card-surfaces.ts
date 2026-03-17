import type { CardWithRates } from '@/types/database'
import type { CardReviewSnapshot } from '@/features/card-recommender/domain/ui-contract'
import { getSoftBenefits } from '@/features/card-recommender/domain/metadata'

const EARN_RATE_LABELS: Record<string, string> = {
  dining: 'Dining',
  groceries: 'Groceries',
  travel: 'Travel',
  gas: 'Gas',
  shopping: 'Shopping',
  streaming: 'Streaming',
  other: 'Everyday',
}

export function getSafeExternalUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function getCanonicalCardSlug(card: Pick<CardWithRates, 'id' | 'program_slug'>): string {
  const slug = typeof card.program_slug === 'string' ? card.program_slug.trim() : ''
  return slug || card.id
}

export function buildReviewSnapshotFromCard(card: CardWithRates): CardReviewSnapshot {
  const softBenefits = getSoftBenefits(card)
  const headlineEarnRates = Object.entries(card.earning_rates)
    .filter(([, multiplier]) => Number.isFinite(multiplier) && multiplier > 0)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 3)
    .map(([category, multiplier]) => ({
      label: EARN_RATE_LABELS[category] ?? category,
      rate: `${multiplier}x`,
    }))

  return {
    annualFee: Number.isFinite(card.annual_fee_usd) ? card.annual_fee_usd : 0,
    currency: card.currency,
    welcomeBonus: card.signup_bonus_pts > 0
      ? {
          points: card.signup_bonus_pts,
          spendRequirement: card.signup_bonus_spend,
          timeframeMonths: null,
          estimatedValue: (card.signup_bonus_pts * card.cpp_cents) / 100,
        }
      : null,
    headlineEarnRates,
    forexFeePct: null,
    loungeAccess: softBenefits.includes('lounge_access')
      ? {
          hasAccess: true,
          description: 'Mapped premium lounge access benefit',
        }
      : null,
  }
}
