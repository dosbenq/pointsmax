'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import NavBar from '@/components/NavBar'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type Program = {
  id: string
  name: string
  short_name: string
  type: string
  color_hex: string
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

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function fmt(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(cents / 100)
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
    <div className="space-y-4">
      {/* Headline + reasoning */}
      <div>
        <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Recommendation</p>
        <h3 className="text-white font-bold text-base mt-1 leading-snug">{rec.headline}</h3>
        <p className="text-slate-300 text-sm leading-relaxed mt-1.5">{rec.reasoning}</p>
      </div>

      {/* Flight card */}
      {rec.flight && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span>✈️</span>
            <span className="text-white font-semibold text-sm">Flight</span>
            <span className="ml-auto text-xs bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">
              {rec.flight.cabin}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Airline</p>
              <p className="text-slate-200 mt-0.5 font-medium">{rec.flight.airline}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Route</p>
              <p className="text-slate-200 mt-0.5 font-medium">{rec.flight.route}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Points needed</p>
              <p className="text-emerald-300 mt-0.5 font-bold">{rec.flight.points_needed}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Transfer from</p>
              <p className="text-indigo-300 mt-0.5 font-medium">{rec.flight.transfer_chain}</p>
            </div>
          </div>
          {rec.flight.notes && (
            <p className="text-slate-400 text-xs border-t border-white/10 pt-2">{rec.flight.notes}</p>
          )}
        </div>
      )}

      {/* Hotel card */}
      {rec.hotel && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span>🏨</span>
            <span className="text-white font-semibold text-sm">Hotel</span>
            <span className="ml-auto text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full">
              {rec.hotel.chain}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2">
              <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Property</p>
              <p className="text-slate-200 mt-0.5 font-medium">{rec.hotel.name}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Points/night</p>
              <p className="text-emerald-300 mt-0.5 font-bold">{rec.hotel.points_per_night}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Transfer from</p>
              <p className="text-indigo-300 mt-0.5 font-medium">{rec.hotel.transfer_chain}</p>
            </div>
          </div>
          {rec.hotel.notes && (
            <p className="text-slate-400 text-xs border-t border-white/10 pt-2">{rec.hotel.notes}</p>
          )}
        </div>
      )}

      {/* Total cost */}
      {rec.total_summary && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">💰 Total</p>
          <p className="text-emerald-200 text-sm font-medium mt-1">{rec.total_summary}</p>
        </div>
      )}

      {/* Steps */}
      {rec.steps?.length > 0 && (
        <div>
          <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">How to book</p>
          <ol className="mt-2 space-y-2">
            {rec.steps.map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5 border border-indigo-500/40">
                  {i + 1}
                </span>
                <span className="text-slate-200 text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Pro tip */}
      {rec.tip && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">💡 Pro tip</p>
          <p className="text-amber-200/80 text-sm mt-1 leading-relaxed">{rec.tip}</p>
        </div>
      )}

      {/* Quick links */}
      {rec.links?.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Quick links</p>
          <div className="flex flex-wrap gap-2">
            {rec.links.map((link, i) => (
              <a
                key={i}
                href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 px-3 py-1.5 rounded-full transition-colors"
              >
                {link.label}
                <span className="text-slate-400">↗</span>
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
  rows,
  programs,
  awardParams,
  setAwardParams,
  awardLoading,
  awardResult,
  awardError,
  onSearch,
}: {
  rows: BalanceRow[]
  programs: Program[]
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

  return (
    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
        <span className="text-xl">✈️</span>
        <h2 className="text-white font-semibold">Find Award Flights</h2>
        <span className="text-xs text-indigo-300 bg-indigo-900/60 px-2 py-0.5 rounded-full ml-1">
          {awardResult?.provider === 'seats_aero' ? 'Live via Seats.aero' : 'Chart estimates'}
        </span>
      </div>

      {/* Search form */}
      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Origin */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              From
            </label>
            <input
              type="text"
              maxLength={3}
              placeholder="JFK"
              value={awardParams.origin}
              onChange={e => setAwardParams(p => ({ ...p, origin: e.target.value.toUpperCase() }))}
              className="w-full bg-white/10 border border-white/10 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {/* Destination */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              To
            </label>
            <input
              type="text"
              maxLength={3}
              placeholder="NRT"
              value={awardParams.destination}
              onChange={e => setAwardParams(p => ({ ...p, destination: e.target.value.toUpperCase() }))}
              className="w-full bg-white/10 border border-white/10 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Start date */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Earliest Date
            </label>
            <input
              type="date"
              value={awardParams.start_date}
              onChange={e => setAwardParams(p => ({ ...p, start_date: e.target.value }))}
              className="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>
          {/* End date */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Latest Date
            </label>
            <input
              type="date"
              value={awardParams.end_date}
              onChange={e => setAwardParams(p => ({ ...p, end_date: e.target.value }))}
              className="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Cabin */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Cabin
            </label>
            <select
              value={awardParams.cabin}
              onChange={e => setAwardParams(p => ({ ...p, cabin: e.target.value as CabinClass }))}
              className="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="economy" className="bg-slate-900">Economy</option>
              <option value="premium_economy" className="bg-slate-900">Premium Economy</option>
              <option value="business" className="bg-slate-900">Business</option>
              <option value="first" className="bg-slate-900">First</option>
            </select>
          </div>
          {/* Passengers */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Passengers
            </label>
            <select
              value={awardParams.passengers}
              onChange={e => setAwardParams(p => ({ ...p, passengers: parseInt(e.target.value, 10) }))}
              className="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <option key={n} value={n} className="bg-slate-900">{n} passenger{n !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {awardError && (
          <p className="text-sm text-red-400 bg-red-900/20 rounded-xl px-4 py-2">{awardError}</p>
        )}

        <button
          onClick={onSearch}
          disabled={awardLoading || !awardParams.origin || !awardParams.destination || !awardParams.start_date || !awardParams.end_date}
          className="w-full bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white text-sm font-medium py-3 rounded-full transition-colors flex items-center justify-center gap-2"
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

      {/* Results */}
      {awardResult && (
        <div className="border-t border-white/10 px-6 py-5 space-y-5">

          {/* AI Narrative */}
          {narrative && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-3">
              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider">✨ AI Analysis</p>
              <p className="text-white font-bold text-base leading-snug">{narrative.headline}</p>
              <p className="text-slate-300 text-sm leading-relaxed">{narrative.body}</p>
              {narrative.booking_tips?.length > 0 && (
                <div>
                  <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-1.5">Booking tips</p>
                  <ul className="space-y-1">
                    {narrative.booking_tips.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-indigo-400 flex-shrink-0">•</span>{tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {narrative.warnings?.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 space-y-1">
                  {narrative.warnings.map((w, i) => (
                    <p key={i} className="text-amber-300 text-xs flex gap-2">
                      <span>⚠️</span>{w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary line */}
          <p className="text-xs text-slate-500">
            {awardResult.params.origin} → {awardResult.params.destination} ·{' '}
            {CABIN_LABELS[awardResult.params.cabin]} · {awardResult.params.passengers} pax ·{' '}
            {reachable.length} reachable program{reachable.length !== 1 ? 's' : ''}
          </p>

          {/* Reachable programs */}
          {reachable.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Reachable with your points</p>
              {reachable.map(r => (
                <AwardResultCard key={r.program_slug} result={r} topSlug={narrative?.top_pick_slug} />
              ))}
            </div>
          )}

          {/* Unreachable programs */}
          {unreachable.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Need more points</p>
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
  const shortfall = r.points_needed_from_wallet - (r.is_reachable ? 0 : r.points_needed_from_wallet)

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
      muted
        ? 'bg-white/3 border-white/5 opacity-60'
        : isTopPick
        ? 'bg-indigo-500/15 border-indigo-500/40'
        : 'bg-white/5 border-white/10'
    }`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.program_color }} />
        <span className="text-white font-semibold text-sm">{r.program_name}</span>

        {isTopPick && !muted && (
          <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full font-semibold">★ Top Pick</span>
        )}
        {r.has_real_availability && (
          <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">Live</span>
        )}
        {!r.has_real_availability && (
          <span className="text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30 px-2 py-0.5 rounded-full">Est.</span>
        )}
        {r.transfer_is_instant && r.transfer_chain && (
          <span className="text-xs bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">⚡ Instant transfer</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Miles needed</p>
          <p className="text-emerald-300 font-bold mt-0.5">{r.estimated_miles.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Est. value</p>
          <p className="text-slate-200 font-semibold mt-0.5">
            {(r.estimated_cash_value_cents / 100).toLocaleString('en-US', {
              style: 'currency', currency: 'USD', maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Rate</p>
          <p className="text-slate-200 mt-0.5">{r.cpp_cents.toFixed(2)}¢/pt</p>
        </div>
      </div>

      {r.availability && (
        <div className="text-xs text-emerald-300">
          ✓ Available on {new Date(r.availability.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}

      {r.transfer_chain && (
        <p className="text-xs text-indigo-300">{r.transfer_chain}</p>
      )}

      {!r.is_reachable && (
        <p className="text-xs text-slate-500">
          Need {r.points_needed_from_wallet.toLocaleString()} pts from wallet
          {shortfall > 0 ? ` (${shortfall.toLocaleString()} more needed)` : ''}
        </p>
      )}

      <a
        href={r.deep_link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 px-3 py-1.5 rounded-full transition-colors"
      >
        {r.deep_link.label}
        <span className="text-slate-400">↗</span>
      </a>
      {r.deep_link.note && (
        <p className="text-[11px] text-slate-500">{r.deep_link.note}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function CalculatorPage() {
  const { user, preferences, signInWithGoogle, refreshPreferences } = useAuth()

  const [programs, setPrograms]             = useState<Program[]>([])
  const [rows, setRows]                     = useState<BalanceRow[]>([{ id: '1', program_id: '', amount: '' }])
  const [result, setResult]                 = useState<CalculateResponse | null>(null)
  const [loading, setLoading]               = useState(false)
  const [calcError, setCalcError]           = useState<string | null>(null)
  const [showAllResults, setShowAllResults] = useState(false)
  const [saveToast, setSaveToast]           = useState(false)

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

  const chatEndRef    = useRef<HTMLDivElement>(null)
  const resultsRef    = useRef<HTMLDivElement>(null)
  const statusTimer   = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load programs
  useEffect(() => {
    fetch('/api/programs').then(r => r.json()).then(setPrograms)
  }, [])

  // Load saved balances on sign-in
  useEffect(() => {
    if (!user) return
    fetch('/api/user/balances').then(r => r.json()).then(({ balances }) => {
      if (!balances?.length) return
      setRows(balances.map((b: { program_id: string; balance: number }, i: number) => ({
        id: String(i + 1),
        program_id: b.program_id,
        amount: b.balance.toLocaleString(),
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

  const addRow = () =>
    setRows(p => [...p, { id: Date.now().toString(), program_id: '', amount: '' }])
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

  // ── Calculate ────────────────────────────────────────────────

  const calculate = async () => {
    setCalcError(null)
    setResult(null)
    setChatMessages([])
    setGeminiHistory([])
    setShowAllResults(false)
    setMessageCount(0)

    const balances = rows
      .filter(r => r.program_id && r.amount)
      .map(r => ({ program_id: r.program_id, amount: parseInt(r.amount.replace(/,/g, ''), 10) }))
      .filter(b => b.amount > 0)

    if (balances.length === 0) {
      setCalcError('Select at least one program and enter a balance.')
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
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)

      // Auto-save balances for signed-in users
      if (user) await saveBalances(balances)
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : 'Calculation failed')
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

    const balances = rows
      .filter(r => r.program_id && r.amount)
      .map(r => ({ program_id: r.program_id, amount: parseInt(r.amount.replace(/,/g, ''), 10) }))
      .filter(b => b.amount > 0)

    if (balances.length === 0) {
      setAwardError('Add at least one points balance above, then search.')
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
    } catch (e) {
      setAwardError(e instanceof Error ? e.message : 'Award search failed')
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

  // ── Send chat message ─────────────────────────────────────────

  const sendMessage = async (text?: string) => {
    const msg = (text ?? chatInput).trim()
    if (!msg || aiLoading) return

    // Enforce anonymous message limit
    if (!user && messageCount >= ANON_MESSAGE_LIMIT) return

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
        name: programs.find(p => p.id === r.program_id)?.name ?? r.program_id,
        amount: parseInt(r.amount.replace(/,/g, ''), 10),
      }))
      .filter(b => b.amount > 0)

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
          topResults: result?.results ?? [],
          preferences: preferences ?? null,
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

      // Update Gemini history for next turn
      setGeminiHistory(prev => [
        ...prev,
        { role: 'user', parts: [{ text: msg }] },
        { role: 'model', parts: [{ text: fullText }] },
      ])
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI request failed')
    } finally {
      if (statusTimer.current) clearInterval(statusTimer.current)
      setAiLoading(false)
      setAiStatus('')
    }
  }

  const byType = (type: string) => programs.filter(p => p.type === type)
  const visibleResults = result
    ? showAllResults ? result.results : result.results.slice(0, RESULTS_PREVIEW)
    : []

  const atMessageLimit = !user && messageCount >= ANON_MESSAGE_LIMIT

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">

      {/* ══ NAVBAR ═══════════════════════════════════════════════ */}
      <NavBar />

      {/* ══ HERO ═════════════════════════════════════════════════ */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">Points Calculator</h1>
          <p className="text-slate-500">Find the highest-value redemption across 20+ programs.</p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* ══ INPUT CARD ══════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Your Points Balances</h2>
            <div className="flex items-center gap-3">
              {saveToast && (
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                  ✓ Balances saved
                </span>
              )}
              <span className="text-xs text-slate-400">{rows.length} program{rows.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="px-6 py-5 space-y-3">
            {rows.map(row => {
              const selected = programs.find(p => p.id === row.program_id)
              return (
                <div key={row.id} className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1"
                    style={{ backgroundColor: selected?.color_hex ?? '#E2E8F0' }}
                  />
                  <select
                    value={row.program_id}
                    onChange={e => updateRow(row.id, 'program_id', e.target.value)}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  >
                    <option value="">Select a program…</option>
                    <optgroup label="Transferable Points">
                      {byType('transferable_points').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                    <optgroup label="Airline Miles">
                      {byType('airline_miles').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                    <optgroup label="Hotel Points">
                      {byType('hotel_points').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 80,000"
                    value={row.amount}
                    onChange={e => updateRow(row.id, 'amount', e.target.value)}
                    className="w-36 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(row.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors text-lg leading-none flex-shrink-0"
                    >×</button>
                  )}
                </div>
              )
            })}
          </div>

          {calcError && (
            <div className="mx-6 mb-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{calcError}</div>
          )}

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button onClick={addRow} className="text-sm text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1 transition-colors">
              <span className="text-lg leading-none">+</span> Add program
            </button>
            <button
              onClick={calculate}
              disabled={loading}
              className="bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Calculating…
                </>
              ) : 'Calculate Value →'}
            </button>
          </div>
        </div>

        {/* ══ TRAVEL PREFERENCES (signed-in only) ═════════════════ */}
        {user && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              onClick={() => setPrefOpen(v => !v)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div>
                <h2 className="font-semibold text-slate-900">Travel Preferences</h2>
                <p className="text-xs text-slate-400 mt-0.5">Help the AI give better recommendations</p>
              </div>
              <span className="text-slate-400 text-sm">{prefOpen ? '▲' : '▼'}</span>
            </button>

            {prefOpen && (
              <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4">
                {/* Home airport */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Home Airport
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JFK, LAX, ORD"
                    value={prefForm.home_airport ?? ''}
                    onChange={e => setPrefForm(f => ({ ...f, home_airport: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                {/* Preferred cabin */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Preferred Cabin
                  </label>
                  <select
                    value={prefForm.preferred_cabin}
                    onChange={e => setPrefForm(f => ({ ...f, preferred_cabin: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  >
                    <option value="any">Any cabin</option>
                    <option value="economy">Economy</option>
                    <option value="business">Business class</option>
                    <option value="first">First class</option>
                  </select>
                </div>

                {/* Preferred airlines */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Preferred Airlines
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {prefForm.preferred_airlines.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full border border-slate-200">
                        {a}
                        <button onClick={() => removeTag('preferred_airlines', i)} className="hover:text-red-500 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. United, Delta"
                      value={prefInput.preferred}
                      onChange={e => setPrefInput(p => ({ ...p, preferred: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addTag('preferred_airlines', 'preferred')}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                    <button
                      onClick={() => addTag('preferred_airlines', 'preferred')}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium px-3"
                    >Add</button>
                  </div>
                </div>

                {/* Airlines to avoid */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Airlines to Avoid
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {prefForm.avoided_airlines.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2.5 py-1 rounded-full border border-red-100">
                        {a}
                        <button onClick={() => removeTag('avoided_airlines', i)} className="hover:text-red-900 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Spirit, Frontier"
                      value={prefInput.avoided}
                      onChange={e => setPrefInput(p => ({ ...p, avoided: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addTag('avoided_airlines', 'avoided')}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                    <button
                      onClick={() => addTag('avoided_airlines', 'avoided')}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium px-3"
                    >Add</button>
                  </div>
                </div>

                <button
                  onClick={savePreferences}
                  disabled={prefSaving}
                  className="bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors"
                >
                  {prefSaving ? 'Saving…' : 'Save Preferences'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ RESULTS ═════════════════════════════════════════════ */}
        {result && (
          <div ref={resultsRef} className="space-y-5">

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Cash Value</p>
                <p className="text-3xl font-extrabold text-slate-800 mt-2 tabular-nums">{fmt(result.total_cash_value_cents)}</p>
                <p className="text-xs text-slate-400 mt-1">If redeemed for cash</p>
              </div>
              <div className="bg-slate-900 rounded-2xl p-5 shadow-md text-white">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Best Value</p>
                <p className="text-3xl font-extrabold mt-2 tabular-nums">{fmt(result.total_optimal_value_cents)}</p>
                <p className="text-xs text-indigo-200 mt-1">Optimal redemption</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 shadow-sm">
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">Extra Value</p>
                <p className="text-3xl font-extrabold text-emerald-700 mt-2 tabular-nums">{fmt(result.value_left_on_table_cents)}</p>
                <p className="text-xs text-emerald-500 mt-1">vs. simple cash back</p>
              </div>
            </div>

            {/* Results list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Top Redemption Options</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Ranked by total value</p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium">
                  {result.results.length} total
                </span>
              </div>

              <div className="divide-y divide-slate-50">
                {visibleResults.map((r, i) => (
                  <div key={i} className={`px-6 py-4 flex items-center gap-4 transition-colors ${r.is_best ? 'bg-slate-50 hover:bg-slate-100' : 'hover:bg-slate-50'}`}>
                    <span className="text-xs text-slate-300 font-mono w-4 flex-shrink-0 text-center">{i + 1}</span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.from_program.color_hex }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.is_best && <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full font-semibold">★ Best</span>}
                        {r.active_bonus_pct && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">+{r.active_bonus_pct}% bonus</span>}
                        <span className="text-sm font-medium text-slate-900">{r.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {r.points_in.toLocaleString()} pts
                        {r.category === 'transfer_partner' && ` → ${r.points_out.toLocaleString()} ${r.to_program?.short_name ?? ''}`}
                        {' · '}{transferTime(r)}{' · '}{r.cpp_cents.toFixed(2)}¢/pt
                      </p>
                    </div>
                    <p className={`text-base font-bold tabular-nums flex-shrink-0 ${r.is_best ? 'text-slate-900' : 'text-slate-800'}`}>
                      {fmt(r.total_value_cents)}
                    </p>
                  </div>
                ))}
              </div>

              {result.results.length > RESULTS_PREVIEW && (
                <button
                  onClick={() => setShowAllResults(v => !v)}
                  className="w-full py-3.5 text-sm text-slate-500 hover:text-slate-900 font-medium border-t border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  {showAllResults ? '↑ Show fewer' : `↓ Show all ${result.results.length} options`}
                </button>
              )}
            </div>

            {/* ══ AWARD SEARCH PANEL ════════════════════════════════ */}
            <AwardSearchPanel
              rows={rows}
              programs={programs}
              awardParams={awardParams}
              setAwardParams={setAwardParams}
              awardLoading={awardLoading}
              awardResult={awardResult}
              awardError={awardError}
              onSearch={runAwardSearch}
            />

            {/* ══ AI CHAT ADVISOR ═══════════════════════════════════ */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl shadow-xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h2 className="text-white font-semibold">AI Points Advisor</h2>
                <span className="text-xs text-indigo-300 bg-indigo-900/60 px-2 py-0.5 rounded-full ml-1">
                  Powered by Gemini
                </span>
                {!user && (
                  <span className="text-xs text-slate-400 ml-auto">
                    {Math.max(0, ANON_MESSAGE_LIMIT - messageCount)} message{ANON_MESSAGE_LIMIT - messageCount !== 1 ? 's' : ''} remaining
                  </span>
                )}
                {chatMessages.length > 0 && user && (
                  <button
                    onClick={() => { setChatMessages([]); setGeminiHistory([]); setMessageCount(0) }}
                    className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Clear chat
                  </button>
                )}
              </div>

              {/* Chat feed */}
              <div className="px-6 py-5 space-y-4 max-h-[600px] overflow-y-auto">

                {/* Empty state */}
                {chatMessages.length === 0 && !aiLoading && (
                  <div>
                    <p className="text-slate-400 text-sm mb-4">
                      Tell me where you want to go — I&apos;ll ask a few questions then build a step-by-step plan using your points.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {EXAMPLE_GOALS.map(eg => (
                        <button
                          key={eg}
                          onClick={() => !atMessageLimit && sendMessage(eg)}
                          disabled={atMessageLimit}
                          className="text-xs text-indigo-300 bg-indigo-900/50 hover:bg-indigo-800/70 border border-indigo-800 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {eg}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                {chatMessages.map((msg, i) => (
                  <div key={i}>
                    {msg.role === 'user' ? (
                      /* User bubble */
                      <div className="flex justify-end">
                        <div className="bg-slate-900 text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-sm max-w-xs">
                          {msg.text}
                        </div>
                      </div>
                    ) : msg.payload.type === 'clarifying' ? (
                      /* AI clarifying questions */
                      <div className="flex gap-3">
                        <span className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-base flex-shrink-0 mt-0.5">✨</span>
                        <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 max-w-sm">
                          <p className="text-slate-200 text-sm leading-relaxed">{msg.payload.message}</p>
                          {msg.payload.questions.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {msg.payload.questions.map((q, qi) => (
                                <li key={qi} className="text-indigo-300 text-sm flex gap-2">
                                  <span className="text-indigo-500">•</span> {q}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* AI recommendation */
                      <div className="flex gap-3">
                        <span className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-base flex-shrink-0 mt-0.5">✨</span>
                        <div className="flex-1">
                          <RecommendationCard rec={msg.payload as AIRec} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading indicator */}
                {aiLoading && (
                  <div className="flex gap-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-base flex-shrink-0">✨</span>
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex items-center gap-2">
                        <svg className="animate-spin w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        <span className="text-indigo-300 text-sm">{aiStatus}</span>
                      </div>
                    </div>
                  </div>
                )}

                {aiError && (
                  <p className="text-sm text-red-400 text-center">{aiError}</p>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Input bar or sign-in CTA */}
              {atMessageLimit ? (
                <div className="px-6 py-5 border-t border-white/10 bg-black/20 text-center">
                  <p className="text-slate-300 text-sm mb-3">
                    You&apos;ve used your {ANON_MESSAGE_LIMIT} free messages.
                  </p>
                  <button
                    onClick={signInWithGoogle}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google to continue →
                  </button>
                </div>
              ) : (
                <div className="px-6 py-4 border-t border-white/10 bg-black/20">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      disabled={aiLoading}
                      placeholder={chatMessages.length === 0 ? 'e.g. I want to fly business class to Tokyo…' : 'Reply or ask a follow-up…'}
                      className="flex-1 bg-white/10 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={aiLoading || !chatInput.trim()}
                      className="bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white text-sm font-medium px-5 rounded-full transition-colors flex-shrink-0"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  )
}
