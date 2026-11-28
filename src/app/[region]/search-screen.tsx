'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowUpRight, Plus, X } from 'lucide-react'
import { AirportAutocomplete } from '@/components/AirportAutocomplete'
import { readLocalBalanceCache, writeLocalBalanceCache } from '@/lib/local-balance-cache'
import { trackEvent } from '@/lib/analytics'

export type WalletProgram = { id: string; name: string; kind: 'bank' | 'airline' }

type Balance = { program_id: string; amount: string }

type TransferPath = {
  from_program_name: string
  points: number
  ratio_from: number
  ratio_to: number
  transfer_time_max_hrs: number | null
  is_instant: boolean
  bonus_pct: number | null
  bonus_ends: string | null
  miles: number
}

type TransferOption = {
  program_id: string
  program_name: string
  color_hex: string | null
  miles_held: number
  paths: TransferPath[]
  miles_available: number
  airline_search: { url: string; label: string; note?: string } | null
}

const CABINS = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
]

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

function transferTime(path: TransferPath): string {
  if (path.is_instant) return 'instant'
  if (!path.transfer_time_max_hrs) return 'time varies'
  return path.transfer_time_max_hrs <= 48 ? `up to ${path.transfer_time_max_hrs}h` : `up to ${Math.round(path.transfer_time_max_hrs / 24)} days`
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** 250:200 → 5:4 */
function ratio(path: TransferPath): string {
  const d = gcd(path.ratio_from, path.ratio_to) || 1
  return `${path.ratio_from / d}:${path.ratio_to / d}`
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function SearchScreen({ region, programs }: { region: 'us' | 'in'; programs: WalletProgram[] }) {
  const searchParams = useSearchParams()
  const locale = region === 'in' ? 'en-IN' : 'en-US'
  const fmt = (n: number) => n.toLocaleString(locale)

  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState(inDays(60))
  const [cabin, setCabin] = useState('business')
  const [passengers, setPassengers] = useState(1)
  const [balances, setBalances] = useState<Balance[]>([{ program_id: '', amount: '' }])
  const [options, setOptions] = useState<TransferOption[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const knownIds = useMemo(() => new Set(programs.map((p) => p.id)), [programs])

  // Saved balances: the signed-in wallet first, then this browser's copy.
  useEffect(() => {
    let cancelled = false
    async function load() {
      let saved: Balance[] = []
      try {
        const res = await fetch(`/api/user/balances?region=${region.toUpperCase()}`)
        if (res.ok) {
          const body = (await res.json()) as { balances?: Array<{ program_id: string; balance: number }> }
          saved = (body.balances ?? []).map((b) => ({ program_id: b.program_id, amount: String(b.balance) }))
        }
      } catch {
        // Signed out or offline: fall back to this browser.
      }
      if (saved.length === 0) {
        saved = (readLocalBalanceCache()?.balances ?? []).map((b) => ({ program_id: b.program_id, amount: String(b.balance) }))
      }
      saved = saved.filter((b) => knownIds.has(b.program_id))
      if (!cancelled && saved.length > 0) setBalances(saved)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [region, knownIds])

  const updateBalance = (index: number, patch: Partial<Balance>) =>
    setBalances((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const validBalances = balances
    .map((b) => ({ program_id: b.program_id, amount: Number(b.amount.replace(/[^\d]/g, '')) }))
    .filter((b) => b.program_id && b.amount > 0)
  const canSearch = origin.length === 3 && destination.length === 3 && Boolean(date) && validBalances.length > 0

  async function search(event: React.FormEvent) {
    event.preventDefault()
    if (!canSearch) return
    setLoading(true)
    setError(null)
    writeLocalBalanceCache(validBalances.map((b) => ({ program_id: b.program_id, balance: b.amount })))
    try {
      const res = await fetch('/api/transfer-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: region.toUpperCase(),
          balances: validBalances,
          trip: { origin, destination, date, cabin, passengers },
        }),
      })
      if (!res.ok) throw new Error('Something went wrong. Please try again.')
      const body = (await res.json()) as { options: TransferOption[] }
      setOptions(body.options)
      trackEvent('transfer_options_viewed', { region, programs: body.options.length, cabin })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const banks = programs.filter((p) => p.kind === 'bank')
  const airlines = programs.filter((p) => p.kind === 'airline')

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6 sm:pt-12">
      {searchParams.get('auth_error') && (
        <p role="alert" className="mb-4 rounded-xl border border-pm-border bg-pm-surface-soft px-4 py-3 text-sm text-pm-ink-900">
          Sign-in didn&apos;t complete. Please try again.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-pm-ink-900 sm:text-4xl">What can your points book?</h1>

      <form onSubmit={search} className="pm-card mt-5 space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-pm-ink-500">
            From
            <AirportAutocomplete id="from" value={origin} onChange={setOrigin} placeholder="City or airport" className="mt-1" />
          </label>
          <label className="block text-xs font-medium text-pm-ink-500">
            To
            <AirportAutocomplete id="to" value={destination} onChange={setDestination} placeholder="City or airport" className="mt-1" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-pm-ink-500">
            Date
            <input type="date" value={date} min={inDays(0)} onChange={(e) => setDate(e.target.value)} className="pm-input mt-1" />
          </label>
          <label className="block text-xs font-medium text-pm-ink-500">
            Cabin
            <select value={cabin} onChange={(e) => setCabin(e.target.value)} className="pm-input mt-1">
              {CABINS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="col-span-2 block text-xs font-medium text-pm-ink-500 sm:col-span-1">
            Travellers
            <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="pm-input mt-1">
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-pm-ink-500">Your points</legend>
          {balances.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                aria-label="Program"
                value={row.program_id}
                onChange={(e) => updateBalance(index, { program_id: e.target.value })}
                className="pm-input min-w-0 flex-1"
              >
                <option value="">Choose a program</option>
                <optgroup label="Card points">
                  {banks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
                <optgroup label="Airline miles">
                  {airlines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              </select>
              <input
                aria-label="Points"
                inputMode="numeric"
                placeholder="Points"
                value={row.amount}
                onChange={(e) => updateBalance(index, { amount: e.target.value })}
                className="pm-input w-28 shrink-0 sm:w-36"
              />
              {balances.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setBalances((current) => current.filter((_, i) => i !== index))}
                  className="shrink-0 rounded-full p-2 text-pm-ink-500 hover:bg-pm-surface-soft hover:text-pm-ink-900"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBalances((current) => [...current, { program_id: '', amount: '' }])}
            className="inline-flex items-center gap-1 text-sm font-medium text-pm-ink-700 hover:text-pm-ink-900"
          >
            <Plus className="h-4 w-4" /> Add points
          </button>
        </fieldset>

        <button type="submit" disabled={!canSearch || loading} className="pm-button w-full py-3 text-base">
          {loading ? 'Checking…' : 'Show my options'}
        </button>
      </form>

      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

      {options && (
        <section className="mt-8" aria-live="polite">
          <p className="text-sm text-pm-ink-500">
            {options.length === 0
              ? 'None of these points transfer to an airline. Try adding card points such as Chase, Amex or HDFC.'
              : `${options.length} airline${options.length === 1 ? '' : 's'} your points can reach. Seats aren't checked yet: each airline's search shows what's open.`}
          </p>

          <ul className="mt-3 space-y-3">
            {options.map((option) => (
              <li key={option.program_id} className="pm-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-semibold text-pm-ink-900">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: option.color_hex ?? 'var(--pm-ink-500)' }} />
                    {option.program_name}
                  </h2>
                  <p className="shrink-0 text-right">
                    <span className="block text-lg font-semibold tabular-nums text-pm-ink-900">{fmt(option.miles_available)}</span>
                    <span className="text-xs text-pm-ink-500">miles</span>
                  </p>
                </div>

                <ul className="mt-3 divide-y divide-pm-border border-t border-pm-border text-sm">
                  {option.miles_held > 0 && (
                    <li className="flex items-center justify-between gap-3 py-2">
                      <span className="text-pm-ink-700">Already in your account</span>
                      <span className="tabular-nums text-pm-ink-900">{fmt(option.miles_held)}</span>
                    </li>
                  )}
                  {option.paths.map((path) => (
                    <li key={path.from_program_name} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-pm-ink-900">{path.from_program_name}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-pm-ink-500">
                          {ratio(path)} · {transferTime(path)}
                          {path.bonus_pct ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              +{path.bonus_pct}% bonus{path.bonus_ends ? ` until ${shortDate(path.bonus_ends)}` : ''}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-pm-ink-900">+{fmt(path.miles)}</span>
                    </li>
                  ))}
                </ul>

                {option.airline_search && (
                  <a
                    href={option.airline_search.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pm-button-secondary mt-3 gap-1 py-2"
                  >
                    {option.airline_search.label} <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
