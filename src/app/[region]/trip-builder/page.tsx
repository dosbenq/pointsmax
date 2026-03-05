'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { format, parseISO, isBefore, startOfToday } from 'date-fns'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
import type { Program, TripBuilderResponse } from '@/types/database'
import { REGIONS, type Region } from '@/lib/regions'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type UIState = 'form' | 'loading' | 'results'
type DateMode = 'exact' | 'flexible_month'
type TripType = 'round_trip' | 'one_way'

type BalanceRow = { id: string; program_id: string; amount: string }

type ProgramOption = Pick<Program, 'id' | 'name' | 'short_name' | 'type' | 'color_hex'>

const LOADING_MESSAGES = [
  'Searching award space…',
  'Finding transfer paths…',
  'Building hotel plan…',
  'Writing your booking guide…',
]

const CABIN_OPTIONS = [
  { value: 'economy',         label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business',        label: 'Business Class' },
  { value: 'first',           label: 'First Class' },
]

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

function parsePointsAmount(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '')
  if (!digitsOnly) return NaN
  return Number.parseInt(digitsOnly, 10)
}

function getTripDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const startMs = Date.parse(`${startDate}T00:00:00Z`)
  const endMs = Date.parse(`${endDate}T00:00:00Z`)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0
  return Math.max(0, Math.round((endMs - startMs) / 86400000))
}

function getMonthRange(month: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const [yearStr, monthStr] = month.split('-')
  const year = Number.parseInt(yearStr, 10)
  const monthIndex = Number.parseInt(monthStr, 10) - 1
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null
  }
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const last = new Date(Date.UTC(year, monthIndex + 1, 0))
  const toIsoDate = (d: Date) => d.toISOString().slice(0, 10)
  return { start: toIsoDate(first), end: toIsoDate(last) }
}

function getDefaultFlexMonth(offsetMonths = 2): string {
  const today = new Date()
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  d.setUTCMonth(d.getUTCMonth() + offsetMonths)
  const year = d.getUTCFullYear()
  const month = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  return `${year}-${month}`
}

function formatMonthYear(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month
  const [year, monthStr] = month.split('-')
  const monthIdx = Number.parseInt(monthStr, 10) - 1
  const monthLabel = MONTH_LABELS[monthIdx] ?? monthStr
  return `${monthLabel} ${year}`
}

function getGoogleFlightsUrl(origin: string, destination: string): string {
  const query = encodeURIComponent(`flights from ${origin} to ${destination}`)
  return `https://www.google.com/travel/flights?q=${query}`
}

export default function TripBuilderPage() {
  const params = useParams()
  const region = (params.region as Region) || 'us'
  const config = REGIONS[region] ?? REGIONS.us
  const { user } = useAuth()
  const [uiState, setUiState] = useState<UIState>('form')
  const [result, setResult] = useState<TripBuilderResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [destination, setDestination] = useState('')
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [tripType, setTripType] = useState<TripType>('round_trip')
  const [dateMode, setDateMode] = useState<DateMode>('exact')
  const [flexMonth, setFlexMonth] = useState(getDefaultFlexMonth(2))
  const [departDate, setDepartDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [travelers, setTravelers] = useState(1)
  const [cabin, setCabin] = useState('business')
  const [hotelNights, setHotelNights] = useState(3)
  const [hotelNightsManuallySet, setHotelNightsManuallySet] = useState(false)
  const [rows, setRows] = useState<BalanceRow[]>([
    { id: '1', program_id: '', amount: '' },
  ])
  const [programs, setPrograms] = useState<ProgramOption[]>([])

  // Loading animation
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0])
  const msgTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clear balances when region changes
  useEffect(() => {
    setRows([{ id: '1', program_id: '', amount: '' }])
    setResult(null)
  }, [region])

  useEffect(() => {
    fetch(`/api/programs?region=${encodeURIComponent(region.toUpperCase())}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(r => {
        if (!r.ok) {
          console.error('Failed to load programs:', r.statusText)
          throw new Error('Failed to load programs')
        }
        return r.json()
      })
      .then(setPrograms)
      .catch(err => {
        console.error('Error fetching programs:', err)
        setPrograms([]) // Ensure programs is an empty array on error
        setError('Failed to load program data. Please refresh the page.')
      })
  }, [region])

  // Auto-load balances if logged in (region-specific)
  useEffect(() => {
    if (!user) return
    fetch(`/api/user/balances?region=${encodeURIComponent(region.toUpperCase())}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(r => {
        if (!r.ok) {
          console.error('Failed to load user balances:', r.statusText)
          throw new Error('Failed to load user balances')
        }
        return r.json()
      })
      .then(({ balances }) => {
        if (balances?.length) {
          setRows(balances.map((b: { program_id: string; balance: number }, i: number) => ({
            id: String(i + 1),
            program_id: b.program_id,
            amount: String(Math.max(0, Math.round(b.balance))),
          })))
        }
      })
      .catch(err => {
        console.error('Error fetching user balances:', err)
        setError('Failed to load your balances. Please try again.')
      })
  }, [user, region])

  useEffect(() => {
    if (hotelNightsManuallySet) return
    if (tripType === 'one_way') return
    if (dateMode === 'exact') {
      const tripDays = getTripDays(departDate, returnDate)
      if (tripDays > 0) setHotelNights(Math.min(tripDays, 14))
      return
    }
    const range = getMonthRange(flexMonth)
    if (!range) return
    const tripDays = getTripDays(range.start, range.end)
    if (tripDays > 0) setHotelNights(Math.min(tripDays, 14))
  }, [tripType, dateMode, departDate, returnDate, flexMonth, hotelNightsManuallySet])

  const addRow = () => setRows(p => [...p, { id: Date.now().toString(), program_id: '', amount: '' }])
  const removeRow = (id: string) => setRows(p => p.filter(r => r.id !== id))
  const updateRow = (id: string, field: 'program_id' | 'amount', value: string) =>
    setRows(p => p.map(r => r.id === id ? { ...r, [field]: value } : r))

  const buildPlan = async () => {
    setError(null)

    const balances = rows
      .filter(r => r.program_id && r.amount)
      .map(r => ({ program_id: r.program_id, amount: parsePointsAmount(r.amount) }))
      .filter(b => b.amount > 0)

    const monthRange = getMonthRange(flexMonth)
    const startDate = dateMode === 'exact' ? departDate : (monthRange?.start ?? '')
    const endDate = dateMode === 'exact'
      ? (tripType === 'one_way' ? departDate : returnDate)
      : (monthRange?.end ?? '')

    if (!origin || !dest || !startDate || !endDate || balances.length === 0) {
      setError('Please fill in origin, destination, travel window, and at least one balance.')
      return
    }
    if (tripType === 'round_trip' && endDate <= startDate) {
      setError('Return/end date must be after departure/start date.')
      return
    }

    setUiState('loading')
    let msgIdx = 0
    setLoadingMsg(LOADING_MESSAGES[0])
    msgTimer.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length
      setLoadingMsg(LOADING_MESSAGES[msgIdx])
    }, 2500)

    try {
      const res = await fetch('/api/trip-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_name: destination || dest,
          origin: origin.toUpperCase(),
          destination: dest.toUpperCase(),
          start_date: startDate,
          return_date: endDate,
          trip_type: tripType,
          passengers: travelers,
          cabin,
          hotel_nights: hotelNights,
          balances,
          region,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text)
      }

      const data: TripBuilderResponse = await res.json()
      setResult(data)
      setUiState('results')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trip planning failed. Please try again.')
      setUiState('form')
    } finally {
      if (msgTimer.current) clearInterval(msgTimer.current)
    }
  }

  const reset = () => {
    setUiState('form')
    setResult(null)
    setError(null)
  }

  const byType = (type: string) => programs.filter(p => p.type === type)
  const selectedMonthRange = getMonthRange(flexMonth)
  const [selectedFlexYear, selectedFlexMonth] = /^\d{4}-\d{2}$/.test(flexMonth)
    ? flexMonth.split('-')
    : getDefaultFlexMonth(2).split('-')
  const currentYear = new Date().getUTCFullYear()
  const flexYearOptions = [currentYear, currentYear + 1, currentYear + 2]
  const googleFlightsUrl = origin && dest
    ? getGoogleFlightsUrl(origin.toUpperCase(), dest.toUpperCase())
    : null

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <span className="pm-pill mb-4 inline-block">Trip planning {config.flag}</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-3">Build your trip plan</h1>
          <p className="pm-subtle max-w-xl text-base">Get a full AI-powered redemption plan — flights, hotel, and step-by-step booking guide.</p>
        </div>
      </section>

      <main className="pm-shell py-8 w-full flex-1">

        {/* ── FORM STATE ─────────────────────────────────────── */}
        {uiState === 'form' && (
          <div className="space-y-6">

            {/* Destination & IATA */}
            <div className="pm-card-soft p-6 space-y-4">
              <h2 className="pm-heading">Trip Details</h2>

              <div>
                <label className="pm-label block mb-1.5">
                  Destination (optional name)
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="e.g. Tokyo, Paris, Maldives"
                  className="pm-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="pm-label block mb-1.5">
                    Origin Airport *
                  </label>
                  <input
                    type="text"
                    value={origin}
                    onChange={e => setOrigin(e.target.value.toUpperCase().slice(0, 3))}
                    placeholder="e.g. JFK"
                    maxLength={3}
                    className="pm-input font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="pm-label block mb-1.5">
                    Destination Airport *
                  </label>
                  <input
                    type="text"
                    value={dest}
                    onChange={e => setDest(e.target.value.toUpperCase().slice(0, 3))}
                    placeholder="e.g. NRT"
                    maxLength={3}
                    className="pm-input font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="pm-label block mb-1.5">Trip Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTripType('round_trip')}
                    className={`pm-button-secondary px-3 py-1.5 text-xs ${tripType === 'round_trip' ? 'bg-pm-accent-soft border-pm-accent-border text-pm-accent-strong' : ''}`}
                  >
                    Round Trip
                  </button>
                  <button
                    onClick={() => {
                      setTripType('one_way')
                      setReturnDate('')
                    }}
                    className={`pm-button-secondary px-3 py-1.5 text-xs ${tripType === 'one_way' ? 'bg-pm-accent-soft border-pm-accent-border text-pm-accent-strong' : ''}`}
                  >
                    One Way
                  </button>
                </div>
              </div>

              <div>
                <label className="pm-label block mb-1.5">Date Search Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setDateMode('exact')
                      setHotelNightsManuallySet(false)
                    }}
                    className={`pm-button-secondary px-3 py-1.5 text-xs ${dateMode === 'exact' ? 'bg-pm-accent-soft border-pm-accent-border text-pm-accent-strong' : ''}`}
                  >
                    Exact dates
                  </button>
                  <button
                    onClick={() => {
                      setDateMode('flexible_month')
                      setHotelNightsManuallySet(false)
                    }}
                    className={`pm-button-secondary px-3 py-1.5 text-xs ${dateMode === 'flexible_month' ? 'bg-pm-accent-soft border-pm-accent-border text-pm-accent-strong' : ''}`}
                  >
                    I&apos;m flexible (full month)
                  </button>
                </div>
              </div>

              {dateMode === 'exact' ? (
                <div className={`grid gap-4 ${tripType === 'one_way' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {/* K12: Departure Date Picker */}
                  <div>
                    <label className="pm-label block mb-1.5">Departure Date *</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal pm-input bg-pm-surface hover:bg-pm-surface-soft',
                            !departDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-pm-ink-500" />
                          {departDate ? (
                            format(parseISO(departDate), 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-pm-surface" align="start">
                        <Calendar
                          mode="single"
                          selected={departDate ? parseISO(departDate) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const isoDate = format(date, 'yyyy-MM-dd')
                              setDepartDate(isoDate)
                              if (returnDate && returnDate <= isoDate) setReturnDate('')
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

                  {/* K12: Return Date Picker (round trip only) */}
                  {tripType === 'round_trip' && (
                    <div>
                      <label className="pm-label block mb-1.5">Return Date *</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal pm-input bg-pm-surface hover:bg-pm-surface-soft',
                              !returnDate && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-pm-ink-500" />
                            {returnDate ? (
                              format(parseISO(returnDate), 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-pm-surface" align="start">
                          <Calendar
                            mode="single"
                            selected={returnDate ? parseISO(returnDate) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                setReturnDate(format(date, 'yyyy-MM-dd'))
                              }
                            }}
                            disabled={(date) => {
                              const minDate = departDate ? parseISO(departDate) : startOfToday()
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
                  )}
                </div>
              ) : (
                <div>
                  <label className="pm-label block mb-1.5">Flexible Month *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={selectedFlexMonth}
                      onChange={(e) => setFlexMonth(`${selectedFlexYear}-${e.target.value}`)}
                      className="pm-input"
                    >
                      {MONTH_LABELS.map((label, idx) => {
                        const monthValue = `${idx + 1}`.padStart(2, '0')
                        return <option key={monthValue} value={monthValue}>{label}</option>
                      })}
                    </select>
                    <select
                      value={selectedFlexYear}
                      onChange={(e) => setFlexMonth(`${e.target.value}-${selectedFlexMonth}`)}
                      className="pm-input"
                    >
                      {flexYearOptions.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  {selectedMonthRange && (
                    <p className="text-xs text-pm-ink-500 mt-1">
                      Searching {formatMonthYear(flexMonth)} ({selectedMonthRange.start} through {selectedMonthRange.end}).
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="pm-label block mb-1.5">
                    Travelers
                  </label>
                  <select
                    value={travelers}
                    onChange={e => setTravelers(parseInt(e.target.value, 10))}
                    className="pm-input"
                  >
                    {[1,2,3,4,5,6,7,8,9].map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'traveler' : 'travelers'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="pm-label block mb-1.5">
                    Cabin
                  </label>
                  <select
                    value={cabin}
                    onChange={e => setCabin(e.target.value)}
                    className="pm-input"
                  >
                    {CABIN_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="pm-label block mb-1.5">
                    Hotel Nights
                  </label>
                  <select
                    value={hotelNights}
                    onChange={e => {
                      setHotelNightsManuallySet(true)
                      setHotelNights(parseInt(e.target.value, 10))
                    }}
                    className="pm-input"
                  >
                    {Array.from({ length: 15 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? 'No hotel' : `${i} night${i !== 1 ? 's' : ''}`}</option>
                    ))}
                  </select>
                  {hotelNightsManuallySet && (
                    <button
                      onClick={() => setHotelNightsManuallySet(false)}
                      className="text-xs text-pm-accent hover:text-pm-accent-strong mt-1"
                    >
                      Reset to auto-calculate from dates
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Balance Rows */}
            <div className="pm-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="pm-heading">Your Points Balances</h2>
                  {!user && (
                    <p className="text-xs text-pm-ink-500 mt-0.5">Sign in to auto-load your saved balances</p>
                  )}
                </div>
                <button
                  onClick={addRow}
                  className="pm-button-secondary text-xs px-3 py-1.5"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-3">
                {rows.map(row => {
                  const sel = programs.find(p => p.id === row.program_id)
                  return (
                    <div key={row.id} className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1"
                        style={{ backgroundColor: sel?.color_hex ?? 'var(--pm-surface-soft)' }}
                      />
                      <select
                        value={row.program_id}
                        onChange={e => updateRow(row.id, 'program_id', e.target.value)}
                        className="pm-input flex-1"
                      >
                        <option value="">Select program…</option>
                        {['transferable_points','airline_miles','hotel_points'].map(type => (
                          <optgroup key={type} label={type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}>
                            {byType(type).map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={row.amount}
                        onChange={e => updateRow(row.id, 'amount', e.target.value)}
                        placeholder="Balance"
                        className="pm-input w-32 text-right"
                      />
                      {rows.length > 1 && (
                        <button
                          onClick={() => removeRow(row.id)}
                          className="text-pm-ink-500 hover:text-pm-danger transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="bg-pm-danger-soft border border-pm-danger-border text-pm-danger text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              onClick={buildPlan}
              className="pm-button w-full py-4 rounded-2xl"
            >
              Build My Trip Plan ✈️
            </button>
          </div>
        )}

        {/* ── LOADING STATE ──────────────────────────────────── */}
        {uiState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6">
            <div className="w-12 h-12 rounded-full border-4 border-pm-accent border-t-transparent animate-spin" />
            <p className="text-pm-ink-500 text-sm font-medium animate-pulse">{loadingMsg}</p>
          </div>
        )}

        {/* ── RESULTS STATE ──────────────────────────────────── */}
        {uiState === 'results' && result && (
          <div className="space-y-5">

            {/* AI Summary */}
            {result.ai_summary && (
              <div className="rounded-2xl border border-pm-success-border bg-pm-success-soft p-6">
                <p className="text-xs font-semibold text-pm-success uppercase tracking-wider mb-2">✨ Trip Summary</p>
                <p className="text-xs text-pm-ink-700 font-semibold mb-2">
                  {tripType === 'one_way' ? 'One Way' : 'Round Trip'} · {origin.toUpperCase()} → {dest.toUpperCase()}
                </p>
                <p className="text-pm-ink-700 text-sm leading-relaxed mb-2">{result.ai_summary}</p>
                {result.points_summary && (
                  <p className="text-pm-success text-sm font-medium">{result.points_summary}</p>
                )}
              </div>
            )}

            {/* Flight Options */}
            {result.top_flights.length > 0 && (
              <div className="pm-card-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-pm-border">
                  <h2 className="pm-heading">✈️ Flight Options</h2>
                  <p className="text-xs text-pm-ink-500 mt-0.5">Top award programs for your route</p>
                  {googleFlightsUrl && (
                    <a
                      href={googleFlightsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-pm-accent hover:text-pm-accent-strong mt-2 inline-flex"
                    >
                      Compare cash fares on Google Flights ↗
                    </a>
                  )}
                </div>
                <div className="divide-y divide-pm-surface-soft">
                  {result.top_flights.map((flight, i) => (
                    <div key={i} className="px-6 py-4 flex items-start gap-4">
                      <span className="text-sm font-bold text-pm-ink-500 w-5 flex-shrink-0 mt-0.5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-pm-ink-900 text-sm">{flight.program_name}</span>
                          {flight.is_reachable ? (
                            <span className="text-xs bg-pm-success-soft text-pm-success border border-pm-success-border px-2 py-0.5 rounded-full font-medium">Reachable</span>
                          ) : (
                            <span className="text-xs bg-pm-surface-soft text-pm-ink-500 border border-pm-border px-2 py-0.5 rounded-full">Need more points</span>
                          )}
                        </div>
                        <p className="text-xs text-pm-ink-500 mt-0.5">
                          ~{flight.estimated_miles.toLocaleString()} miles
                          {' · '}
                          ~{flight.points_needed_from_wallet.toLocaleString()} points from wallet
                          {flight.transfer_chain && ` · via ${flight.transfer_chain}`}
                        </p>
                      </div>
                      <a
                        href={flight.deep_link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-pm-accent hover:text-pm-accent-strong font-medium whitespace-nowrap flex-shrink-0 border border-pm-accent-border hover:border-pm-accent-border px-3 py-1.5 rounded-full transition-colors bg-pm-accent-soft"
                      >
                        {flight.deep_link_label} ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hotel Plan */}
            {result.hotel && (
              <div className="pm-card-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-pm-border">
                  <h2 className="pm-heading">🏨 Hotel Plan</h2>
                </div>
                <div className="px-6 py-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="pm-heading">{result.hotel.property_name}</p>
                      <p className="text-xs text-pm-ink-500">{result.hotel.chain} · {result.hotel.loyalty_program}</p>
                    </div>
                    {safeUrl(result.hotel.booking_url) && (
                      <a
                        href={safeUrl(result.hotel.booking_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-pm-accent hover:text-pm-accent-strong font-medium border border-pm-accent-border hover:border-pm-accent-border px-3 py-1.5 rounded-full transition-colors flex-shrink-0 bg-pm-accent-soft"
                      >
                        Book ↗
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-pm-surface-soft rounded-xl p-3">
                      <p className="text-pm-ink-500 font-medium mb-0.5">Per night</p>
                      <p className="font-bold text-pm-ink-900">{result.hotel.approx_points_per_night.toLocaleString()} pts</p>
                    </div>
                    {hotelNights > 0 && (
                      <div className="bg-pm-surface-soft rounded-xl p-3">
                        <p className="text-pm-ink-500 font-medium mb-0.5">Total ({hotelNights} nights)</p>
                        <p className="font-bold text-pm-ink-900">{(result.hotel.approx_points_per_night * hotelNights).toLocaleString()} pts</p>
                      </div>
                    )}
                  </div>
                  {result.hotel.transfer_suggestion && (
                    <p className="text-xs text-pm-accent-strong bg-pm-accent-soft border border-pm-accent-border rounded-xl px-3 py-2">
                      💡 {result.hotel.transfer_suggestion}
                    </p>
                  )}
                  {result.hotel.notes && (
                    <p className="text-xs text-pm-ink-500">{result.hotel.notes}</p>
                  )}
                </div>
              </div>
            )}

            {/* Booking Steps */}
            {result.booking_steps.length > 0 && (
              <div className="pm-card-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-pm-border">
                  <h2 className="pm-heading">📋 How to Book</h2>
                  <p className="text-xs text-pm-ink-500 mt-0.5">Step-by-step guide</p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {result.booking_steps.map((step, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-pm-accent text-pm-bg text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                        {step.step ?? i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-pm-ink-900">{step.action}</p>
                        <p className="text-xs text-pm-ink-500 mt-0.5 leading-relaxed">{step.detail}</p>
                        {safeUrl(step.url) && (
                          <a
                            href={safeUrl(step.url)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-pm-accent hover:text-pm-accent-strong mt-1 inline-flex items-center gap-1"
                          >
                            Go to site ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={reset}
              className="w-full text-sm text-pm-ink-500 hover:text-pm-ink-900 border border-pm-border hover:border-pm-accent-border py-3 rounded-2xl transition-colors bg-pm-surface"
            >
              ← Build a new trip
            </button>
          </div>
        )}

      </main>

      <Footer />
    </div>
  )
}
