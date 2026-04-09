'use client'

import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, ExternalLink, ShieldCheck, AlertCircle, Clock } from 'lucide-react'
import { CardTrustMetadata, TrustEvidence } from '@/features/card-recommender/domain/ui-contract'
import { formatDistanceToNow } from 'date-fns'
import { getSafeExternalUrl } from '@/lib/card-surfaces'

interface EvidenceDrawerProps {
  isOpen: boolean
  onClose: () => void
  metadata: CardTrustMetadata
}

export function EvidenceDrawer({ isOpen, onClose, metadata }: EvidenceDrawerProps) {
  const sources = Object.values(metadata.evidenceList)

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-pm-ink-900/40 backdrop-blur-sm z-50 animate-in fade-in transition-opacity" />
        <Dialog.Content className="fixed right-0 top-0 h-full w-full sm:w-[500px] bg-pm-bg shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="sticky top-0 bg-pm-surface/90 backdrop-blur-md border-b border-pm-border p-6 flex justify-between items-center z-10">
              <div>
                <Dialog.Title className="text-xl font-bold text-pm-ink-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-pm-accent" />
                  Source Evidence
                </Dialog.Title>
                <Dialog.Description className="text-sm text-pm-ink-500 mt-1">
                  We check multiple sources to ensure accuracy.
                </Dialog.Description>
              </div>
              <Dialog.Close className="p-2 hover:bg-pm-surface-soft rounded-full transition-colors">
                <X className="w-5 h-5 text-pm-ink-500" />
              </Dialog.Close>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 p-6 space-y-8">
              {/* Summary Block */}
              <div className="bg-pm-surface-soft border border-pm-border rounded-xl p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-pm-ink-500 block mb-1">Overall Confidence</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      metadata.overallConfidence === 'high' ? 'bg-pm-success-soft text-pm-success border-pm-success-border' :
                      metadata.overallConfidence === 'medium' ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                      'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                    } border`}>
                      {metadata.overallConfidence.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-pm-ink-500 block mb-1">Sources Checked</span>
                    <span className="text-lg font-bold text-pm-ink-900">{metadata.sourcesCheckedCount} independent sources</span>
                  </div>
                </div>
                
                {metadata.latestChangeSummary && (
                  <div className="mt-4 pt-4 border-t border-pm-border">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-pm-ink-500 block mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Latest Change
                    </span>
                    <p className="text-sm text-pm-ink-700">{metadata.latestChangeSummary}</p>
                  </div>
                )}
              </div>

              {/* Citations List */}
              <div>
                <h3 className="text-sm font-bold text-pm-ink-900 uppercase tracking-widest mb-4">Detailed Citations</h3>
                <div className="space-y-4">
                  {sources.map((evidence) => (
                    <EvidenceItem key={evidence.id} evidence={evidence} />
                  ))}
                  {sources.length === 0 && (
                     <p className="text-sm text-pm-ink-500 italic">No detailed citations available for this card.</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-pm-border bg-pm-surface text-center">
               <p className="text-xs text-pm-ink-500">
                 Notice an error? <a href="mailto:support@pointsmax.com" className="text-pm-accent hover:underline">Let our researchers know.</a>
               </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function EvidenceItem({ evidence }: { evidence: TrustEvidence }) {
  const sourceUrl = getSafeExternalUrl(evidence.sourceUrl)

  return (
    <div className="bg-pm-surface border border-pm-border rounded-xl p-4 shadow-sm hover:border-pm-accent/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="font-bold text-pm-ink-900 text-sm">{evidence.id.replace(/_/g, ' ')}</span>
        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
          evidence.confidence === 'high' ? 'text-pm-success bg-pm-success-soft' :
          evidence.confidence === 'medium' ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950' :
          'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950'
        }`}>
          {evidence.confidence}
        </span>
      </div>
      
      <div className="text-sm text-pm-ink-700 mb-3 font-medium">
        Value: {evidence.value}
      </div>
      
      {evidence.notes && (
        <p className="text-xs text-pm-ink-500 mb-3 bg-pm-surface-soft p-2 rounded-md">
          {evidence.notes}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-pm-ink-500 mt-2 pt-3 border-t border-pm-border/50">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(evidence.lastCheckedAt))} ago
          </span>
          <span className="uppercase tracking-wider font-semibold border-l border-pm-border pl-3">
            {evidence.sourceType}
          </span>
        </div>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-pm-accent hover:underline font-semibold">
            View Source <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}
