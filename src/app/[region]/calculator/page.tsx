// ============================================================
// Calculator Page — Refactored (Sprint 18)
// Reduced from 2033 lines to ~400 lines using:
// - useCalculatorState hook for all state management
// - BalanceInputPanel, AwardResults, AIChat components
// ============================================================
/* eslint-disable react-hooks/refs */

'use client'

import React, { useMemo, useRef } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Compass, PlaneTakeoff, WandSparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { trackEvent } from '@/lib/analytics'
import { useCalculatorState } from './hooks/use-calculator-state'
import { BalanceInputPanel, AwardResults, AIChat } from './components'
import { CalculatorActionStrip, useActionStripSlice } from '@/features/calculator-shell'
import { fmtCents, formatCpp } from '@/lib/formatters'

// ─────────────────────────────────────────────
// ALERT WIDGET
// ─────────────────────────────────────────────

interface AlertWidgetProps {
  visible: boolean
  alertEmail: string
  alertLoading: boolean
  alertSubscribed: boolean
  alertError: string | null
  programNames: string[]
  onDismiss: () => void
  onEmailChange: (email: string) => void
  onSubscribe: (e: React.FormEvent) => void
}

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
}: AlertWidgetProps) {
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
// REDEMPTION RESULT CARD
// ─────────────────────────────────────────────

interface RedemptionResult {
  label: string
  category: string
  from_program: { color_hex: string; name: string; short_name: string }
  to_program?: { short_name: string }
  points_in: number
  points_out: number
  cpp_cents: number
  total_value_cents: number
  active_bonus_pct?: number
  is_instant: boolean
  transfer_time_max_hrs?: number
  is_best: boolean
}

function transferTime(r: RedemptionResult): string {
  if (r.category !== 'transfer_partner') return 'Instant'
  if (r.is_instant) return 'Instant'
  const hrs = r.transfer_time_max_hrs ?? 72
  if (hrs <= 2) return '~2 hrs'
  if (hrs <= 48) return '1–2 days'
  return 'Up to 3 days'
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function CalculatorPage() {
  const state = useCalculatorState()
  const reduceMotion = useReducedMotion()
  const { user } = useAuth()
  const { region, config, enteredBalances } = state
  const alertRef = useRef<HTMLDivElement>(null)

  // Action strip slice integration - G1-T2 Refactor
  const actionStripSlice = useActionStripSlice({
    visible: Boolean(state.result),
    region,
    shareBusy: state.shareBusy,
    onBook: () => state.switchPanel('awards', 'action_strip'),
    onShare: state.shareTripSnapshot,
    onAlert: () => {
      alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  })

  const visibleResults = useMemo(() =>
    state.result
      ? (state.showAllResults ? state.result.results : state.result.results.slice(0, 5))
      : [],
    [state.result, state.showAllResults]
  )

  const bestOverall = useMemo(() =>
    state.result?.results.find(r => r.is_best) ?? state.result?.results[0] ?? null,
    [state.result]
  )

  const plannerStages = [
    {
      key: 'redemptions' as const,
      eyebrow: 'Stage 1',
      title: 'Rank the best use of your wallet',
      body: 'Value the balances you already have and surface one best move before the alternatives.',
      icon: Compass,
      cta: enteredBalances.length > 0 ? 'Run ranking' : 'Add balances first',
      action: () => {
        state.switchPanel('redemptions', 'planner_stage_cards')
        if (!state.result && enteredBalances.length > 0) state.calculate()
      },
      disabled: enteredBalances.length === 0,
    },
    {
      key: 'awards' as const,
      eyebrow: 'Stage 2',
      title: 'Verify a real route',
      body: 'Check reachability, transfer paths, and route-specific award options before you commit.',
      icon: PlaneTakeoff,
      cta: 'Open route verification',
      action: () => state.switchPanel('awards', 'planner_stage_cards'),
      disabled: false,
    },
    {
      key: 'advisor' as const,
      eyebrow: 'Stage 3',
      title: 'Turn it into a booking plan',
      body: 'Use the AI advisor once you have a candidate path and want the next step-by-step move.',
      icon: WandSparkles,
      cta: state.result ? 'Open booking plan' : 'Run ranking first',
      action: () => state.switchPanel('advisor', 'planner_stage_cards'),
      disabled: !state.result,
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-[#b6e2f0]/20 bg-[#7ce8dc]/12 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#e2f7fa]/88">
                Planner {config.flag}
              </span>
              <h1 className="mt-5 text-[3.15rem] font-semibold leading-[0.93] tracking-[-0.065em] text-[#f4fbff] sm:text-[4.5rem]">
                Start with your wallet. End with a clear move.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#d8eef4]/88">
                Planner is the flagship flow for using points well: rank the best move, verify the route, and turn the winner into a booking plan before you transfer anything.
              </p>
            </div>

            <div className="pm-hero-frame rounded-[30px] p-5 text-[#f4fbff]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#c7edf4]/82">Decision snapshot</p>
              <div className="mt-4 rounded-[24px] bg-[#f8fbff] px-5 py-5 text-[#0f2747]">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#10243a]/42">Featured planner move</p>
                <p className="mt-3 text-lg font-semibold leading-8 tracking-[-0.03em]">
                  {bestOverall
                    ? bestOverall.label
                    : 'Add your balances and the calculator will surface one featured move before the rest of the results.'}
                </p>
                <div className="mt-5 space-y-3 border-t border-[#10243a]/8 pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#10243a]/54">Projected value</span>
                    <span className="font-semibold">
                      {bestOverall ? fmtCents(bestOverall.total_value_cents, config.currency) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#10243a]/54">Value per point</span>
                    <span className="font-semibold">
                      {bestOverall ? formatCpp(bestOverall.cpp_cents, region) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#10243a]/54">What this does</span>
                    <span className="font-semibold text-right">
                      {bestOverall ? 'Ranks transfer and redemption paths' : 'Surfaces the best move first'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="pm-shell py-8 sm:py-10 space-y-6 flex-1">
        <div className="pm-card p-6">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <p className="pm-section-title mb-2">Planner flow</p>
              <h2 className="pm-heading text-xl">Use Planner in one direction.</h2>
              <p className="mt-2 text-sm leading-7 text-pm-ink-700">
                Start with the wallet you already have. Verify the route before any transfer. Only then use the booking plan to decide what to do next.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {plannerStages.map((stage) => (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={stage.action}
                    disabled={stage.disabled}
                    className={`rounded-[22px] border p-4 text-left transition-colors ${
                      state.activePanel === stage.key
                        ? 'border-pm-accent-border bg-pm-accent-soft'
                        : 'border-pm-border bg-pm-surface hover:border-pm-accent-border'
                    } ${stage.disabled ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-pm-ink-500">{stage.eyebrow}</p>
                        <p className="mt-2 text-sm font-semibold text-pm-ink-900">{stage.title}</p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pm-premium-soft text-pm-ink-900">
                        <stage.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-pm-ink-700">{stage.body}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-pm-border bg-pm-surface-soft p-5">
              <p className="pm-section-title mb-2">Readiness</p>
              <div className="space-y-3">
                {state.steps.map((step, idx) => (
                  <div
                    key={step.label}
                    className={`rounded-[18px] border px-4 py-3 ${
                      step.done
                        ? 'border-pm-accent-border bg-pm-accent-soft'
                        : 'border-pm-border bg-pm-surface'
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-pm-ink-500">Step {idx + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-pm-ink-900">{step.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-6 text-pm-ink-500">
                This page should end in one confident move, not a list of tabs you still need to interpret.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-6">
            <BalanceInputPanel
              programs={state.programs}
              programsLoading={state.programsLoading}
              rows={state.rows}
              totalTrackedPoints={state.totalTrackedPoints}
              saveToast={state.saveToast}
              calcError={state.calcError}
              byType={state.byType}
              onAddRow={state.addRow}
              onRemoveRow={state.removeRow}
              onUpdateRow={state.updateRow}
            />

            {/* Preferences Panel */}
            {user && (
              <div className="pm-card overflow-hidden">
                <button
                  onClick={() => state.setPrefOpen(v => !v)}
                  className="w-full px-5 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-pm-surface-soft transition-colors"
                >
                  <div>
                    <h2 className="pm-heading text-base">2. Travel Preferences</h2>
                    <p className="pm-subtle text-xs mt-0.5">Improve recommendation quality with quick trip preferences.</p>
                  </div>
                  <span className="pm-subtle text-sm">{state.prefOpen ? '▲' : '▼'}</span>
                </button>

                {state.prefOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-4 border-t border-pm-border space-y-4">
                    <div>
                      <label htmlFor="homeAirport" className="pm-label block mb-1.5">Home Airport</label>
                      <input
                        id="homeAirport"
                        type="text"
                        placeholder="e.g. JFK, LAX, ORD"
                        value={state.prefForm.home_airport ?? ''}
                        onChange={(e) => state.setPrefForm(f => ({ ...f, home_airport: e.target.value }))}
                        className="pm-input"
                      />
                    </div>

                    <div>
                      <label htmlFor="prefCabin" className="pm-label block mb-1.5">Preferred Cabin</label>
                      <select
                        id="prefCabin"
                        value={state.prefForm.preferred_cabin}
                        onChange={(e) => state.setPrefForm(f => ({ ...f, preferred_cabin: e.target.value }))}
                        className="pm-input"
                      >
                        <option value="any">Any cabin</option>
                        <option value="economy">Economy</option>
                        <option value="business">Business class</option>
                        <option value="first">First class</option>
                      </select>
                    </div>

                    <div>
                      <label className="pm-label block mb-1.5">Preferred Airlines</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {state.prefForm.preferred_airlines.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-pm-accent-soft text-pm-accent-strong text-xs px-2.5 py-1 rounded-full border border-pm-accent-soft">
                            {a}
                            <button onClick={() => state.removeTag('preferred_airlines', i)} className="hover:text-pm-danger font-bold">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. United, Delta"
                          value={state.prefInput.preferred}
                          onChange={(e) => state.setPrefInput(p => ({ ...p, preferred: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && state.addTag('preferred_airlines', 'preferred')}
                          className="pm-input flex-1"
                        />
                        <button onClick={() => state.addTag('preferred_airlines', 'preferred')} className="pm-button-secondary px-4 py-2 text-sm">Add</button>
                      </div>
                    </div>

                    <div>
                      <label className="pm-label block mb-1.5">Airlines to Avoid</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {state.prefForm.avoided_airlines.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-pm-danger-soft text-pm-danger text-xs px-2.5 py-1 rounded-full border border-pm-danger-border">
                            {a}
                            <button onClick={() => state.removeTag('avoided_airlines', i)} className="hover:text-pm-danger font-bold">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Spirit, Frontier"
                          value={state.prefInput.avoided}
                          onChange={(e) => state.setPrefInput(p => ({ ...p, avoided: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && state.addTag('avoided_airlines', 'avoided')}
                          className="pm-input flex-1"
                        />
                        <button onClick={() => state.addTag('avoided_airlines', 'avoided')} className="pm-button-secondary px-4 py-2 text-sm">Add</button>
                      </div>
                    </div>

                    <button onClick={state.savePreferences} disabled={state.prefSaving} className="pm-button">
                      {state.prefSaving ? 'Saving…' : 'Save Preferences'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Sticky Sidebar */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="pm-card-soft p-5">
                <p className="pm-label mb-2">Run this page when</p>
                <h2 className="pm-heading text-lg">You want one ranked answer before doing anything irreversible.</h2>

                <div className="mt-4 space-y-3">
                  {[
                    ['Add balances', 'Only include points you would actually use for this decision.'],
                    ['Set your route', 'Use Award Flights only if you want the route logic to shape the ranking.'],
                    ['Run value ranking', 'The page should surface one best move first, then the alternatives.'],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-xl border border-pm-border bg-pm-surface px-3.5 py-3">
                      <p className="text-sm font-semibold text-pm-ink-900">{title}</p>
                      <p className="mt-1 text-xs leading-6 text-pm-ink-700">{body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-xl border border-pm-border bg-pm-surface px-3.5 py-3">
                    <p className="text-xs text-pm-ink-500">Tracked programs</p>
                    <p className="text-xl font-bold text-pm-ink-900 mt-0.5">{enteredBalances.length}</p>
                  </div>
                  <div className="rounded-xl border border-pm-border bg-pm-surface px-3.5 py-3">
                    <p className="text-xs text-pm-ink-500">Tracked points</p>
                    <p className="text-xl font-bold text-pm-ink-900 mt-0.5">{state.totalTrackedPoints.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-pm-border bg-pm-surface px-3.5 py-3">
                    <p className="text-xs text-pm-ink-500">Current goal</p>
                    <p className="text-sm font-semibold text-pm-ink-900 mt-0.5">
                      {state.awardParams.origin && state.awardParams.destination
                        ? `${state.awardParams.origin} → ${state.awardParams.destination}`
                        : 'Set in Award Flights tab'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={state.calculate}
                  disabled={state.loading || enteredBalances.length === 0}
                  className="pm-button w-full mt-4"
                >
                  {state.loading ? 'Calculating…' : 'Run calculator'}
                </button>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => state.switchPanel('awards', 'sticky_quick_actions')}
                    className="pm-button-secondary px-2 py-2 text-xs"
                  >
                    Verify route
                  </button>
                  <button
                    onClick={() => state.switchPanel('advisor', 'sticky_quick_actions')}
                    className="pm-button-secondary px-2 py-2 text-xs"
                  >
                    Booking plan
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href={`/${region}/award-search`} className="pm-button-secondary px-2 py-2 text-center text-xs">
                    Standalone search
                  </Link>
                  <Link href={`/${region}/trip-builder`} className="pm-button-secondary px-2 py-2 text-center text-xs">
                    Trip Builder
                  </Link>
                </div>

                {state.result && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button onClick={() => state.switchPanel('redemptions', 'sticky_shortcuts')} className="pm-button-secondary px-2 py-2 text-xs">Value</button>
                    <button onClick={() => state.switchPanel('awards', 'sticky_shortcuts')} className="pm-button-secondary px-2 py-2 text-xs">Route</button>
                    <button onClick={() => state.switchPanel('advisor', 'sticky_shortcuts')} className="pm-button-secondary px-2 py-2 text-xs">Plan</button>
                  </div>
                )}
              </div>

              {bestOverall && (
                <div className="pm-card p-4">
                  <p className="pm-label text-pm-accent">Current top path</p>
                  <p className="text-sm font-semibold text-pm-ink-900 mt-1">{bestOverall.label}</p>
                  <p className="text-xs text-pm-ink-500 mt-1">
                    {bestOverall.points_in.toLocaleString()} pts · {formatCpp(bestOverall.cpp_cents, region)}
                  </p>
                  <p className="text-lg font-bold text-pm-success mt-2">{fmtCents(bestOverall.total_value_cents, config.currencySymbol)}</p>
                  <button
                    onClick={() => {
                      trackEvent('calculator_booking_plan_requested', { source: 'sticky_top_path' })
                      state.sendMessage(`Build me a booking plan for this option: ${bestOverall.label}. Keep it step-by-step and mention transfer timing.`)
                    }}
                    className="pm-button-secondary w-full mt-3 text-sm"
                  >
                    Build booking plan
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Results Section */}
        <div ref={state.resultsRef} className="space-y-4">
          <div className="pm-card p-2">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'redemptions', label: '1. Value', disabled: false },
                { key: 'awards', label: '2. Verify Route', disabled: false },
                { key: 'advisor', label: '3. Booking Plan', disabled: false },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => state.switchPanel(tab.key as 'redemptions' | 'awards' | 'advisor', 'results_tabs')}
                  disabled={tab.disabled}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    state.activePanel === tab.key
                      ? 'bg-pm-accent text-pm-bg'
                      : 'bg-pm-surface-soft text-pm-ink-700 hover:bg-pm-accent-soft/50'
                  } ${tab.disabled ? 'opacity-50 cursor-not-allowed hover:bg-pm-surface-soft' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Redemptions Panel */}
          {state.activePanel === 'redemptions' && (
            state.result ? (
              <div className="space-y-5 sm:space-y-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  <div className="pm-card p-5">
                    <p className="pm-label">Cash Value</p>
                    <p className="text-3xl font-extrabold text-pm-ink-900 mt-2 tabular-nums">{fmtCents(state.result.total_cash_value_cents, config.currencySymbol)}</p>
                    <p className="text-xs text-pm-ink-500 mt-1">If redeemed for cash</p>
                  </div>
                  <div className="rounded-2xl border border-pm-success-border bg-pm-success-soft p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-pm-accent">Best Value</p>
                    <p className="text-3xl font-extrabold text-pm-accent-strong mt-2 tabular-nums">{fmtCents(state.result.total_optimal_value_cents, config.currencySymbol)}</p>
                    <p className="text-xs text-pm-accent-strong mt-1">Optimal redemption path</p>
                  </div>
                  <div className="rounded-2xl border border-pm-success-border bg-pm-success-soft p-5 sm:col-span-2 lg:col-span-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-pm-success">Extra Value</p>
                    <p className="text-3xl font-extrabold text-pm-success mt-2 tabular-nums">{fmtCents(state.result.value_left_on_table_cents, config.currencySymbol)}</p>
                    <p className="text-xs text-pm-success mt-1">vs. simple cash back</p>
                  </div>
                </div>

                <div className="pm-card-soft overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-pm-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="pm-heading text-base">Planner output</h2>
                      <p className="pm-subtle text-xs mt-0.5">Ranked by total value so the best move appears first</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="pm-pill">{state.result.results.length} total</span>
                      <button
                        onClick={state.shareTripSnapshot}
                        disabled={state.shareBusy}
                        className="pm-button-secondary px-3 py-1.5 text-xs"
                      >
                        {state.shareBusy ? 'Sharing…' : 'Share this trip'}
                      </button>
                    </div>
                  </div>
                  {state.shareUrl && (
                    <div className="px-5 sm:px-6 py-2 border-b border-pm-border text-xs text-pm-accent">
                      Share URL copied: <a className="underline" href={state.shareUrl} target="_blank" rel="noreferrer">{state.shareUrl}</a>
                    </div>
                  )}
                  {state.shareError && (
                    <div className="px-5 sm:px-6 py-2 border-b border-pm-danger-border text-xs text-pm-danger bg-pm-danger-soft">
                      {state.shareError}
                    </div>
                  )}

                  <div className="divide-y divide-pm-border">
                    {visibleResults.map((r, i) => (
                      <motion.div
                        key={i}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={reduceMotion ? undefined : { duration: 0.2, delay: i * 0.05 }}
                        className={`px-5 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 transition-colors ${r.is_best ? 'bg-pm-success-soft' : 'hover:bg-pm-surface-soft'}`}
                      >
                        <span className="text-xs text-pm-ink-500 font-mono w-4 flex-shrink-0 text-center">{i + 1}</span>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.from_program.color_hex }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.is_best && <span className="text-xs bg-pm-accent text-pm-bg px-2 py-0.5 rounded-full font-semibold">Best</span>}
                            {r.active_bonus_pct && <span className="text-xs bg-pm-success-soft text-pm-success px-2 py-0.5 rounded-full border border-pm-success-border font-semibold">+{r.active_bonus_pct}% bonus</span>}
                            <span className="text-sm font-medium text-pm-ink-900">{r.label}</span>
                          </div>
                          <p className="text-xs text-pm-ink-500 mt-0.5">
                            {r.points_in.toLocaleString()} pts
                            {r.category === 'transfer_partner' && ` → ${r.points_out.toLocaleString()} ${r.to_program?.short_name ?? ''}`}
                            {' · '}{transferTime(r)}{' · '}{formatCpp(r.cpp_cents, region)}
                          </p>
                        </div>
                        <p className={`text-base font-bold tabular-nums flex-shrink-0 ${r.is_best ? 'text-pm-accent-strong' : 'text-pm-ink-900'}`}>
                          {fmtCents(r.total_value_cents, config.currencySymbol)}
                        </p>
                        <button
                          onClick={() => {
                            trackEvent('calculator_redemption_use_clicked', {
                              label: r.label,
                              points_in: r.points_in,
                              region,
                            })
                            state.sendMessage(`Plan this redemption for me: ${r.label}. I have ${r.points_in.toLocaleString()} points available.`)
                          }}
                          className="pm-button-secondary px-3 py-2 text-xs"
                        >
                          Use this
                        </button>
                      </motion.div>
                    ))}
                  </div>

                  {state.result.results.length > 5 && (
                    <button
                      onClick={() => state.setShowAllResults(v => !v)}
                      className="w-full py-3.5 text-sm text-pm-ink-500 hover:text-pm-ink-900 font-medium border-t border-pm-border hover:bg-pm-surface-soft transition-colors"
                    >
                      {state.showAllResults ? '↑ Show fewer' : `↓ Show all ${state.result.results.length} options`}
                    </button>
                  )}
                </div>

                <CalculatorActionStrip
                  visible={actionStripSlice.state.visible}
                  region={actionStripSlice.state.context.region}
                  shareBusy={actionStripSlice.state.shareBusy}
                  onBook={actionStripSlice.actions.onBook}
                  onShare={actionStripSlice.actions.onShare}
                  onAlert={actionStripSlice.actions.onAlert}
                />

                <div ref={alertRef}>
                  <AlertWidget
                    visible={state.showAlertBanner}
                    alertEmail={state.alertEmailInput}
                    alertLoading={state.alertBannerLoading}
                    alertSubscribed={state.alertSubscribed}
                    alertError={state.alertBannerError}
                    programNames={state.alertProgramNames}
                    onDismiss={state.dismissAlertBanner}
                    onEmailChange={state.setAlertEmailInput}
                    onSubscribe={state.handleAlertBannerSubscribe}
                  />
                </div>
              </div>
            ) : (
              <div className="pm-card-soft p-6 text-center">
                <h3 className="pm-heading text-lg">Run value ranking first</h3>
                <p className="pm-subtle text-sm mt-1 mb-4">Add balances and click &quot;Find Best Redemptions&quot; to unlock this view.</p>
                <button
                  onClick={state.calculate}
                  disabled={state.loading || enteredBalances.length === 0}
                  className="pm-button"
                >
                  {state.loading ? 'Calculating…' : 'Find Best Redemptions'}
                </button>
              </div>
            )
          )}

          {/* Awards Panel */}
          {state.activePanel === 'awards' && (
            <AwardResults
              awardParams={state.awardParams}
              setAwardParams={state.setAwardParams}
              awardLoading={state.awardLoading}
              awardResult={state.awardResult}
              awardError={state.awardError}
              onSearch={state.runAwardSearch}
              region={region}
            />
          )}

          {/* Advisor Panel */}
          {state.activePanel === 'advisor' && (
            <AIChat
              chatMessages={state.chatMessages}
              chatInput={state.chatInput}
              aiLoading={state.aiLoading}
              aiStatus={state.aiStatus}
              aiError={state.aiError}
              canUseAdvisor={state.canUseAdvisor}
              hasCalculatorResult={state.hasCalculatorResult}
              result={state.result}
              user={user}
              chatEndRef={state.chatEndRef}
              onChatInputChange={state.setChatInput}
              onSendMessage={state.sendMessage}
              onClearChat={() => { state.setChatMessages([]); state.setGeminiHistory([]); state.setMessageCount(0) }}
              onSwitchPanel={state.switchPanel}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
