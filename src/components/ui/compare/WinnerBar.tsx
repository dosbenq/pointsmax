import { CardComparePayload } from '@/features/card-recommender/domain/ui-contract'
import type { ReactNode } from 'react'
import { Sparkles, Plane, Coffee, Shield, DollarSign } from 'lucide-react'

interface WinnerBarProps {
  cards: CardComparePayload[]
}

export function WinnerBar({ cards }: WinnerBarProps) {
  // Aggregate use Case winners
  const winners = {
    travel: cards.find(c => c.useCaseWinner === 'travel'),
    simplicity: cards.find(c => c.useCaseWinner === 'simplicity'),
    lounges: cards.find(c => c.useCaseWinner === 'lounges'),
    low_fees: cards.find(c => c.useCaseWinner === 'low_fees')
  }

  // If no assigned winners, don't show the bar
  if (!Object.values(winners).some(Boolean)) return null

  return (
    <div className="w-full bg-pm-surface-soft border-y border-pm-border py-4 mb-8 overflow-x-auto custom-scrollbar">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 flex items-center justify-between min-w-[700px] gap-4">
         <div className="text-xs font-bold text-pm-ink-500 uppercase tracking-widest flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-pm-accent" />
            Quick Verdict
         </div>

         <div className="flex gap-6">
            {winners.travel && <WinnerPill icon={<Plane />} label="Best for Travel" cardName={winners.travel.card.name} />}
            {winners.simplicity && <WinnerPill icon={<Coffee />} label="Best for Simplicity" cardName={winners.simplicity.card.name} />}
            {winners.lounges && <WinnerPill icon={<Shield />} label="Best for Lounges" cardName={winners.lounges.card.name} />}
            {winners.low_fees && <WinnerPill icon={<DollarSign />} label="Lowest Fees" cardName={winners.low_fees.card.name} />}
         </div>
      </div>
    </div>
  )
}

function WinnerPill({ icon, label, cardName }: { icon: ReactNode, label: string, cardName: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] font-bold text-pm-ink-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
         <span className="w-3 h-3 flex items-center justify-center">
           {icon}
         </span>
         {label}
      </div>
      <div className="text-sm font-bold text-pm-accent-strong bg-pm-accent-soft px-3 py-1 rounded-md border border-pm-accent-border/50 truncate max-w-[150px]" title={cardName}>
         {cardName}
      </div>
    </div>
  )
}
