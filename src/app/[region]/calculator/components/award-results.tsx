'use client'

import { useState } from 'react'
import { format, parseISO, isBefore, startOfToday } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AirportAutocomplete } from '@/components/AirportAutocomplete'
import { DataFreshness } from '@/components/ui/DataFreshness'
import type {
  AwardParams,
  AwardSearchResponse,
  AwardSearchResult,
  BalanceRow,
  Program,
} from '../hooks/use-calculator-state'
import type { Region } from '@/lib/regions'
import { formatCpp } from '@/lib/formatters'
import type { User } from '@supabase/supabase-js'

type BookingGuideStartResponse = {
  ok: boolean
  session?: { id: string }
}

interface AwardResultsProps {
  awardParams: AwardParams
  setAwardParams: React.Dispatch<React.SetStateAction<AwardParams>>
  awardLoading: boolean
  awardResult: AwardSearchResponse | null
  awardError: string | null
  onSearch: () => void
  region: Region
  programs: Program[]
  rows: BalanceRow[]
  user: User | null
}

const CABIN_LABELS: Record<AwardParams['cabin'], string> = {
  economy: 'Economy',
  premium_economy: 'Premium Economy',
  business: 'Business',
  first: 'First',
}

function closeDatePopover(setOpen: (open: boolean) => void) {
  window.setTimeout(() => {
    setOpen(false)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, 0)
}

export function AwardResults({
  awardParams,
  setAwardParams,
  awardLoading,
  awardResult,
  awardError,
  onSearch,
  region,
  programs,
  rows,
  user,
}: AwardResultsProps) {
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)
  const [bookingGuideStartingSlug, setBookingGuideStartingSlug] = useState<string | null>(null)
  const [bookingGuideStatus, setBookingGuideStatus] = useState<string | null>(null)
  const reachable = awardResult?.results.filter(r => r.is_reachable) ?? []
  const unreachable = awardResult?.results.filter(r => !r.is_reachable) ?? []
  const narrative = awardResult?.ai_narrative ?? null
  const estimatesOnly =
    awardResult?.provider === 'stub' &&
    awardResult?.error === 'real_availability_unavailable'

  const startBookingGuide = async (selectedResult: AwardSearchResult) => {
    if (!awardResult) return
    if (!user) {
      setBookingGuideStatus('Sign in to start a booking guide for this option.')
      return
    }

    const selectedBalances = rows
      .filter((row) => row.program_id && row.amount)
      .map((row) => {
        const balance = Number.parseInt(row.amount.replace(/[^\d]/g, ''), 10)
        const program = programs.find((candidate) => candidate.id === row.program_id)
        return {
          program_id: row.program_id,
          program_name: program?.name ?? row.program_id,
          balance,
        }
      })
      .filter((row) => Number.isFinite(row.balance) && row.balance > 0)

    setBookingGuideStartingSlug(selectedResult.program_slug)
    setBookingGuideStatus(null)

    try {
      const response = await fetch('/api/booking-guide/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redemption_label: `${selectedResult.program_name} for ${awardResult.params.origin} to ${awardResult.params.destination}`,
          booking_context: {
            origin: awardResult.params.origin,
            destination: awardResult.params.destination,
            cabin: awardResult.params.cabin,
            passengers: awardResult.params.passengers,
            start_date: awardResult.params.start_date,
            end_date: awardResult.params.end_date,
            program_name: selectedResult.program_name,
            program_slug: selectedResult.program_slug,
            estimated_miles: selectedResult.estimated_miles,
            points_needed_from_wallet: selectedResult.points_needed_from_wallet,
            transfer_chain: selectedResult.transfer_chain,
            transfer_is_instant: selectedResult.transfer_is_instant,
            has_real_availability: selectedResult.has_real_availability,
            availability_date: selectedResult.availability?.date ?? null,
            deep_link_url: selectedResult.deep_link.url,
            deep_link_label: selectedResult.deep_link.label,
            balances: selectedBalances,
          },
        }),
      })

      const payload = await response.json().catch(() => ({})) as Partial<BookingGuideStartResponse> & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to start booking guide')
      }

      setBookingGuideStatus(
        payload.session?.id
          ? `Booking guide started for ${selectedResult.program_name}. Session ${payload.session.id.slice(0, 8)} is ready.`
          : `Booking guide started for ${selectedResult.program_name}.`,
      )
    } catch (err) {
      setBookingGuideStatus(err instanceof Error ? err.message : 'Failed to start booking guide')
    } finally {
      setBookingGuideStartingSlug(null)
    }
  }

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
            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
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
                      closeDatePopover(setStartDateOpen)
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
            <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
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
                      closeDatePopover(setEndDateOpen)
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
                  <AwardResultCard
                    key={r.program_slug}
                    result={r}
                    topSlug={narrative?.top_pick_slug}
                    region={region}
                    canStartGuide={Boolean(user)}
                    isStartingGuide={bookingGuideStartingSlug === r.program_slug}
                    onStartGuide={startBookingGuide}
                  />
                ))}
              </div>
            )}

            {unreachable.length > 0 && (
              <div className="space-y-3">
                <p className="pm-label">Need more points</p>
                {unreachable.map(r => (
                  <AwardResultCard
                    key={r.program_slug}
                    result={r}
                    topSlug={narrative?.top_pick_slug}
                    muted
                    region={region}
                    canStartGuide={false}
                    isStartingGuide={false}
                    onStartGuide={startBookingGuide}
                  />
                ))}
              </div>
            )}

            <div className="rounded-xl p-4 border border-pm-border bg-pm-surface">
              <p className="pm-label mb-1">Booking guide</p>
              <p className="text-xs text-pm-ink-500">
                Start a guided booking session from any reachable result. The guide uses this route, transfer path, and your current wallet balances.
              </p>
              {!user && (
                <p className="text-xs text-pm-ink-500 mt-2">Sign in to start and save a booking guide session.</p>
              )}
              {bookingGuideStatus && (
                <p className="text-xs text-pm-accent-strong mt-2">{bookingGuideStatus}</p>
              )}
            </div>

            <DataFreshness />
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
  canStartGuide: boolean
  isStartingGuide: boolean
  onStartGuide: (result: AwardSearchResult) => void
}

function AwardResultCard({
  result: r,
  topSlug,
  muted = false,
  region,
  canStartGuide,
  isStartingGuide,
  onStartGuide,
}: AwardResultCardProps) {
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

      <div className="flex flex-wrap gap-2">
        <a
          href={r.deep_link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs bg-pm-surface-soft hover:bg-pm-accent-soft/50 text-pm-ink-900 border border-pm-border px-3 py-1.5 rounded-full transition-colors"
        >
          {r.deep_link.label}
          <span className="text-pm-ink-500">↗</span>
        </a>
        {r.is_reachable && (
          <button
            type="button"
            onClick={() => onStartGuide(r)}
            disabled={!canStartGuide || isStartingGuide}
            className="inline-flex items-center gap-1.5 text-xs bg-pm-accent-soft hover:bg-pm-accent-soft/80 text-pm-accent border border-pm-accent-border px-3 py-1.5 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStartingGuide ? 'Starting guide…' : 'Start booking guide'}
          </button>
        )}
      </div>
      {r.deep_link.note && (
        <p className="text-[11px] text-pm-ink-500">{r.deep_link.note}</p>
      )}
    </div>
  )
}
