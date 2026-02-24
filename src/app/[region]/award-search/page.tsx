'use client'

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

type ProgramOption = Pick<Program, 'id' | 'name' | 'short_name' | 'type' | 'color_hex'>
type BalanceRow = { id: string; program_id: string; amount: string }

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

function AwardResultCard({ result, topSlug, region }: { result: AwardSearchResult; topSlug?: string; region: Region }) {
  const isTopPick = result.program_slug === topSlug
  const resultClass = isTopPick
    ? 'bg-[#e9f8f3] border-[#9ad6c9]'
    : result.is_reachable
      ? 'bg-white border-[#d5e5d9]'
      : 'bg-[#f2f7f3] border-[#dce9e1] opacity-80'

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${resultClass}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: result.program_color }} />
        <span className="text-[#173f34] font-semibold text-sm">{result.program_name}</span>
        {isTopPick && (
          <span className="text-xs bg-[#0f766e] text-white px-2 py-0.5 rounded-full font-semibold">Top pick</span>
        )}
        {result.has_real_availability && (
          <span className="text-xs bg-[#ecf9f1] text-[#157347] border border-[#c7e7d4] px-2 py-0.5 rounded-full">Live</span>
        )}
        {!result.has_real_availability && (
          <span className="text-xs bg-[#f2f7f3] text-[#607d71] border border-[#d6e5dc] px-2 py-0.5 rounded-full">Estimate</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Miles needed</p>
          <p className="text-[#157347] font-bold mt-0.5">{result.estimated_miles.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Wallet points</p>
          <p className="text-[#244437] font-semibold mt-0.5">{result.points_needed_from_wallet.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Rate</p>
          <p className="text-[#244437] mt-0.5">{formatCpp(result.cpp_cents, region)}</p>
        </div>
      </div>

      {result.transfer_chain && (
        <p className="text-xs text-[#0f766e]">{result.transfer_chain}</p>
      )}

      <a
        href={result.deep_link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs bg-[#edf6f0] hover:bg-[#e2f2ea] text-[#1f4a3d] border border-[#cfe2d5] px-3 py-1.5 rounded-full transition-colors"
      >
        {result.deep_link.label}
        <span className="text-[#5f7c70]">↗</span>
      </a>
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

  useEffect(() => {
    fetch(`/api/programs?region=${region.toUpperCase()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load programs (${res.status})`)
        return res.json() as Promise<ProgramOption[]>
      })
      .then((data) => setPrograms(data ?? []))
      .catch(() => setError('Failed to load program data. Please refresh and try again.'))
  }, [region])

  useEffect(() => {
    if (!user) return
    fetch('/api/user/balances')
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
  }, [user])

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

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="border-b border-[#d7e8dd] bg-[rgba(236,246,240,0.52)]">
        <div className="pm-shell py-10">
          <span className="pm-pill mb-3">Fast flight search</span>
          <h1 className="pm-heading text-3xl mb-2">Standalone Award Search</h1>
          <p className="pm-subtle">
            Quick check mode for power users. Search availability and transfer paths without running the full calculator.
          </p>
        </div>
      </section>

      <main className="pm-shell py-8 w-full flex-1 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="pm-card-soft p-6 space-y-5">
            <h2 className="pm-heading text-lg">Search inputs</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="pm-label block mb-1.5">From</label>
                <input
                  type="text"
                  maxLength={3}
                  value={params.origin}
                  onChange={(e) => setParams((p) => ({ ...p, origin: e.target.value.toUpperCase() }))}
                  placeholder={defaultOrigin}
                  className="pm-input font-mono uppercase"
                />
              </div>
              <div>
                <label className="pm-label block mb-1.5">To</label>
                <input
                  type="text"
                  maxLength={3}
                  value={params.destination}
                  onChange={(e) => setParams((p) => ({ ...p, destination: e.target.value.toUpperCase() }))}
                  placeholder={defaultDestination}
                  className="pm-input font-mono uppercase"
                />
              </div>
            </div>

            {/* K12: Date Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="pm-label block mb-1.5">Earliest date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal pm-input bg-white hover:bg-[#f8faf9]',
                        !params.start_date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-[#7f978c]" />
                      {params.start_date ? (
                        format(parseISO(params.start_date), 'PP')
                      ) : (
                        <span>Pick date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white" align="start">
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
                        }
                      }}
                      disabled={(date) => isBefore(date, startOfToday())}
                      initialFocus
                      classNames={{
                        day_selected: 'bg-[#0f766e] text-white hover:bg-[#0d5f58]',
                        day_today: 'bg-[#ecf9f7] text-[#0f766e]',
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="pm-label block mb-1.5">Latest date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal pm-input bg-white hover:bg-[#f8faf9]',
                        !params.end_date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-[#7f978c]" />
                      {params.end_date ? (
                        format(parseISO(params.end_date), 'PP')
                      ) : (
                        <span>Pick date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white" align="start">
                    <Calendar
                      mode="single"
                      selected={params.end_date ? parseISO(params.end_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setParams((p) => ({ ...p, end_date: format(date, 'yyyy-MM-dd') }))
                        }
                      }}
                      disabled={(date) => {
                        const minDate = params.start_date ? parseISO(params.start_date) : startOfToday()
                        return isBefore(date, minDate)
                      }}
                      initialFocus
                      classNames={{
                        day_selected: 'bg-[#0f766e] text-white hover:bg-[#0d5f58]',
                        day_today: 'bg-[#ecf9f7] text-[#0f766e]',
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
              <div className="text-sm text-[#b42318] bg-[#fff2f2] rounded-xl px-4 py-3 border border-[#f9d4d4]">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={submitSearch}
                  className="mt-2 text-sm underline underline-offset-4 text-[#8a1c16]"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          <div className="pm-card p-6 space-y-4">
            {!result ? (
              <>
                <h2 className="pm-heading text-lg">Results</h2>
                <p className="pm-subtle text-sm">
                  Run a search to see reachable programs, transfer paths, and booking links.
                </p>
              </>
            ) : (
              <>
                <div>
                  <h2 className="pm-heading text-lg">Results</h2>
                  <p className="text-xs text-[#5f7c70] mt-1">
                    {result.params.origin} → {result.params.destination} · {CABIN_LABELS[result.params.cabin]} · {result.params.passengers} pax
                  </p>
                </div>

                {narrativeLoading && (
                  <div className="rounded-xl p-4 space-y-2 border border-[#d7e8dd] bg-[#f7fbf8] animate-pulse">
                    <div className="h-3 w-24 rounded bg-[#dce9e2]" />
                    <div className="h-5 w-2/3 rounded bg-[#dce9e2]" />
                    <div className="h-3 w-full rounded bg-[#e3eee8]" />
                    <div className="h-3 w-5/6 rounded bg-[#e3eee8]" />
                  </div>
                )}

                {narrative && (
                  <div className="rounded-xl p-4 space-y-2 border border-[#bfe4dc] bg-[#ecfaf7]">
                    <p className="pm-label text-[#0f766e]">AI analysis</p>
                    <p className="pm-heading text-base">{narrative.headline}</p>
                    <p className="text-sm text-[#2c4d41]">{narrative.body}</p>
                  </div>
                )}

                {estimatesOnly && (
                  <div className="rounded-xl p-4 border border-[#f2d8ad] bg-[#fff8eb]">
                    <p className="text-sm text-[#8a5b12]">
                      {result.message ?? 'Showing chart estimates · Live seat availability requires API configuration.'}
                    </p>
                  </div>
                )}

                <div className="rounded-xl p-4 border border-[#dbe9e2] bg-white">
                  <p className="pm-label mb-1">Deal watch</p>
                  {user ? (
                    <>
                      <p className="text-xs text-[#5f7c70]">
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
                    <p className="text-xs text-[#5f7c70]">Sign in to save deal watches and receive alerts.</p>
                  )}
                  {watchStatus && (
                    <p className="text-xs text-[#0f5f57] mt-2">{watchStatus}</p>
                  )}
                </div>

                {reachable.length > 0 && (
                  <div className="space-y-3">
                    <p className="pm-label text-[#157347]">Reachable with your wallet</p>
                    {reachable.map((r, index) => (
                      <motion.div
                        key={r.program_slug}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={reduceMotion ? undefined : { duration: 0.2, delay: index * 0.05 }}
                      >
                        <AwardResultCard result={r} topSlug={topSlug} region={region} />
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
                        <AwardResultCard result={r} topSlug={topSlug} region={region} />
                      </motion.div>
                    ))}
                  </div>
                )}

                {reachable.length === 0 && unreachable.length === 0 && (
                  <div className="rounded-xl border border-[#dbe9e2] bg-[#f8fcf9] p-4">
                    <p className="text-sm text-[#365649] font-medium">
                      No award availability found for this route yet.
                    </p>
                    <p className="text-xs text-[#5f7c70] mt-1">
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
