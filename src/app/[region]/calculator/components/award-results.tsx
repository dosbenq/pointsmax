// ============================================================
// AwardResults — Sprint 18
// Extracted AwardSearchPanel and AwardResultCard from calculator
// ============================================================

'use client'

import { format, parseISO, isBefore, startOfToday } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AirportAutocomplete } from '@/components/AirportAutocomplete'
import type { AwardParams, AwardSearchResponse, AwardSearchResult } from '../hooks/use-calculator-state'
import type { Region } from '@/lib/regions'
import { formatCpp } from '@/lib/formatters'

interface AwardResultsProps {
  awardParams: AwardParams
  setAwardParams: React.Dispatch<React.SetStateAction<AwardParams>>
  awardLoading: boolean
  awardResult: AwardSearchResponse | null
  awardError: string | null
  onSearch: () => void
  region: Region
}

const CABIN_LABELS: Record<AwardParams['cabin'], string> = {
  economy: 'Economy',
  premium_economy: 'Premium Economy',
  business: 'Business',
  first: 'First',
}

export function AwardResults({
  awardParams,
  setAwardParams,
  awardLoading,
  awardResult,
  awardError,
  onSearch,
  region,
}: AwardResultsProps) {
  const reachable = awardResult?.results.filter(r => r.is_reachable) ?? []
  const unreachable = awardResult?.results.filter(r => !r.is_reachable) ?? []
  const narrative = awardResult?.ai_narrative ?? null
  const estimatesOnly =
    awardResult?.provider === 'stub' &&
    awardResult?.error === 'real_availability_unavailable'

  return (
    <div className="flex flex-col">
      {/* Top: Form Inputs */}
      <div className="p-8 lg:p-10 space-y-6 bg-pm-surface">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">✈️</span>
          <h2 className="pm-heading text-lg">Find Award Flights</h2>
          <span className="pm-pill ml-2">
            {awardResult?.provider === 'seats_aero' ? 'Live Search' : 'Chart estimates'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pm-label block mb-1.5">From</label>
            <AirportAutocomplete
              id="award-origin"
              value={awardParams.origin}
              onChange={(val) => setAwardParams(p => ({ ...p, origin: val }))}
              placeholder="Origin"
              className="w-full bg-pm-surface-soft hover:bg-pm-surface-raised transition-colors py-2 min-h-[46px]"
            />
          </div>
          <div>
            <label className="pm-label block mb-1.5">To</label>
            <AirportAutocomplete
              id="award-dest"
              value={awardParams.destination}
              onChange={(val) => setAwardParams(p => ({ ...p, destination: val }))}
              placeholder="Dest"
              className="w-full bg-pm-surface-soft hover:bg-pm-surface-raised transition-colors py-2 min-h-[46px]"
            />
          </div>
        </div>

        {/* Date Pickers */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pm-label block mb-1.5">Earliest Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal pm-input bg-pm-surface hover:bg-pm-surface-soft',
                    !awardParams.start_date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-pm-ink-500" />
                  {awardParams.start_date ? format(parseISO(awardParams.start_date), 'PP') : <span>Pick date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-pm-surface" align="start">
                <Calendar
                  mode="single"
                  selected={awardParams.start_date ? parseISO(awardParams.start_date) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const isoDate = format(date, 'yyyy-MM-dd')
                      setAwardParams((p) => {
                        const shouldClearEnd = !!p.end_date && p.end_date <= isoDate
                        return {
                          ...p,
                          start_date: isoDate,
                          end_date: shouldClearEnd ? '' : p.end_date,
                        }
                      })
                    }
                  }}
                  disabled={(date) => isBefore(date, startOfToday())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="pm-label block mb-1.5">Latest Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal pm-input bg-pm-surface hover:bg-pm-surface-soft',
                    !awardParams.end_date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-pm-ink-500" />
                  {awardParams.end_date ? format(parseISO(awardParams.end_date), 'PP') : <span>Pick date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-pm-surface" align="start">
                <Calendar
                  mode="single"
                  selected={awardParams.end_date ? parseISO(awardParams.end_date) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setAwardParams((p) => ({ ...p, end_date: format(date, 'yyyy-MM-dd') }))
                    }
                  }}
                  disabled={(date) => {
                    const minDate = awardParams.start_date ? parseISO(awardParams.start_date) : startOfToday()
                    return isBefore(date, minDate)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pm-label block mb-1.5">Cabin</label>
            <select
              value={awardParams.cabin}
              onChange={e => setAwardParams(p => ({ ...p, cabin: e.target.value as AwardParams['cabin'] }))}
              className="pm-input"
            >
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </div>
          <div>
            <label className="pm-label block mb-1.5">Passengers</label>
            <select
              value={awardParams.passengers}
              onChange={e => setAwardParams(p => ({ ...p, passengers: parseInt(e.target.value, 10) }))}
              className="pm-input"
            >
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <option key={n} value={n}>{n} passenger{n !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {awardError && (
          <p className="text-sm text-pm-danger bg-pm-danger-soft rounded-xl px-4 py-2 border border-pm-danger-border">{awardError}</p>
        )}
        {estimatesOnly && (
          <p className="text-sm text-pm-warning bg-pm-warning-soft rounded-xl px-4 py-2 border border-pm-warning-border">
            {awardResult?.message ?? 'Showing chart estimates · Live seat availability requires API configuration.'}
          </p>
        )}

        <button
          onClick={onSearch}
          disabled={awardLoading || !awardParams.origin || !awardParams.destination || !awardParams.start_date || !awardParams.end_date}
          className="pm-button w-full"
        >
          {awardLoading ? (
            <>
              <svg className="animate-spin w-4 h-4 mr-2 inline" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Searching award space…
            </>
          ) : 'Search Award Flights →'}
        </button>
      </div>

      {/* Bottom: Results & Analysis */}
      {awardResult && (
        <div className="p-8 lg:p-10 bg-pm-surface-soft border-t border-pm-border border-dashed">
          <div className="space-y-6">
            {narrative && (
              <div className="rounded-xl p-4 space-y-3 border border-pm-accent-soft bg-pm-accent-soft/30">
                <p className="pm-label text-pm-accent">AI analysis</p>
                <p className="pm-heading text-base leading-snug">{narrative.headline}</p>
                <p className="text-pm-ink-900 text-sm leading-relaxed">{narrative.body}</p>
                {narrative.booking_tips?.length > 0 && (
                  <div>
                    <p className="pm-label text-pm-accent mb-1.5">Booking tips</p>
                    <ul className="space-y-1">
                      {narrative.booking_tips.map((tip, i) => (
                        <li key={i} className="flex gap-2 text-sm text-pm-ink-900">
                          <span className="text-pm-accent flex-shrink-0">•</span>{tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {narrative.warnings?.length > 0 && (
                  <div className="bg-pm-warning-soft border border-pm-warning-border rounded-lg px-3 py-2 space-y-1">
                    {narrative.warnings.map((w, i) => (
                      <p key={i} className="text-pm-warning text-xs flex gap-2">
                        <span>⚠️</span>{w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-pm-ink-500">
              {awardResult.params.origin} → {awardResult.params.destination} ·{' '}
              {CABIN_LABELS[awardResult.params.cabin]} · {awardResult.params.passengers} pax ·{' '}
              {reachable.length} reachable program{reachable.length !== 1 ? 's' : ''}
            </p>

            {reachable.length > 0 && (
              <div className="space-y-3">
                <p className="pm-label text-pm-success">Reachable with your points</p>
                {reachable.map(r => (
                  <AwardResultCard key={r.program_slug} result={r} topSlug={narrative?.top_pick_slug} region={region} />
                ))}
              </div>
            )}

            {unreachable.length > 0 && (
              <div className="space-y-3">
                <p className="pm-label">Need more points</p>
                {unreachable.map(r => (
                  <AwardResultCard key={r.program_slug} result={r} topSlug={narrative?.top_pick_slug} muted region={region} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface AwardResultCardProps {
  result: AwardSearchResult
  topSlug?: string
  muted?: boolean
  region: Region
}

function AwardResultCard({ result: r, topSlug, muted = false, region }: AwardResultCardProps) {
  const isTopPick = r.program_slug === topSlug

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
      muted
        ? 'bg-pm-surface-soft border-pm-border opacity-70'
        : isTopPick
        ? 'bg-pm-accent-soft border-pm-accent-border'
        : 'bg-pm-surface border-pm-border'
    }`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.program_color }} />
        <span className="text-pm-ink-900 font-semibold text-sm">{r.program_name}</span>

        {isTopPick && !muted && (
          <span className="text-xs bg-pm-accent text-pm-bg px-2 py-0.5 rounded-full font-semibold">Top pick</span>
        )}
        {r.has_real_availability && (
          <span className="text-xs bg-pm-success-soft text-pm-success border border-pm-success-border px-2 py-0.5 rounded-full">Live</span>
        )}
        {!r.has_real_availability && (
          <span className="text-xs bg-pm-surface-soft text-pm-ink-500 border border-pm-border px-2 py-0.5 rounded-full">Estimate</span>
        )}
        {r.transfer_is_instant && r.transfer_chain && (
          <span className="text-xs bg-pm-accent-soft text-pm-accent-strong border border-pm-accent-soft px-2 py-0.5 rounded-full">Instant transfer</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Miles needed</p>
          <p className="text-pm-success font-bold mt-0.5">{r.estimated_miles.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Est. value</p>
          <p className="text-pm-ink-900 font-semibold mt-0.5">
            {(r.estimated_cash_value_cents / 100).toLocaleString('en-US', {
              style: 'currency', currency: 'USD', maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div>
          <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Rate</p>
          <p className="text-pm-ink-900 mt-0.5">{formatCpp(r.cpp_cents, region)}</p>
        </div>
      </div>

      {r.availability && (
        <div className="text-xs text-pm-success">
          ✓ Available on {new Date(r.availability.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}

      {r.transfer_chain && (
        <p className="text-xs text-pm-accent">{r.transfer_chain}</p>
      )}

      {!r.is_reachable && (
        <p className="text-xs text-pm-ink-500">
          Need {r.points_needed_from_wallet.toLocaleString()} points from wallet.
        </p>
      )}

      <a
        href={r.deep_link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs bg-pm-surface-soft hover:bg-pm-accent-soft/50 text-pm-ink-900 border border-pm-border px-3 py-1.5 rounded-full transition-colors"
      >
        {r.deep_link.label}
        <span className="text-pm-ink-500">↗</span>
      </a>
      {r.deep_link.note && (
        <p className="text-[11px] text-pm-ink-500">{r.deep_link.note}</p>
      )}
    </div>
  )
}
