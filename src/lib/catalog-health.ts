type CardRow = Record<string, unknown>
type RateRow = { card_id: string; earn_multiplier: number | string | null }

export type CatalogHealthIssue = {
  card_id: string
  name: string
  issuer: string
  geography: string
  apply_url_missing: boolean
  image_url_missing: boolean
  signup_bonus_incomplete: boolean
  weak_earning_rates: boolean
  stale_days: number | null
}

export type CatalogHealthReport = {
  missing_apply_url: CatalogHealthIssue[]
  missing_image_url: CatalogHealthIssue[]
  suspicious_signup_bonus: CatalogHealthIssue[]
  weak_earning_rates: CatalogHealthIssue[]
  stale_cards: CatalogHealthIssue[]
}

function parseString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseStaleDays(card: CardRow): number | null {
  const updatedAt = parseString(card.updated_at)
  const createdAt = parseString(card.created_at)
  const source = updatedAt || createdAt
  if (!source) return null
  const timestamp = Date.parse(source)
  if (!Number.isFinite(timestamp)) return null
  return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000))
}

export function buildCatalogHealthReport(cards: CardRow[], rates: RateRow[]): CatalogHealthReport {
  const maxRateByCard = new Map<string, number>()
  for (const rate of rates) {
    const current = maxRateByCard.get(rate.card_id) ?? 0
    const parsed = parseNumber(rate.earn_multiplier) ?? 0
    maxRateByCard.set(rate.card_id, Math.max(current, parsed))
  }

  const issues: CatalogHealthIssue[] = cards.map((card) => {
    const cardId = parseString(card.id)
    const signupBonus = parseNumber(card.signup_bonus_pts) ?? 0
    const signupSpend = parseNumber(card.signup_bonus_spend) ?? 0
    const maxRate = maxRateByCard.get(cardId) ?? 0
    const imageValue = card.image_url

    return {
      card_id: cardId,
      name: parseString(card.name),
      issuer: parseString(card.issuer),
      geography: parseString(card.geography || 'US'),
      apply_url_missing: !parseString(card.apply_url),
      image_url_missing: !parseString(imageValue),
      signup_bonus_incomplete: signupBonus > 0 && signupSpend === 0,
      weak_earning_rates: maxRate <= 1,
      stale_days: parseStaleDays(card),
    }
  })

  return {
    missing_apply_url: issues.filter((issue) => issue.apply_url_missing),
    missing_image_url: issues.filter((issue) => issue.image_url_missing),
    suspicious_signup_bonus: issues.filter((issue) => issue.signup_bonus_incomplete),
    weak_earning_rates: issues.filter((issue) => issue.weak_earning_rates),
    stale_cards: issues.filter((issue) => (issue.stale_days ?? 0) >= 90),
  }
}
