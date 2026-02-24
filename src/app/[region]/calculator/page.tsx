'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { trackEvent } from '@/lib/analytics'
import { REGIONS, type Region } from '@/lib/regions'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type Program = {
  id: string
  name: string
  short_name: string
  type: string
  color_hex: string
  geography?: string | null
}

type RedemptionResult = {
  label: string
  category: string
  from_program: Program
  to_program?: Program
  points_in: number
  points_out: number
  cpp_cents: number
  total_value_cents: number
  active_bonus_pct?: number
  is_instant: boolean
  transfer_time_max_hrs?: number
  is_best: boolean
}

type CalculateResponse = {
  total_cash_value_cents: number
  total_optimal_value_cents: number
  value_left_on_table_cents: number
  results: RedemptionResult[]
}

type BalanceRow = {
  id: string
  program_id: string
  amount: string
}

type AILink = { label: string; url: string }

type AIFlight = {
  airline: string
  cabin: string
  route: string
  points_needed: string
  transfer_chain: string
  notes: string
}

type AIHotel = {
  name: string
  chain: string
  points_per_night: string
  transfer_chain: string
  notes: string
}

type AIRec = {
  type: 'recommendation'
  headline: string
  reasoning: string
  flight: AIFlight | null
  hotel: AIHotel | null
  total_summary: string
  steps: string[]
  tip: string
  links: AILink[]
}

type AIClarify = {
  type: 'clarifying'
  message: string
  questions: string[]
}

type Preferences = {
  home_airport: string | null
  preferred_cabin: string
  preferred_airlines: string[]
  avoided_airlines: string[]
}

// Chat message union
type ChatMsg =
  | { role: 'user'; text: string }
  | { role: 'ai'; payload: AIRec | AIClarify }

// Gemini history format (sent to API)
type GeminiTurn = { role: 'user' | 'model'; parts: [{ text: string }] }

// ── Award Search types ────────────────────────────────────────

type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first'

type AwardSearchResult = {
  program_slug: string
  program_name: string
  program_color: string
  estimated_miles: number
  estimated_cash_value_cents: number
  cpp_cents: number
  transfer_chain: string | null
  transfer_is_instant: boolean
  points_needed_from_wallet: number
  availability: { date: string; available: boolean; source: 'seats_aero' } | null
  deep_link: { url: string; label: string; note?: string }
  has_real_availability: boolean
  is_reachable: boolean
}

type AwardNarrative = {
  headline: string
  body: string
  top_pick_slug: string
  warnings: string[]
  booking_tips: string[]
}

type AwardSearchResponse = {
  provider: 'stub' | 'seats_aero'
  params: {
    origin: string; destination: string; cabin: CabinClass
    passengers: number; start_date: string; end_date: string
  }
  results: AwardSearchResult[]
  ai_narrative: AwardNarrative | null
  searched_at: string
  error?: 'real_availability_unavailable'
  message?: string
}

type AwardParams = {
  origin: string
  destination: string
  start_date: string
  end_date: string
  cabin: CabinClass
  passengers: number
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const EXAMPLE_GOALS = [
  'Weekend trip to NYC for 2',
  'Business class to Tokyo',
  'Family vacation to Hawaii',
  'Honeymoon in the Maldives',
]

const AI_STATUSES = [
  'Analyzing your balances…',
  'Finding transfer sweet spots…',
  'Looking up award options…',
  'Building your recommendation…',
]

const RESULTS_PREVIEW = 5
const ANON_MESSAGE_LIMIT = 3
const ALERT_BANNER_DISMISSED_KEY = 'pm_alert_banner_dismissed_v1'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// K2: Safe currency formatter - handles null, undefined, NaN
function fmt(cents: number | null | undefined, symbol: string): string {
  // Guard against falsy values (null, undefined, 0, NaN)
  if (!cents || isNaN(cents)) {
    return '—' // em-dash for unavailable value
  }
  return `${symbol}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(cents / 100)}`
}

function parsePointsInput(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '')
  if (!digitsOnly) return NaN
  return Number.parseInt(digitsOnly, 10)
}

function transferTime(r: RedemptionResult) {
  if (r.category !== 'transfer_partner') return 'Instant'
  if (r.is_instant) return 'Instant'
  const hrs = r.transfer_time_max_hrs ?? 72
  if (hrs <= 2) return '~2 hrs'
  if (hrs <= 48) return '1–2 days'
  return 'Up to 3 days'
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: AIRec }) {
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
              <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Airline</p>
              <p className="text-[#163d33] mt-0.5 font-medium">{rec.flight.airline}</p>
            </div>
            <div>
              <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Route</p>
              <p className="text-[#163d33] mt-0.5 font-medium">{rec.flight.route}</p>
            </div>
            <div>
              <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Points needed</p>
              <p className="text-[#157347] mt-0.5 font-bold">{rec.flight.points_needed}</p>
            </div>
            <div>
              <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Transfer from</p>
              <p className="text-[#0f766e] mt-0.5 font-medium">{rec.flight.transfer_chain}</p>
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
              <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Property</p>
              <p className="text-[#163d33] mt-0.5 font-medium">{rec.hotel.name}</p>
            </div>
            <div>
              <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Points/night</p>
              <p className="text-[#157347] mt-0.5 font-bold">{rec.hotel.points_per_night}</p>
            </div>
            <div>
              <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Transfer from</p>
              <p className="text-[#0f766e] mt-0.5 font-medium">{rec.hotel.transfer_chain}</p>
            </div>
          </div>
          {rec.hotel.notes && (
            <p className="text-[#5f7c70] text-xs border-t border-[#dbeae1] pt-2">{rec.hotel.notes}</p>
          )}
        </div>
      )}

      {rec.total_summary && (
        <div className="rounded-xl px-4 py-3 border border-pm-success/30 bg-pm-success/10">
          <p className="text-xs text-pm-success font-semibold uppercase tracking-wider">Total</p>
          <p className="text-pm-success text-sm font-semibold mt-1">{rec.total_summary}</p>
        </div>
      )}

      {rec.steps?.length > 0 && (
        <div>
          <p className="pm-label text-pm-accent">How to book</p>
          <ol className="mt-2 space-y-2">
            {rec.steps.map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-full bg-pm-accent-soft text-pm-accent-strong text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5 border border-pm-accent-soft">
                  {i + 1}
                </span>
                <span className="text-pm-ink-900 text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {rec.tip && (
        <div className="rounded-xl px-4 py-3 border border-pm-warning/30 bg-pm-warning/10">
          <p className="text-xs text-pm-warning font-semibold uppercase tracking-wider">Pro tip</p>
          <p className="text-pm-warning text-sm mt-1 leading-relaxed">{rec.tip}</p>
        </div>
      )}

      {rec.links?.length > 0 && (
        <div>
          <p className="pm-label mb-2">Quick links</p>
          <div className="flex flex-wrap gap-2">
            {rec.links.map((link, i) => (
              <a
                key={i}
                href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-pm-surface-soft hover:bg-pm-accent-soft/50 text-pm-ink-900 border border-pm-border px-3 py-1.5 rounded-full transition-colors"
              >
                {link.label}
                <span className="text-pm-ink-500">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// AWARD SEARCH PANEL
// ─────────────────────────────────────────────

const CABIN_LABELS: Record<CabinClass, string> = {
  economy: 'Economy',
  premium_economy: 'Premium Economy',
  business: 'Business',
  first: 'First',
}

function AwardSearchPanel({
  awardParams,
  setAwardParams,
  awardLoading,
  awardResult,
  awardError,
  onSearch,
}: {
  awardParams: AwardParams
  setAwardParams: React.Dispatch<React.SetStateAction<AwardParams>>
  awardLoading: boolean
  awardResult: AwardSearchResponse | null
  awardError: string | null
  onSearch: () => void
}) {
  const reachable = awardResult?.results.filter(r => r.is_reachable) ?? []
  const unreachable = awardResult?.results.filter(r => !r.is_reachable) ?? []
  const narrative = awardResult?.ai_narrative ?? null
  const estimatesOnly =
    awardResult?.provider === 'stub' &&
    awardResult?.error === 'real_availability_unavailable'

  return (
    <div className="pm-card-soft overflow-hidden">
      <div className="px-6 py-4 border-b border-pm-border flex items-center gap-2">
        <span className="text-xl">✈️</span>
        <h2 className="pm-heading text-base">Find Award Flights</h2>
        <span className="pm-pill ml-1">
          {awardResult?.provider === 'seats_aero' ? 'Live via Seats.aero' : 'Chart estimates'}
        </span>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pm-label block mb-1.5">
              From
            </label>
            <input
              type="text"
              maxLength={3}
              placeholder="JFK"
              value={awardParams.origin}
              onChange={e => setAwardParams(p => ({ ...p, origin: e.target.value.toUpperCase() }))}
              className="pm-input font-mono uppercase"
            />
          </div>
          <div>
            <label className="pm-label block mb-1.5">
              To
            </label>
            <input
              type="text"
              maxLength={3}
              placeholder="NRT"
              value={awardParams.destination}
              onChange={e => setAwardParams(p => ({ ...p, destination: e.target.value.toUpperCase() }))}
              className="pm-input font-mono uppercase"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pm-label block mb-1.5">
              Earliest Date
            </label>
            <input
              type="date"
              value={awardParams.start_date}
              onChange={e => setAwardParams(p => {
                const nextStartDate = e.target.value
                const shouldClearEnd = !!p.end_date && p.end_date <= nextStartDate
                return {
                  ...p,
                  start_date: nextStartDate,
                  end_date: shouldClearEnd ? '' : p.end_date,
                }
              })}
              className="pm-input"
            />
          </div>
          <div>
            <label className="pm-label block mb-1.5">
              Latest Date
            </label>
            <input
              type="date"
              value={awardParams.end_date}
              min={awardParams.start_date || undefined}
              onChange={e => setAwardParams(p => ({ ...p, end_date: e.target.value }))}
              className="pm-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pm-label block mb-1.5">
              Cabin
            </label>
            <select
              value={awardParams.cabin}
              onChange={e => setAwardParams(p => ({ ...p, cabin: e.target.value as CabinClass }))}
              className="pm-input"
            >
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </div>
          <div>
            <label className="pm-label block mb-1.5">
              Passengers
            </label>
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
          <p className="text-sm text-pm-danger bg-red-50 rounded-xl px-4 py-2 border border-pm-danger/20">{awardError}</p>
        )}
        {estimatesOnly && (
          <p className="text-sm text-pm-warning bg-pm-warning/10 rounded-xl px-4 py-2 border border-pm-warning/30">
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
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Searching award space…
              </>
            ) : 'Search Award Flights →'}
        </button>
      </div>

      {awardResult && (
        <div className="border-t border-pm-border px-6 py-5 space-y-5 bg-pm-surface-soft/50">
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
                <div className="bg-pm-warning/10 border border-pm-warning/30 rounded-lg px-3 py-2 space-y-1">
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
                <AwardResultCard key={r.program_slug} result={r} topSlug={narrative?.top_pick_slug} />
              ))}
            </div>
          )}

          {unreachable.length > 0 && (
            <div className="space-y-3">
              <p className="pm-label">Need more points</p>
              {unreachable.map(r => (
                <AwardResultCard key={r.program_slug} result={r} topSlug={narrative?.top_pick_slug} muted />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AwardResultCard({
  result: r,
  topSlug,
  muted = false,
}: {
  result: AwardSearchResult
  topSlug?: string
  muted?: boolean
}) {
  const isTopPick = r.program_slug === topSlug

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
      muted
        ? 'bg-[#f2f7f3] border-[#dce9e1] opacity-70'
        : isTopPick
        ? 'bg-[#e9f8f3] border-[#9ad6c9]'
        : 'bg-white border-[#d5e5d9]'
    }`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.program_color }} />
        <span className="text-pm-ink-900 font-semibold text-sm">{r.program_name}</span>

        {isTopPick && !muted && (
          <span className="text-xs bg-pm-accent text-white px-2 py-0.5 rounded-full font-semibold">Top pick</span>
        )}
        {r.has_real_availability && (
          <span className="text-xs bg-pm-success/10 text-pm-success border border-pm-success/30 px-2 py-0.5 rounded-full">Live</span>
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
          <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Miles needed</p>
          <p className="text-[#157347] font-bold mt-0.5">{r.estimated_miles.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Est. value</p>
          <p className="text-[#244437] font-semibold mt-0.5">
            {(r.estimated_cash_value_cents / 100).toLocaleString('en-US', {
              style: 'currency', currency: 'USD', maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div>
          <p className="text-[#5f7c70] uppercase tracking-wider font-semibold text-[10px]">Rate</p>
          <p className="text-[#244437] mt-0.5">{r.cpp_cents.toFixed(2)}¢/pt</p>
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

// ─────────────────────────────────────────────
// ALERT WIDGET
// ─────────────────────────────────────────────

function AlertWidget({
  visible,
  alertEmail,
  alertLoading,
  alertSubscribed,
  alertError,
  programNames,
  onDismiss,
  onEmailChange,
  onSubscribe,
}: {
  visible: boolean
  alertEmail: string
  alertLoading: boolean
  alertSubscribed: boolean
  alertError: string | null
  programNames: string[]
  onDismiss: () => void
  onEmailChange: (email: string) => void
  onSubscribe: (e: React.FormEvent) => void
}) {
  if (!visible) return null

  return (
    <div className="pm-card p-5">
      <div className="flex items-start gap-3">
        <span className="text-lg">🔔</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-pm-ink-900">Get notified of transfer bonuses</p>
          <p className="text-xs text-pm-ink-500 mt-0.5">
            We&apos;ll email you when {programNames.slice(0, 3).join(', ')} run a transfer bonus.
          </p>
          {alertSubscribed ? (
            <p className="text-xs text-pm-success font-medium mt-3">
              ✓ You&apos;re subscribed! We&apos;ll email you when bonuses appear.
            </p>
          ) : (
            <form onSubmit={onSubscribe} className="flex gap-2 mt-3">
              <input
                type="email"
                value={alertEmail}
                onChange={e => onEmailChange(e.target.value)}
                placeholder="your@email.com"
                required
                className="pm-input min-w-0"
              />
              <button
                type="submit"
                disabled={alertLoading}
                className="pm-button rounded-xl px-4 py-2 text-sm flex-shrink-0"
              >
                {alertLoading ? '…' : 'Notify me'}
              </button>
            </form>
          )}
          {alertError && <p className="text-xs text-pm-danger mt-2">{alertError}</p>}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-pm-ink-500 hover:text-pm-ink-900 text-sm px-1"
          aria-label="Dismiss transfer bonus alert signup"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function CalculatorPage() {
  const params = useParams()
  const region = (params.region as Region) || 'us'
  const config = REGIONS[region] ?? REGIONS.us
  const reduceMotion = useReducedMotion()
  const { user, preferences, refreshPreferences } = useAuth()

  const [programs, setPrograms]             = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(true) // K1: Track program loading
  const [rows, setRows]                     = useState<BalanceRow[]>([{ id: '1', program_id: '', amount: '' }])
  const [result, setResult]                 = useState<CalculateResponse | null>(null)
  const [loading, setLoading]               = useState(false)
  const [calcError, setCalcError]           = useState<string | null>(null)
  const [showAllResults, setShowAllResults] = useState(false)
  const [saveToast, setSaveToast]           = useState(false)
  const [alertEmailInput, setAlertEmailInput] = useState('')
  const [alertBannerDismissed, setAlertBannerDismissed] = useState(false)
  const [alertSubscribed, setAlertSubscribed] = useState(false)
  const [alertBannerLoading, setAlertBannerLoading] = useState(false)
  const [alertBannerError, setAlertBannerError] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  // Preferences panel state
  const [prefOpen, setPrefOpen]             = useState(false)
  const [prefForm, setPrefForm]             = useState<Preferences>({
    home_airport: '',
    preferred_cabin: 'any',
    preferred_airlines: [],
    avoided_airlines: [],
  })
  const [prefInput, setPrefInput]           = useState({ preferred: '', avoided: '' })
  const [prefSaving, setPrefSaving]         = useState(false)

  // Chat state
  const [chatMessages, setChatMessages]     = useState<ChatMsg[]>([])
  const [geminiHistory, setGeminiHistory]   = useState<GeminiTurn[]>([])
  const [chatInput, setChatInput]           = useState('')
  const [aiLoading, setAiLoading]           = useState(false)
  const [aiStatus, setAiStatus]             = useState('')
  const [aiError, setAiError]               = useState<string | null>(null)
  const [messageCount, setMessageCount]     = useState(0)

  // Award search state
  const [awardParams, setAwardParams]     = useState<AwardParams>({
    origin: '', destination: '', start_date: '', end_date: '',
    cabin: 'business', passengers: 1,
  })
  const [awardLoading, setAwardLoading]   = useState(false)
  const [awardResult, setAwardResult]     = useState<AwardSearchResponse | null>(null)
  const [awardError, setAwardError]       = useState<string | null>(null)
  const [activePanel, setActivePanel]     = useState<'redemptions' | 'awards' | 'advisor'>('redemptions')

  const chatEndRef    = useRef<HTMLDivElement>(null)
  const resultsRef    = useRef<HTMLDivElement>(null)
  const statusTimer   = useRef<ReturnType<typeof setInterval> | null>(null)
  const milestoneFired = useRef<Set<string>>(new Set())

  // K1: Load programs for the current region with loading state and validation
  useEffect(() => {
    setProgramsLoading(true)
    setPrograms([]) // Clear programs immediately when region changes
    fetch(`/api/programs?region=${encodeURIComponent(region.toUpperCase())}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load programs (${r.status})`)
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          // K1: Validate all programs match current region
          const validPrograms = data.filter((p: Program) => {
            // Programs without geography are global (valid for all)
            if (!p.geography) return true
            // Programs with geography must match current region
            return p.geography === 'global' || p.geography.toLowerCase() === region.toLowerCase()
          })
          setPrograms(validPrograms)
        } else {
          setPrograms([])
        }
      })
      .catch(() => setPrograms([]))
      .finally(() => setProgramsLoading(false))
  }, [region])

  // Restore alert-banner dismissed preference.
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(ALERT_BANNER_DISMISSED_KEY)
      if (dismissed === '1') {
        setAlertBannerDismissed(true)
      }
    } catch {
      // ignore localStorage failures
    }
  }, [])

  useEffect(() => {
    if (user?.email && !alertEmailInput) {
      setAlertEmailInput(user.email)
    }
  }, [user, alertEmailInput])

  // Load saved balances on sign-in
  useEffect(() => {
    if (!user) return
    fetch('/api/user/balances').then(r => r.json()).then(({ balances }) => {
      if (!balances?.length) return
      setRows(balances.map((b: { program_id: string; balance: number }, i: number) => ({
        id: String(i + 1),
        program_id: b.program_id,
        amount: String(Math.max(0, Math.round(b.balance))),
      })))
    })
  }, [user])

  // Sync preferences form when preferences load
  useEffect(() => {
    if (preferences) {
      setPrefForm({
        home_airport: preferences.home_airport ?? '',
        preferred_cabin: preferences.preferred_cabin ?? 'any',
        preferred_airlines: preferences.preferred_airlines ?? [],
        avoided_airlines: preferences.avoided_airlines ?? [],
      })
      // Pre-fill award search origin from home airport
      if (preferences.home_airport) {
        setAwardParams(p => p.origin ? p : { ...p, origin: preferences.home_airport!.toUpperCase() })
      }
    }
  }, [preferences])

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, aiLoading])

  // ── Balance row helpers ───────────────────────────────────────

  const addRow = () => {
    trackEvent('calculator_add_row_clicked', { existing_rows: rows.length, region })
    setRows(p => [...p, { id: Date.now().toString(), program_id: '', amount: '' }])
  }
  const removeRow = (id: string) =>
    setRows(p => p.filter(r => r.id !== id))
  const updateRow = (id: string, field: 'program_id' | 'amount', value: string) =>
    setRows(p => p.map(r => r.id === id ? { ...r, [field]: value } : r))

  // ── Save balances ─────────────────────────────────────────────

  const saveBalances = async (balances: { program_id: string; amount: number }[]) => {
    if (!user) return
    await fetch('/api/user/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balances: balances.map(b => ({ program_id: b.program_id, balance: b.amount })) }),
    })
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)
  }

  const dismissAlertBanner = () => {
    setAlertBannerDismissed(true)
    try {
      localStorage.setItem(ALERT_BANNER_DISMISSED_KEY, '1')
    } catch {
      // ignore localStorage failures
    }
  }

  // ── Calculate ────────────────────────────────────────────────

  const calculate = async () => {
    setCalcError(null)
    setResult(null)
    setChatMessages([])
    setGeminiHistory([])
    setShowAllResults(false)
    setMessageCount(0)
    setActivePanel('redemptions')

    const balances = rows
      .filter(r => r.program_id && r.amount)
      .map(r => ({ program_id: r.program_id, amount: parsePointsInput(r.amount) }))
      .filter(b => b.amount > 0)

    trackEvent('calculator_calculate_clicked', {
      balances_count: balances.length,
      signed_in: Boolean(user),
      region,
    })
    trackEvent('calculator_run', {
      balances_count: balances.length,
      region,
    })

    if (balances.length === 0) {
      setCalcError('Select at least one program and enter a balance.')
      trackEvent('calculator_calculate_blocked', { reason: 'no_balances', region })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balances }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data: CalculateResponse = await res.json()
      setResult(data)
      trackEvent('calculator_calculate_succeeded', {
        results_count: data.results.length,
        top_value_cents: data.total_optimal_value_cents,
        region,
      })
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)

      // Auto-save balances for signed-in users
      if (user) await saveBalances(balances)
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : 'Calculation failed')
      trackEvent('calculator_calculate_failed', {
        message: e instanceof Error ? e.message : 'calculation_failed',
        region,
      })
    } finally {
      setLoading(false)
    }
  }

  // ── Save preferences ─────────────────────────────────────────

  const savePreferences = async () => {
    setPrefSaving(true)
    await fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefForm),
    })
    await refreshPreferences()
    setPrefSaving(false)
    setPrefOpen(false)
  }

  // ── Award search ──────────────────────────────────────────────

  const runAwardSearch = async () => {
    setAwardError(null)
    setAwardResult(null)
    setActivePanel('awards')

    const balances = rows
      .filter(r => r.program_id && r.amount)
      .map(r => ({ program_id: r.program_id, amount: parsePointsInput(r.amount) }))
      .filter(b => b.amount > 0)

    trackEvent('calculator_award_search_clicked', {
      balances_count: balances.length,
      origin: awardParams.origin || null,
      destination: awardParams.destination || null,
      cabin: awardParams.cabin,
      region,
    })
    trackEvent('award_search_run', {
      origin: awardParams.origin || null,
      destination: awardParams.destination || null,
      cabin: awardParams.cabin,
      region,
    })

    if (balances.length === 0) {
      setAwardError('Add at least one points balance above, then search.')
      trackEvent('calculator_award_search_blocked', { reason: 'no_balances', region })
      return
    }

    setAwardLoading(true)
    try {
      const res = await fetch('/api/award-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...awardParams, balances }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Search failed' }))
        throw new Error(err.error ?? 'Search failed')
      }
      const data: AwardSearchResponse = await res.json()
      setAwardResult(data)
      trackEvent('calculator_award_search_succeeded', {
        reachable_count: data.results.filter(r => r.is_reachable).length,
        results_count: data.results.length,
        provider: data.provider,
        region,
      })
    } catch (e) {
      setAwardError(e instanceof Error ? e.message : 'Award search failed')
      trackEvent('calculator_award_search_failed', {
        message: e instanceof Error ? e.message : 'award_search_failed',
        region,
      })
    } finally {
      setAwardLoading(false)
    }
  }

  // ── Tag input helpers ─────────────────────────────────────────

  const addTag = (field: 'preferred_airlines' | 'avoided_airlines', inputKey: 'preferred' | 'avoided') => {
    const val = prefInput[inputKey].trim()
    if (!val) return
    setPrefForm(f => ({ ...f, [field]: [...f[field], val] }))
    setPrefInput(p => ({ ...p, [inputKey]: '' }))
  }

  const removeTag = (field: 'preferred_airlines' | 'avoided_airlines', idx: number) => {
    setPrefForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }))
  }

  const alertProgramIds = useMemo(() => {
    if (!result) return []
    return [...new Set(
      result.results
        .map((r) => r.from_program?.id)
        .filter((id): id is string => Boolean(id))
    )]
  }, [result])

  const alertProgramNames = useMemo(() => {
    if (alertProgramIds.length === 0) return []
    return alertProgramIds
      .map((id) => programs.find((p) => p.id === id)?.short_name ?? '')
      .filter(Boolean)
  }, [alertProgramIds, programs])

  const showAlertBanner = Boolean(
    result &&
    alertProgramIds.length > 0 &&
    !alertBannerDismissed
  )

  const handleAlertBannerSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!alertEmailInput.trim() || alertProgramIds.length === 0) return
    setAlertBannerLoading(true)
    setAlertBannerError(null)

    try {
      const res = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: alertEmailInput.trim(),
          program_ids: alertProgramIds,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Could not subscribe' }))
        throw new Error(payload.error ?? 'Could not subscribe')
      }

      setAlertSubscribed(true)
      setTimeout(dismissAlertBanner, 1800)
    } catch (err) {
      setAlertBannerError(err instanceof Error ? err.message : 'Could not subscribe')
    } finally {
      setAlertBannerLoading(false)
    }
  }

  const shareTripSnapshot = async () => {
    if (!result) return
    setShareBusy(true)
    setShareError(null)
    try {
      const top = result.results[0]
      const payload = {
        region,
        trip_data: {
          destination: awardParams.destination || null,
          top_program: top?.to_program?.name || top?.from_program?.name || null,
          points_used: top?.points_in ?? 0,
          total_value_cents: result.total_optimal_value_cents,
          results_count: result.results.length,
        },
      }
      const res = await fetch('/api/trips/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({} as { url?: string; error?: string })))
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Could not create share URL')
      }
      setShareUrl(data.url)
      await navigator.clipboard?.writeText(data.url).catch(() => {})
      trackEvent('trip_shared', { region, has_destination: Boolean(payload.trip_data.destination) })
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not create share URL')
    } finally {
      setShareBusy(false)
    }
  }

  // ── Send chat message ─────────────────────────────────────────

  const sendMessage = async (text?: string) => {
    const msg = (text ?? chatInput).trim()
    if (!msg || aiLoading) return

    // Enforce anonymous message limit
    if (!user && messageCount >= ANON_MESSAGE_LIMIT) return
    setActivePanel('advisor')
    trackEvent('calculator_ai_message_sent', {
      message_index: messageCount + 1,
      signed_in: Boolean(user),
      preset: Boolean(text),
      region,
    })

    setChatInput('')
    setAiError(null)
    setMessageCount(c => c + 1)

    // Add user message to chat
    const userMsg: ChatMsg = { role: 'user', text: msg }
    setChatMessages(prev => [...prev, userMsg])

    // Build named balances
    const namedBalances = rows
      .filter(r => r.program_id && r.amount)
      .map(r => ({
        program_id: r.program_id,
        name: programs.find(p => p.id === r.program_id)?.name ?? r.program_id,
        amount: parsePointsInput(r.amount),
      }))
      .filter(b => b.amount > 0)

    // K3: Guard against empty balances
    if (namedBalances.length === 0) {
      setChatMessages(prev => [...prev, {
        role: 'ai',
        payload: {
          type: 'clarifying',
          message: 'Add your point balances above to get personalized advice.',
          questions: ['Enter your points balance and select a program, then ask me for recommendations!'],
        } as AIClarify,
      }])
      setAiLoading(false)
      trackEvent('calculator_ai_blocked_empty_balances', { region })
      return
    }

    // Start loading animation
    setAiLoading(true)
    setAiStatus(AI_STATUSES[0])
    let statusIdx = 0
    statusTimer.current = setInterval(() => {
      statusIdx = (statusIdx + 1) % AI_STATUSES.length
      setAiStatus(AI_STATUSES[statusIdx])
    }, 2000)

    // Current history for this request
    const historyForRequest = geminiHistory

    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyForRequest,
          message: msg,
          balances: namedBalances,
          topResults: result?.results,
          preferences: preferences ?? null,
          region,
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      // Accumulate streamed response
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
      }

      // Extract and parse JSON
      const jsonMatch = fullText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Could not parse AI response')
      const data = JSON.parse(jsonMatch[0]) as AIRec | AIClarify | { error: string }

      if ('error' in data) throw new Error(data.error)

      // Add AI response to chat
      setChatMessages(prev => [...prev, { role: 'ai', payload: data as AIRec | AIClarify }])
      trackEvent('calculator_ai_response_received', {
        response_type: (data as AIRec | AIClarify).type,
        region,
      })

      // Update Gemini history for next turn
      setGeminiHistory(prev => [
        ...prev,
        { role: 'user', parts: [{ text: msg }] },
        { role: 'model', parts: [{ text: fullText }] },
      ])
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI request failed')
      trackEvent('calculator_ai_response_failed', {
        message: e instanceof Error ? e.message : 'ai_request_failed',
        region,
      })
    } finally {
      if (statusTimer.current) clearInterval(statusTimer.current)
      setAiLoading(false)
      setAiStatus('')
    }
  }

  const byType = (type: string) => programs.filter(p => p.type === type)
  const enteredBalances = rows
    .filter(r => r.program_id && r.amount)
    .map(r => ({ program_id: r.program_id, amount: parsePointsInput(r.amount) }))
    .filter(b => b.amount > 0)
  const totalTrackedPoints = enteredBalances.reduce((sum, b) => sum + b.amount, 0)
  const visibleResults = result
    ? showAllResults ? result.results : result.results.slice(0, RESULTS_PREVIEW)
    : []
  const bestOverall = result?.results.find(r => r.is_best) ?? result?.results[0] ?? null
  const hasCalculatorResult = Boolean(result)
  const canUseAdvisor = true
  const hasBookingPlan = chatMessages.some(
    (m) => m.role === 'ai' && m.payload.type === 'recommendation',
  ) || Boolean(awardResult?.results.some(r => r.is_reachable))
  const hasActionableOutput = Boolean(result || awardResult || chatMessages.length > 0 || aiLoading)
  const steps = [
    { label: 'Add balances', done: enteredBalances.length > 0 },
    { label: 'Set goal', done: Boolean(awardParams.destination || awardParams.origin || prefForm.home_airport || chatMessages.length) },
    { label: 'See options', done: Boolean(result || awardResult) },
    { label: 'Book', done: hasBookingPlan },
  ]

  const switchPanel = (panel: 'redemptions' | 'awards' | 'advisor', source: string) => {
    setActivePanel(panel)
    trackEvent('calculator_panel_changed', { panel, source, region })
    if (panel === 'advisor') {
      trackEvent('advisor_opened', { source, region })
    }
    if (hasActionableOutput) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }

  useEffect(() => {
    const completed = [
      { id: 'add_balances', done: enteredBalances.length > 0 },
      { id: 'set_goal', done: Boolean(awardParams.destination || awardParams.origin || prefForm.home_airport || chatMessages.length) },
      { id: 'see_options', done: Boolean(result || awardResult) },
      { id: 'book', done: hasBookingPlan },
    ]

    for (const step of completed) {
      if (!step.done || milestoneFired.current.has(step.id)) continue
      milestoneFired.current.add(step.id)
      trackEvent('calculator_funnel_step_completed', { step: step.id, region })
    }
  }, [
    enteredBalances.length,
    awardParams.destination,
    awardParams.origin,
    prefForm.home_airport,
    chatMessages.length,
    result,
    awardResult,
    hasBookingPlan,
    region,
  ])

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="border-b border-pm-border bg-pm-bg/50">
        <div className="pm-shell py-10 sm:py-12 text-center">
          <span className="pm-pill mb-3">Clear path from points to booking {config.flag}</span>
          <h1 className="pm-heading text-3xl sm:text-4xl mb-2">Points Calculator</h1>
          <p className="pm-subtle max-w-2xl mx-auto">
            Start with your wallet, then follow one decision flow: value snapshot, top redemption path, and booking actions.
          </p>
        </div>
      </section>

      <main className="pm-shell py-7 sm:py-9 space-y-6 flex-1">
        <div className="pm-card p-2 sm:p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {steps.map((step, idx) => (
              <div
                key={step.label}
                className={`rounded-xl px-3 py-2.5 border text-sm ${
                  step.done
                    ? 'bg-pm-success/10 border-pm-success/30 text-pm-success'
                    : 'bg-pm-surface-soft border-pm-border text-pm-ink-500'
                }`}
              >
                <p className="text-[10px] uppercase tracking-wider font-semibold">Step {idx + 1}</p>
                <p className="mt-0.5 font-semibold">{step.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-8 space-y-6">
            <div className="pm-card-soft overflow-hidden">
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-pm-border flex items-center justify-between gap-3">
                <div>
                  <h2 className="pm-heading text-lg">1. Your Points Balances</h2>
                  <p className="pm-subtle text-xs mt-0.5">Add one or many programs. We normalize and rank options for you.</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                  {saveToast && (
                    <span className="pm-pill text-pm-success border-pm-success/30 bg-pm-success/10">
                      ✓ Balances saved
                    </span>
                  )}
                  <span className="pm-pill">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="px-5 sm:px-6 py-5 space-y-3">
                {/* K1: Show loading state while programs are loading */}
                {programsLoading && (
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0 bg-pm-accent/20 animate-pulse" />
                    <div className="pm-input flex-1 bg-pm-surface-soft text-pm-ink-500 cursor-not-allowed">
                      Loading programs…
                    </div>
                    <div className="pm-input w-28 sm:w-36 bg-pm-surface-soft" />
                  </div>
                )}
                {!programsLoading && rows.map((row) => {
                  const selected = programs.find((p) => p.id === row.program_id)
                  return (
                    <div key={row.id} className="flex items-center gap-2.5 sm:gap-3">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-white"
                        style={{ backgroundColor: selected?.color_hex ?? '#c7d9ce' }}
                      />
                      <select
                        value={row.program_id}
                        onChange={(e) => updateRow(row.id, 'program_id', e.target.value)}
                        className="pm-input flex-1"
                        disabled={programsLoading}
                      >
                        <option value="">Select a program…</option>
                        <optgroup label="Transferable Points">
                          {byType('transferable_points').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </optgroup>
                        <optgroup label="Airline Miles">
                          {byType('airline_miles').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </optgroup>
                        <optgroup label="Hotel Points">
                          {byType('hotel_points').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </optgroup>
                      </select>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="80,000"
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                        className="pm-input w-28 sm:w-36 text-right"
                      />
                      {rows.length > 1 && (
                        <button
                          onClick={() => removeRow(row.id)}
                          className="w-8 h-8 rounded-lg text-pm-ink-500 hover:text-pm-danger hover:bg-red-50 transition-colors text-lg leading-none flex-shrink-0"
                          aria-label="Remove program"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {calcError && (
                <div className="mx-5 sm:mx-6 mb-4 text-sm text-pm-danger bg-red-50 rounded-xl px-4 py-2 border border-pm-danger/20">
                  {calcError}
                </div>
              )}

              <div className="px-5 sm:px-6 py-4 bg-pm-surface-soft border-t border-pm-border flex items-center justify-between gap-3">
                <button onClick={addRow} className="pm-button-secondary px-4 py-2 text-sm">
                  + Add program
                </button>
                <span className="text-xs text-pm-ink-500">
                  {totalTrackedPoints.toLocaleString()} total tracked points
                </span>
              </div>
            </div>

            {user && (
              <div className="pm-card overflow-hidden">
                <button
                  onClick={() => setPrefOpen((v) => !v)}
                  className="w-full px-5 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-pm-surface-soft transition-colors"
                >
                  <div>
                    <h2 className="pm-heading text-base">2. Travel Preferences</h2>
                    <p className="pm-subtle text-xs mt-0.5">Improve recommendation quality with quick trip preferences.</p>
                  </div>
                  <span className="pm-subtle text-sm">{prefOpen ? '▲' : '▼'}</span>
                </button>

                {prefOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-4 border-t border-pm-border space-y-4">
                    <div>
                      <label htmlFor="homeAirport" className="pm-label block mb-1.5">Home Airport</label>
                      <input
                        id="homeAirport"
                        type="text"
                        placeholder="e.g. JFK, LAX, ORD"
                        value={prefForm.home_airport ?? ''}
                        onChange={(e) => setPrefForm((f) => ({ ...f, home_airport: e.target.value }))}
                        className="pm-input"
                      />
                    </div>

                    <div>
                      <label htmlFor="prefCabin" className="pm-label block mb-1.5">Preferred Cabin</label>
                      <select
                        id="prefCabin"
                        value={prefForm.preferred_cabin}
                        onChange={(e) => setPrefForm((f) => ({ ...f, preferred_cabin: e.target.value }))}
                        className="pm-input"
                      >
                        <option value="any">Any cabin</option>
                        <option value="economy">Economy</option>
                        <option value="business">Business class</option>
                        <option value="first">First class</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="prefAirlines" className="pm-label block mb-1.5">Preferred Airlines</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {prefForm.preferred_airlines.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-pm-accent-soft text-pm-accent-strong text-xs px-2.5 py-1 rounded-full border border-pm-accent-soft">
                            {a}
                            <button onClick={() => removeTag('preferred_airlines', i)} className="hover:text-pm-danger font-bold">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          id="prefAirlines"
                          type="text"
                          placeholder="e.g. United, Delta"
                          value={prefInput.preferred}
                          onChange={(e) => setPrefInput((p) => ({ ...p, preferred: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addTag('preferred_airlines', 'preferred')}
                          className="pm-input flex-1"
                        />
                        <button onClick={() => addTag('preferred_airlines', 'preferred')} className="pm-button-secondary px-4 py-2 text-sm">
                          Add
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="avoidAirlines" className="pm-label block mb-1.5">Airlines to Avoid</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {prefForm.avoided_airlines.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-red-50 text-pm-danger text-xs px-2.5 py-1 rounded-full border border-pm-danger/20">
                            {a}
                            <button onClick={() => removeTag('avoided_airlines', i)} className="hover:text-pm-danger font-bold">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          id="avoidAirlines"
                          type="text"
                          placeholder="e.g. Spirit, Frontier"
                          value={prefInput.avoided}
                          onChange={(e) => setPrefInput((p) => ({ ...p, avoided: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addTag('avoided_airlines', 'avoided')}
                          className="pm-input flex-1"
                        />
                        <button onClick={() => addTag('avoided_airlines', 'avoided')} className="pm-button-secondary px-4 py-2 text-sm">
                          Add
                        </button>
                      </div>
                    </div>

                    <button onClick={savePreferences} disabled={prefSaving} className="pm-button">
                      {prefSaving ? 'Saving…' : 'Save Preferences'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="pm-card-soft p-5">
                <p className="pm-label mb-2">Decision Snapshot</p>
                <h2 className="pm-heading text-lg">What to do next</h2>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-pm-border bg-pm-surface px-3.5 py-3">
                    <p className="text-xs text-pm-ink-500">Tracked programs</p>
                    <p className="text-xl font-bold text-[#173f34] mt-0.5">{enteredBalances.length}</p>
                  </div>
                  <div className="rounded-xl border border-pm-border bg-pm-surface px-3.5 py-3">
                    <p className="text-xs text-pm-ink-500">Tracked points</p>
                    <p className="text-xl font-bold text-[#173f34] mt-0.5">{totalTrackedPoints.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-pm-border bg-pm-surface px-3.5 py-3">
                    <p className="text-xs text-pm-ink-500">Current goal</p>
                    <p className="text-sm font-semibold text-[#173f34] mt-0.5">
                      {awardParams.origin && awardParams.destination
                        ? `${awardParams.origin} → ${awardParams.destination}`
                        : 'Set in Award Flights tab'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={calculate}
                  disabled={loading || enteredBalances.length === 0}
                  className="pm-button w-full mt-4"
                >
                  {loading ? 'Calculating…' : '3. Find Best Redemptions'}
                </button>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => switchPanel('awards', 'sticky_quick_actions')}
                    className="pm-button-secondary px-2 py-2 text-xs"
                  >
                    Find award flights
                  </button>
                  <button
                    onClick={() => switchPanel('advisor', 'sticky_quick_actions')}
                    className="pm-button-secondary px-2 py-2 text-xs"
                  >
                    Ask AI advisor
                  </button>
                </div>

                {result && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button onClick={() => switchPanel('redemptions', 'sticky_shortcuts')} className="pm-button-secondary px-2 py-2 text-xs">Redemptions</button>
                    <button onClick={() => switchPanel('awards', 'sticky_shortcuts')} className="pm-button-secondary px-2 py-2 text-xs">Award Flights</button>
                    <button onClick={() => switchPanel('advisor', 'sticky_shortcuts')} className="pm-button-secondary px-2 py-2 text-xs">AI Advisor</button>
                  </div>
                )}
              </div>

              {bestOverall && (
                <div className="pm-card p-4">
                  <p className="pm-label text-pm-accent">Current top path</p>
                  <p className="text-sm font-semibold text-pm-ink-900 mt-1">{bestOverall.label}</p>
                  <p className="text-xs text-pm-ink-500 mt-1">
                    {bestOverall.points_in.toLocaleString()} pts · {bestOverall.cpp_cents.toFixed(2)}¢/pt
                  </p>
                  <p className="text-lg font-bold text-pm-success mt-2">{fmt(bestOverall.total_value_cents, config.currencySymbol)}</p>
                  <button
                    onClick={() => {
                      trackEvent('calculator_booking_plan_requested', { source: 'sticky_top_path' })
                      sendMessage(`Build me a booking plan for this option: ${bestOverall.label}. Keep it step-by-step and mention transfer timing.`)
                    }}
                    className="pm-button-secondary w-full mt-3 text-sm"
                  >
                    4. Build booking plan
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>

        <div ref={resultsRef} className="space-y-4">
            <div className="pm-card p-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'redemptions', label: 'Best Redemptions', disabled: false },
                  { key: 'awards', label: 'Award Flights', disabled: false },
                  { key: 'advisor', label: 'AI Advisor', disabled: false },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => switchPanel(tab.key as 'redemptions' | 'awards' | 'advisor', 'results_tabs')}
                    disabled={tab.disabled}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                      activePanel === tab.key
                        ? 'bg-pm-accent text-white'
                        : 'bg-pm-surface-soft text-pm-ink-700 hover:bg-pm-accent-soft/50'
                    } ${tab.disabled ? 'opacity-50 cursor-not-allowed hover:bg-[#f2f8f3]' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activePanel === 'redemptions' && (
              result ? (
                <div className="space-y-5 sm:space-y-6">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    <div className="pm-card p-5">
                      <p className="pm-label">Cash Value</p>
                      <p className="text-3xl font-extrabold text-pm-ink-900 mt-2 tabular-nums">{fmt(result.total_cash_value_cents, config.currencySymbol)}</p>
                      <p className="text-xs text-[#6a8579] mt-1">If redeemed for cash</p>
                    </div>
                    <div className="rounded-2xl border border-pm-success/30 bg-pm-success/10 p-5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-pm-accent">Best Value</p>
                      <p className="text-3xl font-extrabold text-pm-accent-strong mt-2 tabular-nums">{fmt(result.total_optimal_value_cents, config.currencySymbol)}</p>
                      <p className="text-xs text-pm-accent-strong mt-1">Optimal redemption path</p>
                    </div>
                    <div className="rounded-2xl border border-pm-success/30 bg-pm-success/10 p-5 sm:col-span-2 lg:col-span-1">
                      <p className="text-xs font-semibold uppercase tracking-widest text-pm-success">Extra Value</p>
                      <p className="text-3xl font-extrabold text-pm-success mt-2 tabular-nums">{fmt(result.value_left_on_table_cents, config.currencySymbol)}</p>
                      <p className="text-xs text-pm-success mt-1">vs. simple cash back</p>
                    </div>
                  </div>

                  <div className="pm-card-soft overflow-hidden">
                    <div className="px-5 sm:px-6 py-4 border-b border-pm-border flex items-center justify-between gap-3">
                      <div>
                        <h2 className="pm-heading text-base">Top Redemption Options</h2>
                        <p className="pm-subtle text-xs mt-0.5">Ranked by total value</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="pm-pill">{result.results.length} total</span>
                        <button
                          onClick={shareTripSnapshot}
                          disabled={shareBusy}
                          className="pm-button-secondary px-3 py-1.5 text-xs"
                        >
                          {shareBusy ? 'Sharing…' : 'Share this trip'}
                        </button>
                      </div>
                    </div>
                    {shareUrl && (
                      <div className="px-5 sm:px-6 py-2 border-b border-pm-border text-xs text-pm-accent">
                        Share URL copied: <a className="underline" href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a>
                      </div>
                    )}
                    {shareError && (
                      <div className="px-5 sm:px-6 py-2 border-b border-pm-danger/20 text-xs text-pm-danger bg-red-50">
                        {shareError}
                      </div>
                    )}

                    <div className="divide-y divide-[#e8f2ec]">
                      {visibleResults.map((r, i) => (
                        <motion.div
                          key={i}
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                          transition={reduceMotion ? undefined : { duration: 0.2, delay: i * 0.05 }}
                          className={`px-5 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 transition-colors ${r.is_best ? 'bg-pm-success/10' : 'hover:bg-pm-surface-soft'}`}
                        >
                          <span className="text-xs text-pm-ink-500 font-mono w-4 flex-shrink-0 text-center">{i + 1}</span>
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.from_program.color_hex }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {r.is_best && <span className="text-xs bg-pm-accent text-white px-2 py-0.5 rounded-full font-semibold">Best</span>}
                              {r.active_bonus_pct && <span className="text-xs bg-pm-success/10 text-pm-success px-2 py-0.5 rounded-full border border-pm-success/30 font-semibold">+{r.active_bonus_pct}% bonus</span>}
                              <span className="text-sm font-medium text-pm-ink-900">{r.label}</span>
                            </div>
                            <p className="text-xs text-pm-ink-500 mt-0.5">
                              {r.points_in.toLocaleString()} pts
                              {r.category === 'transfer_partner' && ` → ${r.points_out.toLocaleString()} ${r.to_program?.short_name ?? ''}`}
                              {' · '}{transferTime(r)}{' · '}{r.cpp_cents.toFixed(2)}¢/pt
                            </p>
                          </div>
                          <p className={`text-base font-bold tabular-nums flex-shrink-0 ${r.is_best ? 'text-pm-accent-strong' : 'text-pm-ink-900'}`}>
                            {fmt(r.total_value_cents, config.currencySymbol)}
                          </p>
                          <button
                            onClick={() => {
                              trackEvent('calculator_redemption_use_clicked', {
                                label: r.label,
                                points_in: r.points_in,
                                region,
                              })
                              sendMessage(`Plan this redemption for me: ${r.label}. I have ${r.points_in.toLocaleString()} points available.`)
                            }}
                            className="pm-button-secondary px-3 py-2 text-xs"
                          >
                            Use this
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    {result.results.length > RESULTS_PREVIEW && (
                      <button
                        onClick={() => setShowAllResults((v) => !v)}
                        className="w-full py-3.5 text-sm text-pm-ink-500 hover:text-pm-ink-900 font-medium border-t border-pm-border hover:bg-pm-surface-soft transition-colors"
                      >
                        {showAllResults ? '↑ Show fewer' : `↓ Show all ${result.results.length} options`}
                      </button>
                    )}
                  </div>

                  <AlertWidget
                    visible={showAlertBanner}
                    alertEmail={alertEmailInput}
                    alertLoading={alertBannerLoading}
                    alertSubscribed={alertSubscribed}
                    alertError={alertBannerError}
                    programNames={alertProgramNames}
                    onDismiss={dismissAlertBanner}
                    onEmailChange={setAlertEmailInput}
                    onSubscribe={handleAlertBannerSubscribe}
                  />
                </div>
              ) : (
                <div className="pm-card-soft p-6 text-center">
                  <h3 className="pm-heading text-lg">Run value ranking first</h3>
                  <p className="pm-subtle text-sm mt-1 mb-4">Add balances and click “Find Best Redemptions” to unlock this view.</p>
                  <button
                    onClick={calculate}
                    disabled={loading || enteredBalances.length === 0}
                    className="pm-button"
                  >
                    {loading ? 'Calculating…' : 'Find Best Redemptions'}
                  </button>
                </div>
              )
            )}

            {activePanel === 'awards' && (
              <AwardSearchPanel
                awardParams={awardParams}
                setAwardParams={setAwardParams}
                awardLoading={awardLoading}
                awardResult={awardResult}
                awardError={awardError}
                onSearch={runAwardSearch}
              />
            )}

            {activePanel === 'advisor' && (
              <div className="pm-card-soft overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-pm-border flex items-center gap-2 flex-wrap">
                  <span className="text-xl">✨</span>
                  <h2 className="pm-heading text-base">AI Points Advisor</h2>
                  <span className="pm-pill">Powered by Gemini</span>
                  {canUseAdvisor && chatMessages.length > 0 && user && (
                    <button
                      onClick={() => { setChatMessages([]); setGeminiHistory([]); setMessageCount(0) }}
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

                  {canUseAdvisor && chatMessages.length === 0 && !aiLoading && (
                    <div>
                      <p className="text-pm-ink-500 text-sm mb-4">
                        Tell me where you want to go. I&apos;ll ask short clarifying questions and build a step-by-step plan with your points.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {EXAMPLE_GOALS.map((eg) => (
                          <button
                            key={eg}
                            onClick={() => sendMessage(eg)}
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
                          <div className="bg-pm-accent text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-sm max-w-xs shadow-sm">
                            {msg.text}
                          </div>
                        </div>
                      ) : msg.payload.type === 'clarifying' ? (
                        <div className="flex gap-3">
                          <span className="w-7 h-7 rounded-full bg-pm-accent-soft text-pm-accent-strong border border-pm-accent-soft flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                            ✨
                          </span>
                          <div className="pm-card p-4 max-w-lg">
                            <p className="text-pm-ink-900 text-sm leading-relaxed">{msg.payload.message}</p>
                            {msg.payload.questions.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {msg.payload.questions.map((q, qi) => (
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
                    <div className="rounded-xl border border-pm-danger/20 bg-red-50 px-4 py-3 text-sm">
                      <p className="text-pm-danger font-medium">Our AI is taking a break. Here are your raw results.</p>
                      <p className="text-pm-danger mt-1">{aiError}</p>
                      <button
                        onClick={() => switchPanel(result ? 'redemptions' : 'awards', 'ai_error_fallback')}
                        className="mt-2 text-pm-danger underline underline-offset-4"
                      >
                        View non-AI results
                      </button>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                <div className="px-5 sm:px-6 py-4 border-t border-pm-border bg-pm-surface-soft">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      disabled={aiLoading}
                      placeholder={chatMessages.length === 0 ? 'e.g. I want to fly business class to Tokyo…' : 'Reply or ask a follow-up…'}
                      className="pm-input flex-1"
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={aiLoading || !chatInput.trim()}
                      className="pm-button flex-shrink-0"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
