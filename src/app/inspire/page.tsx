'use client'

import { useEffect, useMemo, useState } from 'react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
import type { Program } from '@/types/database'
import type { AwardSearchResponse, AwardSearchResult, CabinClass } from '@/lib/award-search/types'

type ProgramOption = Pick<Program, 'id' | 'name' | 'short_name' | 'type' | 'color_hex'>
type BalanceRow = { id: string; program_id: string; amount: string }

type RegionKey = 'all' | 'europe' | 'caribbean' | 'asia' | 'oceania' | 'americas'

type DestinationOption = {
  code: string
  city: string
  region: Exclude<RegionKey, 'all'>
}

type InspirePick = {
  destination: DestinationOption
  search: AwardSearchResponse
  best: AwardSearchResult | null
}

const DESTINATIONS: DestinationOption[] = [
  { code: 'LHR', city: 'London', region: 'europe' },
  { code: 'CDG', city: 'Paris', region: 'europe' },
  { code: 'FCO', city: 'Rome', region: 'europe' },
  { code: 'MAD', city: 'Madrid', region: 'europe' },
  { code: 'CUN', city: 'Cancun', region: 'caribbean' },
  { code: 'PUJ', city: 'Punta Cana', region: 'caribbean' },
  { code: 'SJU', city: 'San Juan', region: 'caribbean' },
  { code: 'NRT', city: 'Tokyo', region: 'asia' },
  { code: 'ICN', city: 'Seoul', region: 'asia' },
  { code: 'SIN', city: 'Singapore', region: 'asia' },
  { code: 'SYD', city: 'Sydney', region: 'oceania' },
  { code: 'AKL', city: 'Auckland', region: 'oceania' },
  { code: 'MEX', city: 'Mexico City', region: 'americas' },
  { code: 'LIM', city: 'Lima', region: 'americas' },
  { code: 'BOG', city: 'Bogota', region: 'americas' },
]

const REGION_OPTIONS: Array<{ value: RegionKey; label: string }> = [
  { value: 'all', label: 'Anywhere' },
  { value: 'europe', label: 'Europe' },
  { value: 'caribbean', label: 'Caribbean' },
  { value: 'asia', label: 'Asia' },
  { value: 'oceania', label: 'Oceania' },
  { value: 'americas', label: 'Americas' },
]

const CABIN_OPTIONS: Array<{ value: CabinClass; label: string }> = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
]

function parsePointsAmount(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '')
  if (!digitsOnly) return NaN
  return Number.parseInt(digitsOnly, 10)
}

function getDefaultMonth(): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 7)
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

function pickBestResult(results: AwardSearchResult[]): AwardSearchResult | null {
  if (!results.length) return null
  const sorted = [...results].sort((a, b) => {
    if (a.is_reachable !== b.is_reachable) return a.is_reachable ? -1 : 1
    if (a.cpp_cents !== b.cpp_cents) return b.cpp_cents - a.cpp_cents
    return a.points_needed_from_wallet - b.points_needed_from_wallet
  })
  return sorted[0] ?? null
}

export default function InspirePage() {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [rows, setRows] = useState<BalanceRow[]>([{ id: '1', program_id: '', amount: '' }])
  const [origin, setOrigin] = useState('')
  const [month, setMonth] = useState(getDefaultMonth())
  const [region, setRegion] = useState<RegionKey>('all')
  const [cabin, setCabin] = useState<CabinClass>('business')
  const [passengers, setPassengers] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<InspirePick[]>([])
  const [failedDestinations, setFailedDestinations] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/programs')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load programs (${res.status})`)
        return res.json() as Promise<ProgramOption[]>
      })
      .then((data) => setPrograms(data ?? []))
      .catch(() => setError('Failed to load program data. Please refresh and try again.'))
  }, [])

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

  const addRow = () => setRows((prev) => [...prev, { id: Date.now().toString(), program_id: '', amount: '' }])
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))
  const updateRow = (id: string, field: 'program_id' | 'amount', value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const byType = (type: Program['type']) => programs.filter((p) => p.type === type)
  const monthRange = getMonthRange(month)

  const selectedDestinations = useMemo(() => {
    const filtered = DESTINATIONS.filter((d) => region === 'all' || d.region === region)
    return filtered.slice(0, 8)
  }, [region])

  const isReady = Boolean(
    origin &&
    monthRange &&
    rows.some((r) => r.program_id && parsePointsAmount(r.amount) > 0),
  )

  const runInspireSearch = async () => {
    setLoading(true)
    setError(null)
    setResults([])
    setFailedDestinations([])

    try {
      const balances = rows
        .filter((r) => r.program_id && r.amount)
        .map((r) => ({ program_id: r.program_id, amount: parsePointsAmount(r.amount) }))
        .filter((b) => Number.isFinite(b.amount) && b.amount > 0)

      if (balances.length === 0) {
        throw new Error('Add at least one valid point balance.')
      }
      if (!monthRange) {
        throw new Error('Select a valid month.')
      }

      const responses = await Promise.allSettled(
        selectedDestinations.map(async (destination) => {
          const res = await fetch('/api/award-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: origin.toUpperCase(),
              destination: destination.code,
              cabin,
              passengers,
              start_date: monthRange.start,
              end_date: monthRange.end,
              balances,
              include_narrative: false,
            }),
          })

          const payload = await res.json()
          if (!res.ok) {
            throw new Error(payload?.error || `Search failed for ${destination.code}`)
          }
          return { destination, payload: payload as AwardSearchResponse }
        }),
      )

      const picks: InspirePick[] = []
      const failed: string[] = []
      for (const item of responses) {
        if (item.status === 'rejected') {
          const match = /[A-Z]{3}/.exec(item.reason?.message ?? '')
          failed.push(match?.[0] ?? 'Unknown')
          continue
        }
        const best = pickBestResult(item.value.payload.results)
        picks.push({
          destination: item.value.destination,
          search: item.value.payload,
          best,
        })
      }

      picks.sort((a, b) => {
        const aBest = a.best
        const bBest = b.best
        if (!aBest && !bBest) return 0
        if (!aBest) return 1
        if (!bBest) return -1
        if (aBest.is_reachable !== bBest.is_reachable) return aBest.is_reachable ? -1 : 1
        return bBest.cpp_cents - aBest.cpp_cents
      })

      setResults(picks)
      setFailedDestinations(failed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inspire search failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="border-b border-[#d7e8dd] bg-[rgba(236,246,240,0.52)]">
        <div className="pm-shell py-10">
          <span className="pm-pill mb-3">Reverse search</span>
          <h1 className="pm-heading text-3xl mb-2">Inspire Me</h1>
          <p className="pm-subtle">
            Start with your wallet and travel window. We scan curated destinations and surface the best places your points can take you.
          </p>
        </div>
      </section>

      <main className="pm-shell py-8 w-full flex-1 space-y-6">
        <div className="pm-card-soft p-6 space-y-5">
          <h2 className="pm-heading text-lg">Where can I go with my points?</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="pm-label block mb-1.5">Origin</label>
              <input
                type="text"
                maxLength={3}
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                placeholder="JFK"
                className="pm-input font-mono uppercase"
              />
            </div>
            <div>
              <label className="pm-label block mb-1.5">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="pm-input"
              />
            </div>
            <div>
              <label className="pm-label block mb-1.5">Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as RegionKey)}
                className="pm-input"
              >
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="pm-label block mb-1.5">Cabin</label>
              <select
                value={cabin}
                onChange={(e) => setCabin(e.target.value as CabinClass)}
                className="pm-input"
              >
                {CABIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="pm-label block mb-1.5">Passengers</label>
              <select
                value={passengers}
                onChange={(e) => setPassengers(Number.parseInt(e.target.value, 10))}
                className="pm-input"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="pm-label">Wallet balances</h3>
              <button onClick={addRow} className="pm-button-secondary px-3 py-1.5 text-xs">+ Add balance</button>
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
            onClick={runInspireSearch}
            disabled={!isReady || loading}
            className="pm-button"
          >
            {loading ? 'Searching destinations…' : `Find best destinations (${selectedDestinations.length})`}
          </button>

          {monthRange && (
            <p className="text-xs text-[#5f7c70]">
              Searching full month window: {monthRange.start} to {monthRange.end}
            </p>
          )}
          {error && (
            <p className="text-sm text-[#b42318] bg-[#fff2f2] rounded-xl px-4 py-2 border border-[#f9d4d4]">{error}</p>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="pm-heading text-lg">Suggested destinations</h2>
          {results.length === 0 && !loading && (
            <div className="pm-card p-5">
              <p className="pm-subtle text-sm">
                No results yet. Set your wallet and month, then run Inspire Me to compare destinations side-by-side.
              </p>
            </div>
          )}

          {results.map((item) => (
            <div key={item.destination.code} className="pm-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="pm-heading text-base">{item.destination.city} ({item.destination.code})</p>
                  <p className="text-xs text-[#5f7c70]">{item.search.params.origin} → {item.search.params.destination}</p>
                </div>
                {item.best?.is_reachable ? (
                  <span className="text-xs bg-[#ecf9f1] text-[#157347] border border-[#c7e7d4] px-2 py-1 rounded-full">
                    Reachable now
                  </span>
                ) : (
                  <span className="text-xs bg-[#f2f7f3] text-[#607d71] border border-[#d6e5dc] px-2 py-1 rounded-full">
                    Stretch goal
                  </span>
                )}
              </div>

              {!item.best ? (
                <p className="text-sm text-[#5f7c70]">No award options were returned for this destination.</p>
              ) : (
                <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#173f34]">{item.best.program_name}</p>
                    <p className="text-xs text-[#5f7c70]">
                      {item.best.estimated_miles.toLocaleString()} miles • {item.best.points_needed_from_wallet.toLocaleString()} wallet points • {item.best.cpp_cents.toFixed(2)}¢/pt
                    </p>
                    {item.best.transfer_chain && (
                      <p className="text-xs text-[#0f766e]">{item.best.transfer_chain}</p>
                    )}
                  </div>
                  <a
                    href={item.best.deep_link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 text-xs bg-[#edf6f0] hover:bg-[#e2f2ea] text-[#1f4a3d] border border-[#cfe2d5] px-3 py-1.5 rounded-full transition-colors"
                  >
                    {item.best.deep_link.label}
                    <span className="text-[#5f7c70]">↗</span>
                  </a>
                </div>
              )}
            </div>
          ))}

          {failedDestinations.length > 0 && (
            <p className="text-xs text-[#a7631c]">
              Some destinations failed to load: {failedDestinations.join(', ')}.
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
