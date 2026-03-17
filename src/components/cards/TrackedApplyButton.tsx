'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { openAffiliateLink } from '@/lib/affiliate-client'
import { getSafeExternalUrl } from '@/lib/card-surfaces'
import type { CardWithRates } from '@/types/database'

type TrackedApplyButtonProps = {
  card: Pick<CardWithRates, 'id' | 'name' | 'apply_url' | 'program_id'>
  region: string
  sourcePage: string
  rank?: number
  recommendationMode?: string
  firstYearValue?: number
  className: string
  label: string
  unavailableLabel?: string
}

export function TrackedApplyButton({
  card,
  region,
  sourcePage,
  rank,
  recommendationMode,
  firstYearValue,
  className,
  label,
  unavailableLabel = 'Offer unavailable',
}: TrackedApplyButtonProps) {
  const [pending, setPending] = useState(false)
  const hasValidUrl = Boolean(getSafeExternalUrl(card.apply_url))

  const handleClick = async () => {
    if (!hasValidUrl || pending) return
    setPending(true)
    try {
      await openAffiliateLink({
        card,
        sourcePage,
        region,
        rank,
        recommendationMode,
        firstYearValue,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!hasValidUrl || pending}
      className={hasValidUrl ? className : `${className} opacity-50 cursor-not-allowed`}
    >
      {pending ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : hasValidUrl ? label : unavailableLabel}
    </button>
  )
}
