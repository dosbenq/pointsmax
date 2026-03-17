'use client'

import { trackEvent } from '@/lib/analytics'
import { getSafeExternalUrl } from '@/lib/card-surfaces'

type AffiliateCardRef = {
  id: string
  name: string
  apply_url: string | null
  program_id: string
}

type OpenAffiliateLinkInput = {
  card: AffiliateCardRef
  sourcePage: string
  region: string
  rank?: number
  recommendationMode?: string
  firstYearValue?: number
}

export async function openAffiliateLink(input: OpenAffiliateLinkInput): Promise<boolean> {
  const fallbackUrl = getSafeExternalUrl(input.card.apply_url)
  if (!fallbackUrl) return false

  try {
    const response = await fetch('/api/analytics/affiliate-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: input.card.id,
        program_id: input.card.program_id,
        source_page: input.sourcePage,
        rank: input.rank,
        region: input.region,
        recommendation_mode: input.recommendationMode,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    const trackedUrl = typeof payload.redirect_url === 'string'
      ? getSafeExternalUrl(payload.redirect_url)
      : null
    const redirectUrl = trackedUrl ?? fallbackUrl

    trackEvent('card_apply_click', {
      card_name: input.card.name,
      rank: input.rank,
      first_year_value: typeof input.firstYearValue === 'number' ? Math.round(input.firstYearValue) : undefined,
      region: input.region,
      source_page: input.sourcePage,
    })

    const popup = window.open(redirectUrl, '_blank', 'noopener,noreferrer')
    if (!popup) window.location.assign(redirectUrl)
    return true
  } catch {
    const popup = window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
    if (!popup) window.location.assign(fallbackUrl)
    return true
  }
}
