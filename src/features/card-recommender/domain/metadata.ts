import type { CardWithRates } from '@/types/database'

export type SoftBenefitType =
  | 'lounge_access'
  | 'golf'
  | 'concierge'
  | 'hotel_status'
  | 'travel_insurance'

export type ComplexityLevel = 'low' | 'medium' | 'high'

export type IssuerRuleTag =
  | 'chase_5_24'
  | 'duplicate_card_not_allowed'
  | 'bonus_eligibility_uncertain'

export interface CardFeatureProfile {
  benefits: SoftBenefitType[]
  complexity: ComplexityLevel
  issuerRules: IssuerRuleTag[]
}

export const SOFT_BENEFIT_COPY: Record<SoftBenefitType, string> = {
  lounge_access: 'Lounge Access',
  golf: 'Golf',
  concierge: 'Concierge',
  hotel_status: 'Hotel Status',
  travel_insurance: 'Travel Insurance',
}

export const SOFT_BENEFIT_VALUES: Record<'US' | 'IN', Record<SoftBenefitType, number>> = {
  US: {
    lounge_access: 500,
    golf: 0,
    concierge: 100,
    hotel_status: 200,
    travel_insurance: 150,
  },
  IN: {
    lounge_access: 20000,
    golf: 15000,
    concierge: 10000,
    hotel_status: 12000,
    travel_insurance: 6000,
  },
}

export const CARD_FEATURES_BY_NAME: Record<string, CardFeatureProfile> = {
  'amex platinum': {
    benefits: ['lounge_access', 'hotel_status', 'concierge'],
    complexity: 'high',
    issuerRules: ['bonus_eligibility_uncertain', 'duplicate_card_not_allowed'],
  },
  'amex gold': {
    benefits: ['travel_insurance'],
    complexity: 'medium',
    issuerRules: ['bonus_eligibility_uncertain', 'duplicate_card_not_allowed'],
  },
  'amex platinum (india)': {
    benefits: ['lounge_access', 'hotel_status', 'concierge'],
    complexity: 'high',
    issuerRules: ['bonus_eligibility_uncertain', 'duplicate_card_not_allowed'],
  },
  'axis atlas': {
    benefits: ['lounge_access', 'travel_insurance'],
    complexity: 'medium',
    issuerRules: ['duplicate_card_not_allowed'],
  },
  'capital one venture x': {
    benefits: ['lounge_access', 'travel_insurance'],
    complexity: 'medium',
    issuerRules: ['duplicate_card_not_allowed'],
  },
  'chase sapphire preferred': {
    benefits: ['travel_insurance'],
    complexity: 'low',
    issuerRules: ['chase_5_24', 'duplicate_card_not_allowed'],
  },
  'chase sapphire reserve': {
    benefits: ['lounge_access', 'travel_insurance'],
    complexity: 'medium',
    issuerRules: ['chase_5_24', 'duplicate_card_not_allowed'],
  },
  'hdfc infinia': {
    benefits: ['lounge_access', 'golf', 'concierge'],
    complexity: 'medium',
    issuerRules: ['duplicate_card_not_allowed'],
  },
}

function normalizeCardName(name: string): string {
  return name.trim().toLowerCase()
}

function defaultIssuerRules(card: CardWithRates): IssuerRuleTag[] {
  const issuer = card.issuer.trim().toLowerCase()
  if (issuer.includes('chase')) return ['chase_5_24', 'duplicate_card_not_allowed']
  if (issuer.includes('amex') || issuer.includes('american express')) {
    return ['bonus_eligibility_uncertain', 'duplicate_card_not_allowed']
  }
  return ['duplicate_card_not_allowed']
}

export function getCardFeatureProfile(card: CardWithRates): CardFeatureProfile {
  const exact = CARD_FEATURES_BY_NAME[normalizeCardName(card.name)]
  if (exact) return exact

  const isIndiaCard = card.currency === 'INR'
  const complexity: ComplexityLevel =
    card.annual_fee_usd > (isIndiaCard ? 25_000 : 500)
      ? 'high'
      : 'medium'

  return {
    benefits: [],
    complexity,
    issuerRules: defaultIssuerRules(card),
  }
}

export function getSoftBenefits(card: CardWithRates | string): SoftBenefitType[] {
  if (typeof card === 'string') {
    return CARD_FEATURES_BY_NAME[normalizeCardName(card)]?.benefits ?? []
  }
  return getCardFeatureProfile(card).benefits
}

export function getSoftBenefitAnnualValue(card: CardWithRates | string, regionCode: 'us' | 'in'): number {
  const regionKey = regionCode === 'in' ? 'IN' : 'US'
  return getSoftBenefits(card).reduce(
    (sum, benefit) => sum + (SOFT_BENEFIT_VALUES[regionKey][benefit] ?? 0),
    0
  )
}

export function getComplexityPenalty(card: CardWithRates, regionCode: 'us' | 'in'): number {
  const profile = getCardFeatureProfile(card)
  if (profile.complexity === 'low') return 0
  if (profile.complexity === 'medium') return regionCode === 'in' ? 6000 : 60
  return regionCode === 'in' ? 14000 : 140
}
