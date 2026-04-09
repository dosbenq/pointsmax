'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import { CardComparePayload } from '@/features/card-recommender/domain/ui-contract'
import { CARD_ART_MAP, formatCurrencyRounded } from '@/lib/card-tools'
import { TrackedApplyButton } from '@/components/cards/TrackedApplyButton'
import { Check, Minus } from 'lucide-react'

interface CompareGridProps {
  cards: CardComparePayload[]
  region: string
  sourcePage: string
  recommendationMode?: string
}

export function CompareGrid({ cards, region, sourcePage, recommendationMode }: CompareGridProps) {
  // Mobile Segmentation State
  const [activeMobileTab, setActiveMobileTab] = useState<'verdict' | 'fees' | 'rewards' | 'perks'>('verdict')

  // Tailwind does not support dynamic class names like md:grid-cols-${x}. We map them explicitly.
  const cols = Math.min(cards.length + 1, 5)
  const gridClassesDesktop: Record<number, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5'
  }
  
  const gridClassesMobile: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4'
  }

  const desktopColClass = gridClassesDesktop[cols] || 'md:grid-cols-2'
  const mobileColClass = gridClassesMobile[cards.length] || 'grid-cols-1'
  
  // We need an empty space for the row headers of the table
  const renderHeaderEmptySpace = () => (
    <div className="hidden md:block p-6 border-r border-pm-border bg-pm-surface-soft/50">
      {/* Sticky empty corner if needed */}
    </div>
  )

  const renderCardHeaders = () => (
    <>
      {cards.map((data) => (
        <div key={data.card.id} className="p-4 sm:p-6 border-r border-pm-border last:border-r-0 bg-pm-surface relative group">
           <div className="w-full max-w-[160px] mx-auto mb-4 drop-shadow-md transition-transform group-hover:-translate-y-1">
             {(CARD_ART_MAP[data.card.name] || data.card.image_url) ? (
                <Image src={CARD_ART_MAP[data.card.name] || data.card.image_url!} alt={data.card.name} width={400} height={252} className="w-full h-auto rounded-xl border border-pm-border/50" />
              ) : (
                <div className="aspect-[1.586/1] bg-pm-surface-soft border border-pm-border rounded-xl flex items-center justify-center">
                  <span className="text-xs font-bold text-pm-ink-500">No Image</span>
                </div>
              )}
           </div>
           <h3 className="text-center font-bold text-pm-ink-900 text-sm sm:text-base leading-tight min-h-[40px] px-2 flex items-center justify-center">
             {data.card.name}
           </h3>
           <p className="text-center text-xs text-pm-ink-500 mt-1">{data.card.issuer}</p>
        </div>
      ))}
    </>
  )

  const renderRow = (
    label: string, 
    accessor: (data: CardComparePayload) => ReactNode, 
    isHighlightRow = false
  ) => (
    <div className={`grid grid-cols-2 ${desktopColClass} border-b border-pm-border`}>
      {/* Desktop Row Label */}
      <div className={`hidden md:flex items-center p-4 sm:p-6 border-r border-pm-border bg-pm-surface-soft/30 ${isHighlightRow ? 'bg-pm-accent-soft/20 text-pm-accent-strong' : 'text-pm-ink-900'}`}>
        <span className="text-sm font-bold tracking-tight">{label}</span>
      </div>
      
      {/* Values */}
      {cards.map(data => (
        <div key={`${data.card.id}-${label}`} className={`p-4 sm:p-6 border-r border-pm-border last:border-r-0 flex flex-col justify-center ${isHighlightRow ? 'bg-pm-accent-soft/10' : 'bg-pm-surface'}`}>
           <span className="md:hidden block text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-2">{label}</span>
           <div className={`text-sm ${isHighlightRow ? 'font-bold text-pm-ink-900' : 'text-pm-ink-700'}`}>
             {accessor(data)}
           </div>
        </div>
      ))}
    </div>
  )

  const BooleanCheck = ({ value, label }: { value: boolean, label?: string }) => (
    <div className="flex items-center gap-2">
      {value ? <Check className="w-4 h-4 text-pm-success" /> : <Minus className="w-4 h-4 text-pm-ink-300" />}
      {label && <span className={value ? 'text-pm-ink-900 font-medium' : 'text-pm-ink-500'}>{label}</span>}
    </div>
  )

  return (
    <div className="w-full max-w-[1200px] mx-auto px-0 sm:px-8 mb-20 overflow-visible">
       {/* Compare Table Container */}
       <div className="rounded-none sm:rounded-[24px] border-y sm:border border-pm-border bg-pm-surface shadow-sm overflow-hidden flex flex-col">
         
         {/* Desktop Header Row */}
         <div className={`hidden md:grid ${desktopColClass} border-b border-pm-border sticky top-[calc(var(--navbar-height,60px)+13px)] bg-pm-surface z-20 shadow-sm`}>
            {renderHeaderEmptySpace()}
            {renderCardHeaders()}
         </div>

         {/* Mobile Stacking Header */}
         <div className="md:hidden sticky top-[calc(var(--navbar-height,60px)+13px)] bg-pm-surface/90 backdrop-blur-md z-20 border-b border-pm-border">
            <div className={`grid ${mobileColClass}`}>
               {renderCardHeaders()}
            </div>
            
            {/* Mobile Section Nav Picker */}
            <div role="tablist" aria-label="Card comparison sections" className="flex w-full bg-pm-surface-soft border-t border-pm-border overflow-x-auto text-xs py-1 scrollbar-hide">
              {['verdict', 'fees', 'rewards', 'perks'].map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeMobileTab === tab}
                  aria-controls={`panel-${tab}`}
                  onClick={() => setActiveMobileTab(tab as 'verdict' | 'fees' | 'rewards' | 'perks')}
                  className={`flex-1 py-3 px-4 font-bold uppercase tracking-widest text-center whitespace-nowrap transition-colors ${activeMobileTab === tab ? 'text-pm-accent border-b-2 border-pm-accent' : 'text-pm-ink-500 hover:text-pm-ink-900 border-b-2 border-transparent'}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
         </div>

         {/* Sections */}
         <div className="flex flex-col">
           
           {/* SECTION: Verdict */}
           <div role="tabpanel" id="panel-verdict" className={`flex-col ${activeMobileTab === 'verdict' ? 'flex' : 'hidden md:flex'}`}>
             <div className="bg-pm-surface-soft border-b border-pm-border p-4 text-xs font-bold uppercase tracking-widest text-pm-ink-500 md:col-span-full">
               Quick Verdict
             </div>
             {renderRow("The TL;DR", d => d.quickVerdict, true)}
           </div>

           {/* SECTION: Fees & Math */}
           <div role="tabpanel" id="panel-fees" className={`flex-col ${activeMobileTab === 'fees' ? 'flex' : 'hidden md:flex'}`}>
             <div className="bg-pm-surface-soft border-b border-pm-border p-4 text-xs font-bold uppercase tracking-widest text-pm-ink-500 md:col-span-full">
               Fees & Math
             </div>
             {renderRow("Annual Fee", d => d.snapshot.annualFee === 0 ? <span className="text-pm-success font-bold">Free</span> : formatCurrencyRounded(d.snapshot.annualFee, d.snapshot.currency))}
             {renderRow("Welcome Bonus", d => d.snapshot.welcomeBonus ? (
               <div>
                  <div className="font-bold text-pm-ink-900">{d.snapshot.welcomeBonus.points.toLocaleString()} pts</div>
                  <div className="text-xs text-pm-ink-500 mt-1">Value: {formatCurrencyRounded(d.snapshot.welcomeBonus.estimatedValue, d.snapshot.currency)}</div>
                  <div className="text-[10px] text-pm-ink-400 mt-0.5">
                    Spend {formatCurrencyRounded(d.snapshot.welcomeBonus.spendRequirement, d.snapshot.currency)}
                    {d.snapshot.welcomeBonus.timeframeMonths ? ` in ${d.snapshot.welcomeBonus.timeframeMonths} mo` : ''}
                  </div>
               </div>
             ) : 'No Bonus')}
             {renderRow("Foreign Tx Fee", d => {
               const fee = d.snapshot.forexFeePct
               if (fee === null) return <span className="text-pm-ink-500">Not listed in the current card profile</span>
               return <BooleanCheck value={fee === 0} label={fee === 0 ? "0% (No fee)" : `${fee}% fee`} />
             })}
           </div>

           {/* SECTION: Rewards Engine */}
           <div role="tabpanel" id="panel-rewards" className={`flex-col ${activeMobileTab === 'rewards' ? 'flex' : 'hidden md:flex'}`}>
             <div className="bg-pm-surface-soft border-b border-pm-border p-4 text-xs font-bold uppercase tracking-widest text-pm-ink-500 md:col-span-full">
               Rewards Engine
             </div>
             {renderRow("Headline Earn Rates", d => (
               d.snapshot.headlineEarnRates.length > 0 ? (
               <ul className="space-y-2">
                 {d.snapshot.headlineEarnRates.map((r, idx) => (
                   <li key={idx} className="flex justify-between items-start text-xs leading-tight">
                     <span className="text-pm-ink-500 mr-2">{r.label}</span>
                     <span className="font-bold text-pm-ink-900 whitespace-nowrap">{r.rate}</span>
                   </li>
                 ))}
               </ul>
               ) : <span className="text-pm-ink-500">No normalized earn-rate profile available</span>
             ))}
           </div>

           {/* SECTION: Perks & Lifestyle */}
           <div role="tabpanel" id="panel-perks" className={`flex-col ${activeMobileTab === 'perks' ? 'flex' : 'hidden md:flex'}`}>
             <div className="bg-pm-surface-soft border-b border-pm-border p-4 text-xs font-bold uppercase tracking-widest text-pm-ink-500 md:col-span-full">
               Perks & Lifestyle
             </div>
             {renderRow("Lounge Access", d => (
               d.snapshot.loungeAccess
                 ? <BooleanCheck value={d.snapshot.loungeAccess.hasAccess} label={d.snapshot.loungeAccess.description || (d.snapshot.loungeAccess.hasAccess ? 'Included' : '')} />
                 : <span className="text-pm-ink-500">No lounge-access profile mapped</span>
             ))}
             {renderRow("Trust Signals", d => (
               d.trustMetadata ? (
                 <div className="flex flex-col gap-1">
                   <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-pm-surface-soft w-fit text-pm-ink-500 flex items-center gap-1 border border-pm-border">
                     <Check className="w-3 h-3" /> {d.trustMetadata.overallConfidence} Confidence
                   </span>
                   <span className="text-xs text-pm-ink-500 mt-1">{d.trustMetadata.sourcesCheckedCount} Sources Checked</span>
                 </div>
               ) : (
                 <span className="text-pm-ink-500">Source review is still being published.</span>
               )
             ))}
           </div>

           {/* SECTION: Apply Buttons (Sticky bottom on mobile, inline on desktop) */}
           <div className={`grid ${mobileColClass} ${desktopColClass} border-t-2 border-pm-accent/20 bg-pm-surface px-4 py-4 md:p-0 sticky bottom-0 md:relative shadow-[0_-10px_30px_rgba(0,0,0,0.05)] md:shadow-none z-30`}>
             <div className="hidden md:block p-6 border-r border-pm-border"></div>
             {cards.map((data) => (
               <div key={`apply-${data.card.id}`} className="md:p-6 p-1 border-r border-pm-border last:border-r-0 flex items-center justify-center">
                 <TrackedApplyButton
                   card={data.card}
                   region={region}
                   sourcePage={sourcePage}
                   recommendationMode={recommendationMode}
                   rank={data.rank}
                   className="pm-button w-full sm:w-auto text-sm py-3 px-6 shadow-md hover:shadow-pm-accent/20 block text-center"
                   label="Apply →"
                 />
               </div>
             ))}
           </div>

         </div>
       </div>
    </div>
  )
}
