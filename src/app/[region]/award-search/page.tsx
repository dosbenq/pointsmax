'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useParams, useSearchParams } from 'next/navigation'
import { format, parseISO, isBefore, startOfToday } from 'date-fns'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
import type { Program } from '@/types/database'
import type { AwardNarrative, AwardSearchResponse, AwardSearchResult, CabinClass } from '@/lib/award-search/types'
import { type Region } from '@/lib/regions'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AirportAutocomplete } from '@/components/AirportAutocomplete'

type ProgramOption = Pick<Program, 'id' | 'name' | 'short_name' | 'type' | 'color_hex'>
type BalanceRow = { id: string; program_id: string; amount: string }
type BookingGuideStartResponse = {
  ok: boolean
  session?: { id: string }
}

type AwardParams = {
  origin: string
  destination: string
  start_date: string
  end_date: string
  cabin: CabinClass
  passengers: number
}

const CABIN_OPTIONS: Array<{ value: CabinClass; label: string }> = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
]

const CABIN_LABELS: Record<CabinClass, string> = {
  economy: 'Economy',
  premium_economy: 'Premium Economy',
  business: 'Business',
  first: 'First',
}

function parsePointsAmount(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '')
  if (!digitsOnly) return NaN
  return Number.parseInt(digitsOnly, 10)
}

function addDaysToIsoDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatCpp(cppCents: number | null | undefined, region: Region): string {
  if (cppCents == null || !Number.isFinite(cppCents)) return '—'
  if (region === 'in') return `${Math.round(cppCents)} paise/pt`
  return `${cppCents.toFixed(2)}¢/pt`
}

function formatUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return `$${(cents / 100).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`
}

function getValueTone(cppCents: number): string {
  if (cppCents >= 3) return 'border-pm-success-border ring-2 ring-pm-success-border/50'
  if (cppCents >= 2) return 'border-pm-success-border'
  if (cppCents >= 1) return 'border-amber-300'
  return 'border-pm-border'
}

function getValueTextTone(cppCents: number): string {
  if (cppCents >= 2) return 'text-pm-success-strong'
  if (cppCents >= 1) return 'text-amber-700'
  return 'text-pm-ink-900'
}

function closeDatePopover(setOpen: (open: boolean) => void) {
  window.setTimeout(() => {
    setOpen(false)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, 0)
}

function AwardResultCard({
  result,
  topSlug,
  region,
  canStartGuide,
  isStartingGuide,
  onStartGuide,
}: {
  result: AwardSearchResult
  topSlug?: string
  region: Region
  canStartGuide: boolean
  isStartingGuide: boolean
  onStartGuide: (result: AwardSearchResult) => void
}) {
  const isTopPick = result.program_slug === topSlug
  const resultClass = isTopPick
    ? `bg-pm-accent-soft border-pm-accent-border ${result.cpp_cents >= 3 ? 'ring-2 ring-pm-accent-border/60' : ''}`
    : result.is_reachable
      ? `bg-pm-surface ${getValueTone(result.cpp_cents)}`
      : 'bg-pm-surface-soft border-pm-border opacity-80'
  const valueTone = getValueTextTone(result.cpp_cents)
  const valueSourceLabel = result.cash_value_source === 'live_fare_api' ? 'Live price' : 'Estimated'
  const valueTooltip = `${result.estimated_miles.toLocaleString()} miles for ${formatUsd(result.estimated_cash_value_cents)} = ${formatCpp(result.cpp_cents, region)}`

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${resultClass}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: result.program_color }} />
        <span className="text-pm-ink-900 font-semibold text-sm">{result.program_name}</span>
        {isTopPick && (
          <span className="text-xs bg-pm-accent text-pm-bg px-2 py-0.5 rounded-full font-semibold">Top pick</span>
        )}
        {result.has_real_availability && (
          <span className="text-xs bg-pm-success-soft text-pm-success border border-pm-success-border px-2 py-0.5 rounded-full">Live</span>
        )}
        {!result.has_real_availability && (
          <span className="text-xs bg-pm-surface-soft text-pm-ink-500 border border-pm-border px-2 py-0.5 rounded-full">Estimate</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Miles needed</p>
          <p className="text-pm-success font-bold mt-0.5">{result.estimated_miles.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Wallet points</p>
          <p className="text-pm-ink-900 font-semibold mt-0.5">{result.points_needed_from_wallet.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-pm-ink-500 uppercase tracking-wider font-semibold text-[10px]">Value</p>
          <p
            className={`mt-0.5 font-semibold ${valueTone}`}
            title={valueTooltip}
          >
            {formatCpp(result.cpp_cents, region)}
          </p>
          <p className="mt-1 text-[10px] text-pm-ink-500">{formatUsd(result.estimated_cash_value_cents)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-pm-ink-500">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${result.cash_value_source === 'live_fare_api' ? 'bg-pm-success-soft text-pm-success-strong' : 'bg-pm-surface-soft text-pm-ink-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${result.cash_value_source === 'live_fare_api' ? 'bg-pm-success' : 'bg-pm-ink-400'}`} />
          {valueSourceLabel}
        </span>
        <span title={valueTooltip}>
          {result.estimated_miles.toLocaleString()} miles for {formatUsd(result.estimated_cash_value_cents)}
        </span>
      </div>

      {result.transfer_chain && (
        <p className="text-xs text-pm-accent">{result.transfer_chain}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={result.deep_link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs bg-pm-surface-soft hover:bg-pm-success-soft text-pm-ink-700 border border-pm-border px-3 py-1.5 rounded-full transition-colors"
        >
          {result.deep_link.label}
          <span className="text-pm-ink-500">↗</span>
        </a>
        {result.is_reachable && (
          <button
            type="button"
            onClick={() => onStartGuide(result)}
            disabled={!canStartGuide || isStartingGuide}
            className="inline-flex items-center gap-1.5 text-xs bg-pm-accent-soft hover:bg-pm-accent-soft/80 text-pm-accent border border-pm-accent-border px-3 py-1.5 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStartingGuide ? 'Starting guide…' : 'Start booking guide'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function AwardSearchPage() {
  const routeParams = useParams()
  const searchParams = useSearchParams()
  const region = ((routeParams.region as string) === 'in' ? 'in' : 'us') as Region
  const defaultOrigin = region === 'in' ? 'DEL' : 'JFK'
  const defaultDestination = 'LHR'
  const originFromQuery = (searchParams.get('origin') || defaultOrigin).trim().toUpperCase().slice(0, 3)
  const destinationFromQuery = (searchParams.get('destination') || defaultDestination).trim().toUpperCase().slice(0, 3)

  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [rows, setRows] = useState<BalanceRow[]>([{ id: '1', program_id: '', amount: '' }])
  const [params, setParams] = useState<AwardParams>({
    origin: originFromQuery,
    destination: destinationFromQuery,
    start_date: addDaysToIsoDate(30),
    end_date: addDaysToIsoDate(37),
    cabin: 'business',
    passengers: 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AwardSearchResponse | null>(null)
  const [narrative, setNarrative] = useState<AwardNarrative | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [watchSaving, setWatchSaving] = useState(false)
  const [watchStatus, setWatchStatus] = useState<string | null>(null)
  const [bookingGuideStartingSlug, setBookingGuideStartingSlug] = useState<string | null>(null)
  const [bookingGuideStatus, setBookingGuideStatus] = useState<string | null>(null)
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)

  // Clear balances when region changes
  useEffect(() => {
    setRows([{ id: 'seed-1', program_id: '', amount: '' }])
    setResult(null)
  }, [region])

  useEffect(() => {
    fetch(`/api/programs?region=${region.toUpperCase()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load programs (${res.status})`)
        return res.json() as Promise<ProgramOption[]>
      })
      .then((data) => setPrograms(data ?? []))
      .catch(() => setError('Failed to load program data. Please refresh and try again.'))
  }, [region])

  // Load balances (region-specific)
  useEffect(() => {
    if (!user) return
    fetch(`/api/user/balances?region=${encodeURIComponent(region.toUpperCase())}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load balances (${res.status})`)
        return res.json() as Promise<{ balances?: Array<{ program_id: string; balance: number }> }>
      })
      .then((payload) => {
        const balances = payload.balances ?? []
        if (balances.length === 0) return
        setRows(
          balances.map((b, idx) => ({
            id: `seed-${idx + 1}`,
            program_id: b.program_id,
            amount: String(Math.max(0, Math.round(b.balance))),
          })),
        )
      })
      .catch(() => {
        // Keep form usable without blocking on profile data.
      })
  }, [user, region])

  const byType = (type: Program['type']) => programs.filter((p) => p.type === type)
  const addRow = () => setRows((prev) => [...prev, { id: Date.now().toString(), program_id: '', amount: '' }])
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))
  const updateRow = (id: string, field: 'program_id' | 'amount', value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const isSearchReady = Boolean(
    params.origin &&
    params.destination &&
    params.start_date &&
    params.end_date &&
    rows.some((r) => r.program_id && parsePointsAmount(r.amount) > 0),
  )

  const submitSearch = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setNarrative(null)
    setNarrativeLoading(false)
    setWatchStatus(null)
    setBookingGuideStatus(null)

    try {
      const balances = rows
        .filter((r) => r.program_id && r.amount)
        .map((r) => ({ program_id: r.program_id, amount: parsePointsAmount(r.amount) }))
        .filter((b) => Number.isFinite(b.amount) && b.amount > 0)

      if (balances.length === 0) {
        throw new Error('Add at least one valid point balance.')
      }

      const res = await fetch('/api/award-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          origin: params.origin.toUpperCase(),
          destination: params.destination.toUpperCase(),
          balances,
          include_narrative: false,
        }),
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || 'Award search failed.')
      }
      setResult(payload as AwardSearchResponse)
      setNarrative((payload as AwardSearchResponse).ai_narrative ?? null)
    } catch (err) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setError('You appear to be offline. Reconnect and try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Award search failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!result || result.results.length === 0 || narrative) return
    const paramsPayload = {
      origin: result.params.origin,
      destination: result.params.destination,
      cabin: result.params.cabin,
      passengers: result.params.passengers,
      start_date: result.params.start_date,
      end_date: result.params.end_date,
    }
    const resultsPayload = result.results.slice(0, 8).map((row) => ({
      program_slug: row.program_slug,
      program_name: row.program_name,
      estimated_miles: row.estimated_miles,
      estimated_cash_value_cents: row.estimated_cash_value_cents,
      transfer_chain: row.transfer_chain,
      has_real_availability: row.has_real_availability,
      is_reachable: row.is_reachable,
    }))
    const query = new URLSearchParams({
      params: JSON.stringify(paramsPayload),
      results: JSON.stringify(resultsPayload),
    })

    const controller = new AbortController()
    setNarrativeLoading(true)
    fetch(`/api/award-search/narrative?${query.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return
        const payload = await res.json() as { ai_narrative?: AwardNarrative | null }
        setNarrative(payload.ai_narrative ?? null)
      })
      .catch(() => {
        // Keep page usable without narrative.
      })
      .finally(() => setNarrativeLoading(false))

    return () => {
      controller.abort()
    }
  }, [result, narrative])

  const reachable = useMemo(() => result?.results.filter((r) => r.is_reachable) ?? [], [result])
  const unreachable = useMemo(() => result?.results.filter((r) => !r.is_reachable) ?? [], [result])
  const topSlug = narrative?.top_pick_slug ?? result?.ai_narrative?.top_pick_slug
  const estimatesOnly = result?.error === 'real_availability_unavailable'
  const searchWarnings = result?.warnings ?? []

  const saveWatch = async () => {
    if (!result || !user) return
    setWatchSaving(true)
    setWatchStatus(null)

    try {
      const firstReachable = result.results.find((row) => row.is_reachable)
      const firstOption = firstReachable ?? result.results[0]
      const maxPoints = firstOption?.points_needed_from_wallet ?? null

      const response = await fetch('/api/flight-watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: result.params.origin,
          destination: result.params.destination,
          cabin: result.params.cabin,
          start_date: result.params.start_date,
          end_date: result.params.end_date,
          max_points: maxPoints,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save watch')
      }
      setWatchStatus('Watch saved. Deal Scout will monitor this route and notify you when a match appears.')
    } catch (err) {
      setWatchStatus(err instanceof Error ? err.message : 'Failed to save watch')
    } finally {
      setWatchSaving(false)
    }
  }

  const startBookingGuide = async (selectedResult: AwardSearchResult) => {
    if (!result) return
    if (!user) {
      setBookingGuideStatus('Sign in to start a booking guide for this option.')
      return
    }

    const selectedBalances = rows
      .filter((row) => row.program_id && parsePointsAmount(row.amount) > 0)
      .map((row) => {
        const program = programs.find((candidate) => candidate.id === row.program_id)
        return {
          program_id: row.program_id,
          program_name: program?.name ?? row.program_id,
          balance: parsePointsAmount(row.amount),
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
          redemption_label: `${selectedResult.program_name} for ${result.params.origin} to ${result.params.destination}`,
          booking_context: {
            origin: result.params.origin,
            destination: result.params.destination,
            cabin: result.params.cabin,
            passengers: result.params.passengers,
            start_date: result.params.start_date,
            end_date: result.params.end_date,
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
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-pm-accent-border bg-pm-accent-soft px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-pm-accent">
                Planner subflow
              </span>
              <h1 className="mt-5 pm-display text-[3.15rem] leading-[0.93] sm:text-[4.5rem]">
                Search award space with a better decision frame.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-pm-ink-700">
                Use this when you already know the route. Planner remains the main decision surface; Award Search is the direct verification tool.
              </p>
              <Link
                href={`/${region}/calculator`}
                className="mt-5 inline-flex items-center text-sm font-semibold text-pm-ink-900 hover:text-pm-accent underline underline-offset-4 transition-colors"
              >
                Back to Planner
              </Link>
            </div>

            <div className="pm-card-soft p-5 text-pm-ink-900">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-pm-ink-500">Search snapshot</p>
              <div className="mt-4 pm-card px-5 py-5 text-pm-ink-900">
                <p className="text-lg font-semibold leading-8 tracking-[-0.03em]">
                  {params.origin || defaultOrigin} → {params.destination || defaultDestination}
                </p>
                <div className="mt-5 space-y-3 border-t border-pm-border pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-pm-ink-500">Cabin</span>
                    <span className="font-semibold text-pm-ink-900">{CABIN_LABELS[params.cabin]}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-pm-ink-500">Date range</span>
                    <span className="font-semibold text-right text-pm-ink-900">{params.start_date} → {params.end_date}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-pm-ink-500">Wallet balances</span>
                    <span className="font-semibold text-pm-ink-900">{rows.filter((row) => row.program_id && parsePointsAmount(row.amount) > 0).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="pm-shell py-8 w-full flex-1 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="pm-card-soft p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="pm-section-title mb-2">Inputs</p>
                <h2 className="pm-heading text-lg">Define the route and balances</h2>
                <p className="mt-2 text-sm leading-7 text-pm-ink-700">
                  This page works best when you already know the route you want to verify and just need the reachable programs, transfer path, and booking links.
                </p>
              </div>
              <div className="hidden rounded-full bg-[#0f2747] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#f4f8ff] sm:inline-flex">
                Search
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="pm-label block mb-1.5">From</label>
                <AirportAutocomplete
                  id="award-origin"
                  value={params.origin}
                  onChange={(val) => setParams((p) => ({ ...p, origin: val }))}
                  placeholder={defaultOrigin}
                  className="w-full bg-pm-surface-soft hover:bg-pm-surface-raised transition-colors py-2 min-h-[46px]"
                />
              </div>
              <div>
                <label className="pm-label block mb-1.5">To</label>
                <AirportAutocomplete
                  id="award-dest"
                  value={params.destination}
                  onChange={(val) => setParams((p) => ({ ...p, destination: val }))}
                  placeholder={defaultDestination}
                  className="w-full bg-pm-surface-soft hover:bg-pm-surface-raised transition-colors py-2 min-h-[46px]"
                />
              </div>
            </div>

            {/* K12: Date Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="pm-label block mb-1.5">Earliest date</label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal pm-input bg-pm-surface hover:bg-pm-surface-soft',
                        !params.start_date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-pm-ink-500" />
                      {params.start_date ? (
                        format(parseISO(params.start_date), 'PP')
                      ) : (
                        <span>Pick date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-pm-surface" align="start">
                    <Calendar
                      mode="single"
                      selected={params.start_date ? parseISO(params.start_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const isoDate = format(date, 'yyyy-MM-dd')
                          setParams((p) => {
                            const clearEnd = Boolean(p.end_date && p.end_date < isoDate)
                            return { ...p, start_date: isoDate, end_date: clearEnd ? '' : p.end_date }
                          })
                          closeDatePopover(setStartDateOpen)
                        }
                      }}
                      disabled={(date) => isBefore(date, startOfToday())}
                      initialFocus
                      classNames={{
                        day_selected: 'bg-pm-accent text-pm-bg hover:bg-pm-accent-strong',
                        day_today: 'bg-pm-accent-soft text-pm-accent',
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="pm-label block mb-1.5">Latest date</label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal pm-input bg-pm-surface hover:bg-pm-surface-soft',
                        !params.end_date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-pm-ink-500" />
                      {params.end_date ? (
                        format(parseISO(params.end_date), 'PP')
                      ) : (
                        <span>Pick date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-pm-surface" align="start">
                    <Calendar
                      mode="single"
                      selected={params.end_date ? parseISO(params.end_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setParams((p) => ({ ...p, end_date: format(date, 'yyyy-MM-dd') }))
                          closeDatePopover(setEndDateOpen)
                        }
                      }}
                      disabled={(date) => {
                        const minDate = params.start_date ? parseISO(params.start_date) : startOfToday()
                        return isBefore(date, minDate)
                      }}
                      initialFocus
                      classNames={{
                        day_selected: 'bg-pm-accent text-pm-bg hover:bg-pm-accent-strong',
                        day_today: 'bg-pm-accent-soft text-pm-accent',
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="pm-label block mb-1.5">Cabin</label>
                <select
                  value={params.cabin}
                  onChange={(e) => setParams((p) => ({ ...p, cabin: e.target.value as CabinClass }))}
                  className="pm-input"
                >
                  {CABIN_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="pm-label block mb-1.5">Passengers</label>
                <select
                  value={params.passengers}
                  onChange={(e) => setParams((p) => ({ ...p, passengers: Number.parseInt(e.target.value, 10) }))}
                  className="pm-input"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>{n} passenger{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="pm-label">Wallet balances</h3>
                <button onClick={addRow} className="pm-button-secondary px-3 py-1.5 text-xs">
                  + Add balance
                </button>
              </div>

              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_150px_auto] gap-2">
                  <select
                    value={row.program_id}
                    onChange={(e) => updateRow(row.id, 'program_id', e.target.value)}
                    className="pm-input"
                  >
                    <option value="">Select program</option>
                    {byType('transferable_points').length > 0 && (
                      <optgroup label="Transferable points">
                        {byType('transferable_points').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </optgroup>
                    )}
                    {byType('airline_miles').length > 0 && (
                      <optgroup label="Airline miles">
                        {byType('airline_miles').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </optgroup>
                    )}
                    {byType('hotel_points').length > 0 && (
                      <optgroup label="Hotel points">
                        {byType('hotel_points').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <input
                    type="text"
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                    placeholder="50000"
                    className="pm-input font-mono"
                  />
                  <button
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    className="pm-button-secondary px-3 py-2 text-xs disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={submitSearch}
              disabled={loading || !isSearchReady}
              className="pm-button w-full"
            >
              {loading ? 'Searching award space…' : 'Search awards'}
            </button>

            {error && (
              <div className="text-sm text-pm-danger bg-pm-danger-soft rounded-xl px-4 py-3 border border-pm-danger-border">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={submitSearch}
                  className="mt-2 text-sm underline underline-offset-4 text-pm-danger"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          <div className="pm-card p-6 space-y-4 lg:sticky lg:top-[calc(var(--navbar-height)+1.5rem)] lg:self-start">
            {!result ? (
              <>
                <p className="pm-section-title mb-1">Results</p>
                <h2 className="pm-heading text-lg">Live market view</h2>
                <p className="pm-subtle text-sm">
                  Run a search to see reachable programs, transfer paths, and booking links ranked for this route.
                </p>
                <div className="rounded-[22px] bg-pm-surface-soft p-4">
                  <p className="text-sm font-semibold text-pm-ink-900">What appears here</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-6 text-pm-ink-700">
                    <li>• Reachable programs first</li>
                    <li>• Points needed from your wallet</li>
                    <li>• Transfer path and live/estimated status</li>
                  </ul>
                </div>
                <Link
                  href={`/${region}/calculator`}
                  className="inline-flex text-sm font-medium text-pm-accent hover:underline underline-offset-4"
                >
                  Open full Planner
                </Link>
              </>
            ) : (
              <>
                <div>
                  <p className="pm-section-title mb-1">Results</p>
                  <h2 className="pm-heading text-lg">Ranked award options</h2>
                  <p className="text-xs text-pm-ink-500 mt-1">
                    {result.params.origin} → {result.params.destination} · {CABIN_LABELS[result.params.cabin]} · {result.params.passengers} pax
                  </p>
                </div>

                {narrativeLoading && (
                  <div className="rounded-xl p-4 space-y-2 border border-pm-border bg-pm-surface-soft animate-pulse">
                    <div className="h-3 w-24 rounded bg-pm-border" />
                    <div className="h-5 w-2/3 rounded bg-pm-border" />
                    <div className="h-3 w-full rounded bg-pm-surface-soft" />
                    <div className="h-3 w-5/6 rounded bg-pm-surface-soft" />
                  </div>
                )}

                {narrative && (
                  <div className="rounded-xl p-4 space-y-2 border border-pm-accent-border bg-pm-accent-soft">
                    <p className="pm-label text-pm-accent">AI analysis</p>
                    <p className="pm-heading text-base">{narrative.headline}</p>
                    <p className="text-sm text-pm-ink-700">{narrative.body}</p>
                  </div>
                )}

                {estimatesOnly && (
                  <div className="rounded-xl p-4 border border-pm-warning-border bg-pm-warning-soft">
                    <p className="text-sm text-pm-warning">
                      {result.message ?? 'Showing chart estimates · Live seat availability requires API configuration.'}
                    </p>
                  </div>
                )}

                {searchWarnings.length > 0 && (
                  <div className="space-y-2">
                    {searchWarnings.map((warning) => (
                      <div key={warning} className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                        <p className="text-sm text-sky-900">{warning}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl p-4 border border-pm-border bg-pm-surface">
                  <p className="pm-label mb-1">Deal watch</p>
                  {user ? (
                    <>
                      <p className="text-xs text-pm-ink-500">
                        Save this search as a watch to trigger email alerts when live award space appears.
                      </p>
                      <button
                        onClick={saveWatch}
                        disabled={watchSaving || result.results.length === 0}
                        className="pm-button-secondary mt-3 text-xs px-3 py-1.5 disabled:opacity-60"
                      >
                        {watchSaving ? 'Saving watch…' : 'Save as watch'}
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-pm-ink-500">Sign in to save deal watches and receive alerts.</p>
                  )}
                  {watchStatus && (
                    <p className="text-xs text-pm-accent-strong mt-2">{watchStatus}</p>
                  )}
                </div>

                <div className="rounded-xl p-4 border border-pm-border bg-pm-surface">
                  <p className="pm-label mb-1">Booking guide</p>
                  <p className="text-xs text-pm-ink-500">
                    Start a guided booking session from any reachable result. The guide now uses this route, transfer path, and your wallet balances.
                  </p>
                  {!user && (
                    <p className="text-xs text-pm-ink-500 mt-2">Sign in to start and save a booking guide session.</p>
                  )}
                  {bookingGuideStatus && (
                    <p className="text-xs text-pm-accent-strong mt-2">{bookingGuideStatus}</p>
                  )}
                </div>

                {reachable.length > 0 && (
                  <div className="space-y-3">
                    <p className="pm-label text-pm-success">Reachable with your wallet</p>
                    {reachable.map((r, index) => (
                      <motion.div
                        key={r.program_slug}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={reduceMotion ? undefined : { duration: 0.2, delay: index * 0.05 }}
                      >
                        <AwardResultCard
                          result={r}
                          topSlug={topSlug}
                          region={region}
                          canStartGuide={Boolean(user)}
                          isStartingGuide={bookingGuideStartingSlug === r.program_slug}
                          onStartGuide={startBookingGuide}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}

                {unreachable.length > 0 && (
                  <div className="space-y-3">
                    <p className="pm-label">Need more points</p>
                    {unreachable.map((r, index) => (
                      <motion.div
                        key={r.program_slug}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={reduceMotion ? undefined : { duration: 0.2, delay: index * 0.05 }}
                      >
                        <AwardResultCard
                          result={r}
                          topSlug={topSlug}
                          region={region}
                          canStartGuide={false}
                          isStartingGuide={false}
                          onStartGuide={startBookingGuide}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}

                {reachable.length === 0 && unreachable.length === 0 && (
                  <div className="rounded-xl border border-pm-border bg-pm-surface-soft p-4">
                    <p className="text-sm text-pm-ink-700 font-medium">
                      No award availability found for this route yet.
                    </p>
                    <p className="text-xs text-pm-ink-500 mt-1">
                      Try flexible dates, nearby airports, or a different cabin to expand options.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
