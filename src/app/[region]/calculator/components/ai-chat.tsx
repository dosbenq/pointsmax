'use client'

import { trackEvent } from '@/lib/analytics'
import type { ChatMsg, AIRec, AIClarify, CalculateResponse } from '../hooks/use-calculator-state'

interface AIChatProps {
  chatMessages: ChatMsg[]
  chatInput: string
  aiLoading: boolean
  aiStatus: string
  aiError: string | null
  blockedReason: string | null
  canUseAdvisor: boolean
  hasCalculatorResult: boolean
  result: CalculateResponse | null
  user: { email?: string } | null
  chatEndRef: React.RefObject<HTMLDivElement | null>
  onChatInputChange: (value: string) => void
  onSendMessage: (text?: string) => void
  onRetryLastMessage: () => void
  onClearChat: () => void
  onSwitchPanel: (panel: 'redemptions' | 'awards', source: string) => void
}

const EXAMPLE_GOALS = [
  'Weekend trip to NYC for 2',
  'Business class to Tokyo',
  'Family vacation to Hawaii',
  'Honeymoon in the Maldives',
]

export function AIChat({
  chatMessages,
  chatInput,
  aiLoading,
  aiStatus,
  aiError,
  blockedReason,
  canUseAdvisor,
  hasCalculatorResult,
  result,
  user,
  chatEndRef,
  onChatInputChange,
  onSendMessage,
  onRetryLastMessage,
  onClearChat,
  onSwitchPanel,
}: AIChatProps) {
  const handleSend = () => onSendMessage()

  return (
    <div className="pm-card-soft overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-pm-border flex items-center gap-2 flex-wrap">
        <span className="text-xl">✨</span>
        <h2 className="pm-heading text-base">AI Points Advisor</h2>
        <span className="pm-pill">Powered by PointsMax AI</span>
        {canUseAdvisor && chatMessages.length > 0 && user && (
          <button
            onClick={onClearChat}
            className="ml-auto text-xs text-pm-ink-500 hover:text-pm-ink-900 transition-colors"
          >
            Clear chat
          </button>
        )}
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-4 max-h-[600px] overflow-y-auto bg-pm-surface-soft/30">
        {!hasCalculatorResult && (
          <div className="rounded-xl border border-pm-border bg-pm-surface-soft px-4 py-3">
            <p className="text-pm-ink-700 text-sm">
              Add a destination in the calculator for more specific recommendations.
            </p>
          </div>
        )}

        {blockedReason && (
          <div className="rounded-xl border border-pm-border bg-pm-surface-soft px-4 py-3">
            <p className="text-pm-ink-900 text-sm font-medium">Guest advisor limit reached</p>
            <p className="mt-1 text-sm text-pm-ink-700">{blockedReason}</p>
          </div>
        )}

        {canUseAdvisor && chatMessages.length === 0 && !aiLoading && (
          <div>
            <p className="text-pm-ink-500 text-sm mb-4">
              Tell me where you want to go. I&apos;ll ask short clarifying questions and build a step-by-step plan with your points.
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_GOALS.map((eg) => (
                <button
                  key={eg}
                  onClick={() => onSendMessage(eg)}
                  disabled={!canUseAdvisor}
                  className="pm-button-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {eg}
                </button>
              ))}
            </div>
          </div>
        )}

        {canUseAdvisor && chatMessages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="bg-pm-accent text-pm-bg text-sm px-4 py-2.5 rounded-2xl rounded-br-sm max-w-xs shadow-sm">
                  {msg.text}
                </div>
              </div>
            ) : msg.payload.type === 'clarifying' ? (
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-pm-accent-soft text-pm-accent-strong border border-pm-accent-soft flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                  ✨
                </span>
                <div className="pm-card p-4 max-w-lg">
                  <p className="text-pm-ink-900 text-sm leading-relaxed">{(msg.payload as AIClarify).message}</p>
                  {(msg.payload as AIClarify).questions.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {(msg.payload as AIClarify).questions.map((q, qi) => (
                        <li key={qi} className="text-pm-accent text-sm flex gap-2">
                          <span className="text-pm-accent">•</span> {q}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-pm-accent-soft text-pm-accent-strong border border-pm-accent-soft flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                  ✨
                </span>
                <div className="flex-1">
                  <RecommendationCard rec={msg.payload as AIRec} />
                </div>
              </div>
            )}
          </div>
        ))}

        {canUseAdvisor && aiLoading && (
          <div className="flex gap-3">
            <span className="w-7 h-7 rounded-full bg-pm-accent-soft text-pm-accent-strong border border-pm-accent-soft flex items-center justify-center text-base flex-shrink-0">
              ✨
            </span>
            <div className="pm-card px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="animate-spin w-3.5 h-3.5 text-pm-accent" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <span className="text-pm-accent-strong text-sm">{aiStatus}</span>
              </div>
            </div>
          </div>
        )}

        {aiError && (
          <div className="rounded-xl border border-pm-danger-border bg-pm-danger-soft px-4 py-3 text-sm">
            <div className="flex items-start gap-2 text-pm-danger">
              <span className="text-base mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold">Points Advisor is temporarily unavailable</p>
                <p className="mt-1 opacity-90">{aiError}</p>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => onSwitchPanel(result ? 'redemptions' : 'awards', 'ai_error_fallback')}
                    className="font-medium underline underline-offset-4"
                  >
                    View non-AI results
                  </button>
                  <button
                    onClick={onRetryLastMessage}
                    className="text-xs bg-pm-surface-soft px-2 py-1 rounded border border-pm-danger-border hover:bg-pm-surface transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className="px-5 sm:px-6 py-4 border-t border-pm-border bg-pm-surface-soft">
        <div className="flex gap-3">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={aiLoading || !canUseAdvisor}
            placeholder={chatMessages.length === 0 ? 'e.g. I want to fly business class to Tokyo…' : 'Reply or ask a follow-up…'}
            className="pm-input flex-1"
          />
          <button
            onClick={handleSend}
            disabled={aiLoading || !chatInput.trim() || !canUseAdvisor}
            className="pm-button flex-shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

interface RecommendationCardProps {
  rec: AIRec
}

function RecommendationCard({ rec }: RecommendationCardProps) {
  const freshnessLabel = (() => {
    if (!rec.metadata?.freshness) return null
    const dt = new Date(rec.metadata.freshness)
    if (Number.isNaN(dt.getTime())) return null
    return `${dt.toISOString().slice(11, 16)} UTC`
  })()

  return (
    <div className="pm-card p-4 sm:p-5 space-y-4">
      <div className="space-y-1.5">
        <p className="pm-label text-pm-accent">Recommendation</p>
        <h3 className="pm-heading text-base">{rec.headline}</h3>
        <p className="pm-subtle text-sm leading-relaxed">{rec.reasoning}</p>
      </div>

      {rec.flight && (
        <div className="rounded-xl border border-pm-border bg-pm-surface-soft p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span>✈️</span>
            <span className="text-pm-ink-900 font-semibold text-sm">Flight</span>
            <span className="ml-auto text-xs bg-pm-accent-soft text-pm-accent-strong border border-pm-accent-soft px-2 py-0.5 rounded-full">
              {rec.flight.cabin}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Airline</p>
              <p className="text-pm-ink-900 mt-0.5 font-medium">{rec.flight.airline}</p>
            </div>
            <div>
              <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Route</p>
              <p className="text-pm-ink-900 mt-0.5 font-medium">{rec.flight.route}</p>
            </div>
            <div>
              <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Points needed</p>
              <p className="text-pm-success mt-0.5 font-bold">{rec.flight.points_needed}</p>
            </div>
            <div>
              <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Transfer from</p>
              <p className="text-pm-accent mt-0.5 font-medium">{rec.flight.transfer_chain}</p>
            </div>
          </div>
          {rec.flight.notes && (
            <p className="text-pm-ink-500 text-xs border-t border-pm-border pt-2">{rec.flight.notes}</p>
          )}
        </div>
      )}

      {rec.hotel && (
        <div className="rounded-xl border border-pm-border bg-pm-surface-soft p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span>🏨</span>
            <span className="text-pm-ink-900 font-semibold text-sm">Hotel</span>
            <span className="ml-auto text-xs bg-pm-accent-soft text-pm-accent-strong border border-pm-accent-soft px-2 py-0.5 rounded-full">
              {rec.hotel.chain}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2">
              <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Property</p>
              <p className="text-pm-ink-900 mt-0.5 font-medium">{rec.hotel.name}</p>
            </div>
            <div>
              <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Points/night</p>
              <p className="text-pm-success mt-0.5 font-bold">{rec.hotel.points_per_night}</p>
            </div>
            <div>
              <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Transfer from</p>
              <p className="text-pm-accent mt-0.5 font-medium">{rec.hotel.transfer_chain}</p>
            </div>
          </div>
          {rec.hotel.notes && (
            <p className="text-pm-ink-500 text-xs border-t border-pm-border pt-2">{rec.hotel.notes}</p>
          )}
        </div>
      )}

      {rec.total_summary && (
        <div className="rounded-xl px-4 py-3 border border-pm-success-border bg-pm-success-soft">
          <p className="text-xs text-pm-success font-semibold uppercase tracking-wider">Total</p>
          <p className="text-pm-success text-sm font-semibold mt-1">{rec.total_summary}</p>
        </div>
      )}

      {rec.steps?.length > 0 && (
        <div className="border-t border-pm-border pt-4">
          <p className="pm-label mb-2">Next steps</p>
          <ol className="space-y-2">
            {rec.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-pm-ink-900">
                <span className="w-5 h-5 rounded-full bg-pm-accent-soft text-pm-accent-strong border border-pm-accent-soft flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {rec.tip && (
        <p className="text-xs text-pm-ink-500 bg-pm-surface-soft rounded-lg px-3 py-2">💡 {rec.tip}</p>
      )}

      {rec.links?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rec.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('ai_recommendation_link_clicked', { label: link.label })}
              className="text-xs bg-pm-surface-soft hover:bg-pm-accent-soft/50 text-pm-accent-strong border border-pm-border px-3 py-1.5 rounded-full transition-colors"
            >
              {link.label} ↗
            </a>
          ))}
        </div>
      )}

      {rec.metadata && (
        <div className="pt-3 mt-1 border-t border-pm-border flex items-center justify-between text-[10px] text-pm-ink-500 uppercase tracking-tighter">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pm-success/60 animate-pulse" />
            <span>Updated {freshnessLabel ?? 'Unknown'}</span>
          </div>
          <div className="flex gap-2">
            <span>Source: {rec.metadata.source}</span>
            {rec.metadata.confidence && <span>• Trust: {rec.metadata.confidence}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
