'use client'

import React, { useState } from 'react'
import { format } from 'date-fns'
import { ShieldCheck, ChevronRight, AlertCircle } from 'lucide-react'
import { CardTrustMetadata } from '@/features/card-recommender/domain/ui-contract'
import { EvidenceDrawer } from './EvidenceDrawer'

interface TrustPanelProps {
  metadata?: CardTrustMetadata
  className?: string
}

export function TrustPanel({ metadata, className = '' }: TrustPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!metadata) return null

  const isHighlyConfident = metadata.overallConfidence === 'high'

  return (
    <>
      <div 
        onClick={() => setDrawerOpen(true)}
        className={`group bg-pm-surface border border-pm-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-pm-accent/50 hover:shadow-sm transition-all ${className}`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border shrink-0 ${
            isHighlyConfident 
              ? 'bg-pm-success-soft text-pm-success border-pm-success-border/50' 
              : 'bg-amber-50 text-amber-600 border-amber-200/50'
          }`}>
            {isHighlyConfident ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-sm text-pm-ink-900">Fact-Checked & Verified</span>
              <span className={`text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full ${
                isHighlyConfident ? 'bg-pm-success-soft text-pm-success' : 'bg-amber-50 text-amber-600'
              }`}>
                {metadata.overallConfidence} Confidence
              </span>
            </div>
            <div className="text-xs text-pm-ink-500 flex items-center gap-1 flex-wrap">
              Last audited {format(new Date(metadata.lastVerifiedDate), 'MMM d, yyyy')}
              <span className="text-pm-ink-500 mx-1">•</span>
              {metadata.sourcesCheckedCount} sources checked
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-pm-accent group-hover:translate-x-1 transition-transform sm:ml-auto">
          View Evidence <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      <EvidenceDrawer 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        metadata={metadata} 
      />
    </>
  )
}
