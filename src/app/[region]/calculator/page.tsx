// ============================================================
// Calculator Page — Refactored (Sprint 18)
// Reduced from 2033 lines to ~400 lines using:
// - useCalculatorState hook for all state management
// - BalanceInputPanel, AwardResults, AIChat components
// ============================================================
/* eslint-disable react-hooks/refs */

'use client'

import React, { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { trackEvent } from '@/lib/analytics'
import { useCalculatorState } from './hooks/use-calculator-state'
import { BalanceInputPanel, AwardResults, AIChat } from './components'
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
        {/* Progress Steps */}
        <div className="pm-card p-2 sm:p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {state.steps.map((step, idx) => (
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
                          <span key={i} className="inline-flex items-center gap-1 bg-pm-danger-soft text-pm-danger text-xs px-2.5 py-1 rounded-full border border-pm-danger/20">
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
                <p className="pm-label mb-2">Decision Snapshot</p>
                <h2 className="pm-heading text-lg">What to do next</h2>

                <div className="mt-4 space-y-3">
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
                  {state.loading ? 'Calculating…' : '3. Find Best Redemptions'}
                </button>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => state.switchPanel('awards', 'sticky_quick_actions')}
                    className="pm-button-secondary px-2 py-2 text-xs"
                  >
                    Find award flights
                  </button>
                  <button
                    onClick={() => state.switchPanel('advisor', 'sticky_quick_actions')}
                    className="pm-button-secondary px-2 py-2 text-xs"
                  >
                    Ask AI advisor
                  </button>
                </div>

                {state.result && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button onClick={() => state.switchPanel('redemptions', 'sticky_shortcuts')} className="pm-button-secondary px-2 py-2 text-xs">Redemptions</button>
                    <button onClick={() => state.switchPanel('awards', 'sticky_shortcuts')} className="pm-button-secondary px-2 py-2 text-xs">Award Flights</button>
                    <button onClick={() => state.switchPanel('advisor', 'sticky_shortcuts')} className="pm-button-secondary px-2 py-2 text-xs">AI Advisor</button>
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
                    4. Build booking plan
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
                { key: 'redemptions', label: 'Best Redemptions', disabled: false },
                { key: 'awards', label: 'Award Flights', disabled: false },
                { key: 'advisor', label: 'AI Advisor', disabled: false },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => state.switchPanel(tab.key as 'redemptions' | 'awards' | 'advisor', 'results_tabs')}
                  disabled={tab.disabled}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    state.activePanel === tab.key
                      ? 'bg-pm-accent text-white'
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
                  <div className="rounded-2xl border border-pm-success/30 bg-pm-success/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-pm-accent">Best Value</p>
                    <p className="text-3xl font-extrabold text-pm-accent-strong mt-2 tabular-nums">{fmtCents(state.result.total_optimal_value_cents, config.currencySymbol)}</p>
                    <p className="text-xs text-pm-accent-strong mt-1">Optimal redemption path</p>
                  </div>
                  <div className="rounded-2xl border border-pm-success/30 bg-pm-success/10 p-5 sm:col-span-2 lg:col-span-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-pm-success">Extra Value</p>
                    <p className="text-3xl font-extrabold text-pm-success mt-2 tabular-nums">{fmtCents(state.result.value_left_on_table_cents, config.currencySymbol)}</p>
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
                    <div className="px-5 sm:px-6 py-2 border-b border-pm-danger/20 text-xs text-pm-danger bg-pm-danger-soft">
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
