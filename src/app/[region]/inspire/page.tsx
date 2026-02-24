'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
import type { Program } from '@/types/database'
import type { AwardSearchResponse, AwardSearchResult, CabinClass } from '@/lib/award-search/types'
import { REGIONS, type Region } from '@/lib/regions'

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
  // Europe
  { code: 'LHR', city: 'London', region: 'europe' },
  { code: 'CDG', city: 'Paris', region: 'europe' },
  { code: 'FCO', city: 'Rome', region: 'europe' },
  { code: 'MAD', city: 'Madrid', region: 'europe' },
  { code: 'AMS', city: 'Amsterdam', region: 'europe' },
  { code: 'ZRH', city: 'Zurich', region: 'europe' },
  // Caribbean
  { code: 'CUN', city: 'Cancun', region: 'caribbean' },
  { code: 'PUJ', city: 'Punta Cana', region: 'caribbean' },
  { code: 'SJU', city: 'San Juan', region: 'caribbean' },
  { code: 'MBJ', city: 'Montego Bay', region: 'caribbean' },
  // Asia
  { code: 'NRT', city: 'Tokyo', region: 'asia' },
  { code: 'ICN', city: 'Seoul', region: 'asia' },
  { code: 'SIN', city: 'Singapore', region: 'asia' },
  { code: 'BKK', city: 'Bangkok', region: 'asia' },
  { code: 'HKG', city: 'Hong Kong', region: 'asia' },
  // Oceania
  { code: 'SYD', city: 'Sydney', region: 'oceania' },
  { code: 'AKL', city: 'Auckland', region: 'oceania' },
  { code: 'NAN', city: 'Nadi', region: 'oceania' },
  // Americas
  { code: 'MEX', city: 'Mexico City', region: 'americas' },
  { code: 'LIM', city: 'Lima', region: 'americas' },
  { code: 'BOG', city: 'Bogota', region: 'americas' },
  { code: 'SJO', city: 'San Jose', region: 'americas' },
  { code: 'GIG', city: 'Rio de Janeiro', region: 'americas' },
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
    // 1. Prioritize reachable
    if (a.is_reachable !== b.is_reachable) return a.is_reachable ? -1 : 1
    // 2. Prioritize value
    if (Math.abs(b.cpp_cents - a.cpp_cents) > 0.1) return b.cpp_cents - a.cpp_cents
    // 3. Prioritize lower points
    return a.points_needed_from_wallet - b.points_needed_from_wallet
  })
  return sorted[0] ?? null
}

export default function InspirePage() {
  const params = useParams()
  const regionCode = (params.region as Region) || 'us'
  const config = REGIONS[regionCode]
  const { user } = useAuth()
  
  // N1: Region-aware CPP formatting
  const cppLabel = regionCode === 'in' ? 'paise/pt' : '¢/pt'
  const formatCpp = (cppCents: number): string => {
    if (regionCode === 'in') {
      return `${Math.round(cppCents)} ${cppLabel}`
    }
    return `${cppCents.toFixed(2)}${cppLabel}`
  }
  
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [rows, setRows] = useState<BalanceRow[]>([{ id: '1', program_id: '', amount: '' }])
  const [origin, setOrigin] = useState('')
  const [month, setMonth] = useState(getDefaultMonth())
  const [region, setRegion] = useState<RegionKey>('all')
  const [cabin, setCabin] = useState<CabinClass>('business')
  const [passengers, setPassengers] = useState(1)
  
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<InspirePick[]>([])
  const [failedDestinations, setFailedDestinations] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/programs?region=${encodeURIComponent(regionCode.toUpperCase())}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load programs (${res.status})`)
        return res.json() as Promise<ProgramOption[]>
      })
      .then((data) => setPrograms(data ?? []))
      .catch(() => setError('Failed to load program data. Please refresh and try again.'))
  }, [regionCode])

  // Clear balances when region changes
  useEffect(() => {
    setRows([{ id: 'seed-1', program_id: '', amount: '' }])
  }, [regionCode])

  // Load balances (region-specific)
  useEffect(() => {
    if (!user) return
    fetch(`/api/user/balances?region=${encodeURIComponent(regionCode.toUpperCase())}`, {
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
      .catch((err) => console.warn('Failed to load user balances:', err))
  }, [user, regionCode])

  const addRow = () => setRows((prev) => [...prev, { id: Date.now().toString(), program_id: '', amount: '' }])
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))
  const updateRow = (id: string, field: 'program_id' | 'amount', value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const byType = (type: Program['type']) => programs.filter((p) => p.type === type)
  const monthRange = getMonthRange(month)

  const selectedDestinations = useMemo(() => {
    const filtered = DESTINATIONS.filter((d) => region === 'all' || d.region === region)
    // Limit parallel requests to avoid timeouts/rate limits
    return filtered.slice(0, 10)
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
    setProgress(0)

    try {
      const balances = rows
        .filter((r) => r.program_id && r.amount)
        .map((r) => ({ program_id: r.program_id, amount: parsePointsAmount(r.amount) }))
        .filter((b) => Number.isFinite(b.amount) && b.amount > 0)

      if (balances.length === 0) throw new Error('Add at least one valid point balance.')
      if (!monthRange) throw new Error('Select a valid month.')

      const total = selectedDestinations.length
      const picks: InspirePick[] = []
      const failed: string[] = []

      // Process in batches of 3 to show progress without overwhelming browser/API
      const batchSize = 3
      for (let i = 0; i < total; i += batchSize) {
        const batch = selectedDestinations.slice(i, i + batchSize)
        
        const responses = await Promise.allSettled(
          batch.map(async (destination) => {
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
                region: regionCode,
              }),
            })

            const payload = await res.json()
            if (!res.ok) throw new Error(payload?.error || `Search failed for ${destination.code}`)
            return { destination, payload: payload as AwardSearchResponse }
          })
        )

        for (const res of responses) {
          if (res.status === 'fulfilled') {
            const best = pickBestResult(res.value.payload.results)
            picks.push({
              destination: res.value.destination,
              search: res.value.payload,
              best,
            })
          } else {
            console.warn('Inspire search error:', res.reason)
            failed.push('Unknown')
          }
        }
        
        setProgress(Math.min((i + batchSize) / total, 1))
      }

      // Sort final results: Reachable first, then highest value
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
      setProgress(1)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="border-b border-[#d7e8dd] bg-[rgba(236,246,240,0.52)]">
        <div className="pm-shell py-10">
          <span className="pm-pill mb-3">Reverse search {config.flag}</span>
          <h1 className="pm-heading text-3xl mb-2">Inspire Me</h1>
          <p className="pm-subtle max-w-2xl">
            Start with your wallet and travel window. We scan {selectedDestinations.length} popular destinations 
            to find the best places your points can take you right now.
          </p>
        </div>
      </section>

      <main className="pm-shell py-8 w-full flex-1 space-y-8">
        {/* Search Form */}
        <div className="pm-card-soft p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="pm-heading text-lg">Where can I go?</h2>
            {loading && (
              <span className="text-xs font-semibold text-[#0f766e] bg-[#ecf9f7] px-2 py-1 rounded-full animate-pulse">
                Scanning {Math.round(progress * 100)}%
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label htmlFor="origin" className="pm-label block mb-1.5">Origin</label>
              <input
                id="origin"
                type="text"
                maxLength={3}
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                placeholder={regionCode === 'in' ? 'DEL' : 'JFK'}
                className="pm-input font-mono uppercase"
              />
            </div>
            {/* K12: Month/Year selects instead of native month input */}
            <div>
              <label className="pm-label block mb-1.5">Month</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={month.split('-')[1] || '01'}
                  onChange={(e) => {
                    const year = month.split('-')[0] || new Date().getFullYear().toString()
                    setMonth(`${year}-${e.target.value}`)
                  }}
                  className="pm-input"
                >
                  {MONTH_LABELS.map((label, idx) => {
                    const value = `${idx + 1}`.padStart(2, '0')
                    return <option key={value} value={value}>{label}</option>
                  })}
                </select>
                <select
                  value={month.split('-')[0] || new Date().getFullYear().toString()}
                  onChange={(e) => {
                    const monthVal = month.split('-')[1] || '01'
                    setMonth(`${e.target.value}-${monthVal}`)
                  }}
                  className="pm-input"
                >
                  {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="region" className="pm-label block mb-1.5">Region</label>
              <select
                id="region"
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
              <label htmlFor="cabin" className="pm-label block mb-1.5">Cabin</label>
              <select
                id="cabin"
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
              <label htmlFor="passengers" className="pm-label block mb-1.5">Passengers</label>
              <select
                id="passengers"
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

          <div className="space-y-3 pt-2 border-t border-[#dbe9e2]">
            <div className="flex items-center justify-between">
              <h3 className="pm-label">Your Wallet</h3>
              <button onClick={addRow} className="text-xs text-[#0f766e] hover:underline font-medium">+ Add program</button>
            </div>
            <div className="grid gap-2">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <select
                    value={row.program_id}
                    onChange={(e) => updateRow(row.id, 'program_id', e.target.value)}
                    className="pm-input flex-1"
                  >
                    <option value="">Select program...</option>
                    <optgroup label="Transferable">
                      {byType('transferable_points').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                    <optgroup label="Airlines">
                      {byType('airline_miles').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                    placeholder="50,000"
                    className="pm-input w-28 text-right font-mono"
                  />
                  <button
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    className="text-gray-400 hover:text-red-500 px-2 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={runInspireSearch}
            disabled={!isReady || loading}
            className="pm-button w-full sm:w-auto"
          >
            {loading ? 'Scanning routes...' : 'Inspire Me →'}
          </button>

          {error && (
            <div className="bg-[#fff2f2] border border-[#f9d4d4] text-[#b42318] text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}
        </div>

        {/* Results Grid */}
        <div className="space-y-4">
          {results.length > 0 && (
            <div className="flex items-center justify-between">
              <h2 className="pm-heading text-xl">Top Picks</h2>
              <span className="text-xs text-[#5f7c70]">
                {results.length} destinations found
                {failedDestinations.length > 0 ? ` · ${failedDestinations.length} failed` : ''}
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => (
              <div 
                key={item.destination.code} 
                className={`pm-card p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                  item.best?.is_reachable ? 'border-[#8ed3c8] bg-[#fcfefd]' : 'opacity-80 bg-white'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-[#173f34] text-lg">{item.destination.city}</h3>
                      <p className="text-xs text-[#5f7c70] font-mono">{item.destination.code}</p>
                    </div>
                    {item.best?.is_reachable ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#157347] bg-[#ecf9f1] px-2 py-1 rounded-md border border-[#c7e7d4]">
                        Reachable
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f7c70] bg-[#f2f7f3] px-2 py-1 rounded-md">
                        Waitlist
                      </span>
                    )}
                  </div>

                  {item.best ? (
                    <div className="space-y-2">
                      <div className="text-sm">
                        <p className="text-[#5f7c70] text-xs uppercase tracking-wider font-semibold">Best Path</p>
                        <p className="font-medium text-[#173f34] mt-0.5">{item.best.program_name}</p>
                        <p className="text-xs text-[#0f766e] truncate">{item.best.transfer_chain}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#edf4ef]">
                        <div>
                          <p className="text-[10px] text-[#5f7c70]">Miles</p>
                          <p className="font-bold text-[#173f34]">{item.best.estimated_miles.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#5f7c70]">Value</p>
                          <p className="font-bold text-[#157347]">{formatCpp(item.best.cpp_cents)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#5f7c70] italic py-4">No award space found.</p>
                  )}
                </div>

                {item.best && (
                  <a
                    href={item.best.deep_link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full text-center text-xs font-semibold text-[#0f766e] bg-[#ecf9f7] hover:bg-[#def4ef] border border-[#b8e3da] py-2 rounded-lg transition-colors"
                  >
                    Check Availability ↗
                  </a>
                )}
              </div>
            ))}
          </div>

          {results.length === 0 && !loading && (
            <div className="text-center py-12 text-[#5f7c70]">
              <p>Ready to explore? Enter your details above and hit Inspire Me.</p>
            </div>
          )}

          {failedDestinations.length > 0 && (
            <p className="text-xs text-[#8a5b12] bg-[#fff8eb] border border-[#f2d8ad] rounded-xl px-3 py-2">
              Some destinations could not be scored this run. Try again to refresh route coverage.
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
