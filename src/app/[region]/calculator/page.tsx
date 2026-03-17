'use client'

import React, { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { motion, AnimatePresence } from 'framer-motion'
import { Plane, ArrowRight, Navigation, Calculator, Sparkles, ArrowLeft } from 'lucide-react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import {
  useCalculatorState,
  type CalculateResponse,
  type RedemptionResult,
} from './hooks/use-calculator-state'
import { AwardResults, AIChat, BalanceInputPanel } from './components'
import { type Region } from '@/lib/regions'

type Tool = 'hub' | 'trip' | 'value' | 'ai'

type ProgramValueSummary = {
  programId: string
  programName: string
  programShortName: string
  programColor: string
  points: number
  lowEffortOption: RedemptionResult
  likelyOption: RedemptionResult
  bestOption: RedemptionResult
}

type ValueAnalyzerModel = {
  lowEffortValueCents: number
  likelyValueCents: number
  bestCaseValueCents: number
  upsideFromLowEffortCents: number
  upsideFromLikelyCents: number
  cashBaselineAvailable: boolean
  summaries: ProgramValueSummary[]
  easyWins: ProgramValueSummary[]
  stretchPrograms: ProgramValueSummary[]
  strandedPrograms: ProgramValueSummary[]
}

const SIMPLE_REDEMPTION_CATEGORIES = new Set([
  'cashback',
  'statement_credit',
  'travel_portal',
  'gift_cards',
  'pay_with_points',
])

const QUICK_ROUTES: Record<Region, Array<{ origin: string; dest: string; label: string }>> = {
  us: [
    { origin: 'JFK', dest: 'HND', label: 'Tokyo' },
    { origin: 'SFO', dest: 'LHR', label: 'London' },
    { origin: 'LAX', dest: 'CDG', label: 'Paris' },
    { origin: 'ORD', dest: 'FCO', label: 'Rome' },
  ],
  in: [
    { origin: 'DEL', dest: 'LHR', label: 'London' },
    { origin: 'BOM', dest: 'DXB', label: 'Dubai' },
    { origin: 'BLR', dest: 'SIN', label: 'Singapore' },
    { origin: 'DEL', dest: 'NRT', label: 'Tokyo' },
  ],
}

function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

function getLowEffortOption(options: RedemptionResult[]): RedemptionResult {
  return options.find((option) => option.category === 'cashback' || option.category === 'statement_credit')
    ?? options.find((option) => SIMPLE_REDEMPTION_CATEGORIES.has(option.category))
    ?? options.find((option) => option.category === 'transfer_partner' && (option.is_instant || (option.transfer_time_max_hrs ?? Infinity) <= 24))
    ?? options[0]
}

function getLikelyOption(options: RedemptionResult[]): RedemptionResult {
  const bestOption = options[0]
  if (!bestOption) {
    throw new Error('Expected at least one redemption option')
  }

  if (bestOption.category !== 'transfer_partner') return bestOption

  const nearDirectOption = options.find((option) =>
    SIMPLE_REDEMPTION_CATEGORIES.has(option.category)
    && option.total_value_cents >= bestOption.total_value_cents * 0.85,
  )
  if (nearDirectOption) return nearDirectOption

  const quickTransferOption = options.find((option) =>
    option.category === 'transfer_partner'
    && (option.is_instant || (option.transfer_time_max_hrs ?? Infinity) <= 24),
  )
  if (quickTransferOption) return quickTransferOption

  return getLowEffortOption(options)
}

function buildValueAnalyzerModel(result: CalculateResponse): ValueAnalyzerModel {
  const programs = new Map<string, RedemptionResult[]>()

  for (const option of result.results) {
    const bucket = programs.get(option.from_program.id)
    if (bucket) {
      bucket.push(option)
    } else {
      programs.set(option.from_program.id, [option])
    }
  }

  const summaries = [...programs.entries()].map(([programId, options]) => {
    const rankedOptions = [...options].sort((left, right) => right.total_value_cents - left.total_value_cents)
    const bestOption = rankedOptions[0]
    const lowEffortOption = getLowEffortOption(rankedOptions)
    const likelyOption = getLikelyOption(rankedOptions)

    return {
      programId,
      programName: bestOption.from_program.name,
      programShortName: bestOption.from_program.short_name,
      programColor: bestOption.from_program.color_hex,
      points: bestOption.points_in,
      lowEffortOption,
      likelyOption,
      bestOption,
    }
  }).sort((left, right) => right.bestOption.total_value_cents - left.bestOption.total_value_cents)

  const lowEffortValueCents = summaries.reduce((sum, summary) => sum + summary.lowEffortOption.total_value_cents, 0)
  const likelyValueCents = summaries.reduce((sum, summary) => sum + summary.likelyOption.total_value_cents, 0)
  const bestCaseValueCents = summaries.reduce((sum, summary) => sum + summary.bestOption.total_value_cents, 0)

  const easyWins = summaries.filter((summary) => (
    summary.bestOption.total_value_cents - summary.likelyOption.total_value_cents
  ) <= Math.max(2500, summary.bestOption.total_value_cents * 0.1))

  const stretchPrograms = summaries.filter((summary) =>
    summary.bestOption.category === 'transfer_partner'
    && summary.bestOption.total_value_cents - summary.likelyOption.total_value_cents > 5000,
  )

  const strandedPrograms = summaries.filter((summary) =>
    summary.bestOption.total_value_cents < 10000 || summary.points < 15000,
  )

  return {
    lowEffortValueCents,
    likelyValueCents,
    bestCaseValueCents,
    upsideFromLowEffortCents: bestCaseValueCents - lowEffortValueCents,
    upsideFromLikelyCents: bestCaseValueCents - likelyValueCents,
    cashBaselineAvailable: result.cash_baseline_available,
    summaries,
    easyWins,
    stretchPrograms,
    strandedPrograms,
  }
}

export default function CalculatorPage() {
  const state = useCalculatorState()
  const params = useParams()
  const router = useRouter()
  const region = (params.region as Region) || 'us'
  const { user } = useAuth()
  
  const [activeTool, setActiveTool] = useState<Tool>('hub')

  // Derive empty wallet state
  const hasLoadedPrograms = !state.programsLoading && state.programs.length > 0
  const hasEmptyWallet = hasLoadedPrograms && state.totalTrackedPoints === 0
  const valueAnalysis = useMemo(
    () => (state.result ? buildValueAnalyzerModel(state.result) : null),
    [state.result],
  )

  // Render Hub Selection Screen
  const renderHub = () => (
    <motion.div
      key="hub"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto w-full pt-16 pb-24 pm-shell"
    >
      <div className="text-center mb-16">
        <span className="inline-flex rounded-full border border-pm-accent-border bg-pm-accent-soft px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-pm-accent mb-6 shadow-glow glow-pulse">
          PointsMax Dashboard
        </span>
        <h1 className="pm-display text-[3.15rem] leading-[0.93] sm:text-[4.5rem] tracking-[-0.03em] text-pm-ink-900 drop-shadow-sm">
          How can we maximize your points?
        </h1>
        <p className="mt-5 text-xl text-pm-ink-500 font-medium leading-relaxed tracking-[-0.02em] max-w-2xl mx-auto">
           Select a tool below to analyze your wallet&apos;s value, plan a specific dream trip, or get personalized AI advice.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <button onClick={() => setActiveTool('trip')} className="pm-card p-8 group hover:border-pm-accent-border transition-all duration-300 text-left relative overflow-hidden flex flex-col items-start bg-pm-surface-soft hover:bg-pm-surface shadow-xs hover:shadow-soft border-pm-border">
          <div className="absolute inset-0 bg-gradient-to-br from-pm-accent-glow to-transparent opacity-0 group-hover:opacity-10 transition-opacity" />
          <div className="w-14 h-14 rounded-2xl bg-pm-surface border border-pm-border flex items-center justify-center text-pm-ink-900 group-hover:scale-110 group-hover:bg-pm-accent group-hover:text-pm-bg group-hover:border-pm-accent transition-all duration-300 shadow-sm mb-6">
            <Navigation className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="pm-heading text-2xl mb-3 group-hover:text-pm-accent transition-colors">Trip Planner</h3>
          <p className="text-sm text-pm-ink-500 leading-relaxed max-w-[250px] mb-8">
            Search live award flight availability from your home airport to your destination.
          </p>
          <div className="mt-auto flex items-center gap-2 text-pm-ink-900 font-semibold group-hover:text-pm-accent transition-colors">
            <span>Find Flights</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        <button onClick={() => setActiveTool('value')} className="pm-card p-8 group hover:border-pm-success-border transition-all duration-300 text-left relative overflow-hidden flex flex-col items-start bg-pm-surface-soft hover:bg-pm-surface shadow-xs hover:shadow-soft border-pm-border">
          <div className="absolute inset-0 bg-gradient-to-br from-pm-success-soft to-transparent opacity-0 group-hover:opacity-40 transition-opacity" />
          <div className="w-14 h-14 rounded-2xl bg-pm-surface border border-pm-border flex items-center justify-center text-pm-ink-900 group-hover:scale-110 group-hover:bg-pm-success group-hover:text-pm-bg group-hover:border-pm-success transition-all duration-300 shadow-sm mb-6">
            <Calculator className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="pm-heading text-2xl mb-3 group-hover:text-pm-success transition-colors">Value Analyzer</h3>
          <p className="text-sm text-pm-ink-500 leading-relaxed max-w-[250px] mb-8">
            Calculate the optimal cash value of your entire point portfolio across all programs.
          </p>
          <div className="mt-auto flex items-center gap-2 text-pm-ink-900 font-semibold group-hover:text-pm-success transition-colors">
            <span>Calculate Value</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        <button onClick={() => setActiveTool('ai')} className="pm-card p-8 group hover:border-pm-ink-900 transition-all duration-300 text-left relative overflow-hidden flex flex-col items-start bg-pm-surface-soft hover:bg-pm-surface shadow-xs hover:shadow-soft border-pm-border">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(var(--pm-accent-rgb),0.15)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 rounded-2xl bg-pm-surface border border-pm-border flex items-center justify-center text-pm-ink-900 group-hover:scale-110 group-hover:bg-pm-ink-900 group-hover:text-pm-bg group-hover:border-pm-ink-900 transition-all duration-300 shadow-sm mb-6">
             <Sparkles className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="pm-heading text-2xl mb-3 group-hover:text-pm-ink-900 transition-colors">Points Advisor</h3>
          <p className="text-sm text-pm-ink-500 leading-relaxed max-w-[250px] mb-8">
            Chat with our AI to get bespoke recommendations and step-by-step booking plans.
          </p>
          <div className="mt-auto flex items-center gap-2 text-pm-ink-900 font-semibold">
            <span>Ask Advisor</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      {hasEmptyWallet && (
         <motion.div
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
           className="mt-12 max-w-3xl mx-auto"
         >
           <div className="pm-glass border border-pm-warning-border bg-[rgba(255,180,0,0.05)] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
             <div>
                <h3 className="font-semibold text-pm-ink-900 flex items-center gap-2"><span>⚠️</span> Your Wallet is Empty</h3>
                <p className="text-sm text-pm-ink-700 mt-1 max-w-xl">
                  To get accurate valuations and personalized transfer paths, add your balances to your wallet first.
                </p>
             </div>
             <button 
               onClick={() => router.push(`/${region}/profile`)}
               className="pm-button whitespace-nowrap px-6 py-2 shrink-0 border border-pm-surface pointer-events-auto shadow-soft"
             >
               Go to Wallet →
             </button>
           </div>
         </motion.div>
      )}
    </motion.div>
  )

  // Render Trip Planner Tool
  const renderTripPlanner = () => (
    <motion.div
      key="trip"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4 }}
      className="max-w-6xl mx-auto w-full pt-8 pb-24 pm-shell"
    >
      <button onClick={() => setActiveTool('hub')} className="mb-6 flex items-center gap-2 text-sm font-semibold text-pm-ink-500 hover:text-pm-ink-900 transition-colors group">
         <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
         Back to Dashboard
      </button>

      <div className="flex justify-center relative z-20 mb-8">
         <div className="pm-glass flex items-center gap-3 px-5 py-3 rounded-full border border-pm-border">
            <span className="flex items-center gap-2 text-sm font-semibold text-pm-ink-900">✈️ Flights</span>
            <span className="h-4 w-px bg-pm-border" />
            <span className="text-sm text-pm-ink-500">Hotel awards are still in development.</span>
         </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full shadow-card rounded-[32px] overflow-hidden border border-pm-border bg-pm-surface pm-glass min-h-[400px] mb-8"
      >
        <AwardResults
          awardParams={state.awardParams}
          setAwardParams={state.setAwardParams}
          awardLoading={state.awardLoading}
          awardResult={state.awardResult}
          awardError={state.awardError}
          onSearch={state.runAwardSearch}
          region={region}
        />
      </motion.div>

      <motion.div
         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
         className="w-full"
      >
         <h2 className="text-sm font-semibold uppercase tracking-widest text-pm-accent mb-4">Quick Routes</h2>
         <div className="flex flex-wrap gap-4">
            {QUICK_ROUTES[region].map((route) => (
                <button
                  key={`${route.origin}-${route.dest}`}
                  onClick={() => {
                      state.setAwardParams(prev => ({ ...prev, origin: route.origin, destination: route.dest }))
                  }}
                  className="pm-glass px-5 py-4 flex items-center gap-4 hover:border-pm-accent-border transition-all duration-300 group rounded-2xl overflow-hidden relative"
                >
                   <div className="absolute inset-0 bg-gradient-to-r from-pm-accent-glow to-transparent opacity-0 group-hover:opacity-20 transition-opacity" />
                   <div className="relative z-10 flex items-center gap-3">
                       <div className="flex flex-col text-left">
                           <span className="font-bold text-pm-ink-900 group-hover:text-pm-accent transition-colors">{route.origin}</span>
                       </div>
                       <Plane className="w-4 h-4 text-pm-ink-400 group-hover:translate-x-1 transition-transform" />
                       <div className="flex flex-col text-left">
                           <span className="font-bold text-pm-ink-900 group-hover:text-pm-accent transition-colors">{route.dest}</span>
                       </div>
                   </div>
                   <span className="relative z-10 ml-2 text-xs text-pm-ink-500 bg-pm-surface-soft px-2 py-1 rounded-md border border-pm-border">
                       {route.label}
                   </span>
                </button>
            ))}
         </div>
      </motion.div>
    </motion.div>
  )

  // Render Value Analyzer Tool
  const renderValueAnalyzer = () => (
    <motion.div
      key="value"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto w-full pt-8 pb-24 pm-shell"
    >
      <button onClick={() => setActiveTool('hub')} className="mb-6 flex items-center gap-2 text-sm font-semibold text-pm-ink-500 hover:text-pm-ink-900 transition-colors group">
         <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
         Back to Dashboard
      </button>

      <div className="text-center mb-10 mt-2">
         <h2 className="pm-display text-4xl text-pm-ink-900 tracking-tight">Portfolio Value</h2>
         <p className="text-pm-ink-500 mt-3 text-lg">See the floor, the realistic sweet spot, and the stretch ceiling for your {state.totalTrackedPoints.toLocaleString()} points.</p>
      </div>

      <div className="pm-card p-8 sm:p-10 shadow-card bg-pm-surface-soft border border-pm-border min-h-[300px]">
        {state.loading ? (
             <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-pm-success-border border-t-pm-success animate-spin" />
                <p className="text-pm-ink-700 font-medium tracking-tight">Crunching the numbers across all programs...</p>
             </div>
        ) : valueAnalysis ? (
           <div className="space-y-8 w-full">
             <div className="rounded-[28px] border border-pm-success-border bg-pm-success-soft p-8 shadow-inner relative overflow-hidden">
               <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-pm-success/10 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
               <p className="text-xs font-bold uppercase tracking-widest text-pm-success mb-2">Portfolio Value Range</p>
               <h3 className="pm-display text-4xl sm:text-6xl text-pm-success tracking-tighter drop-shadow-sm">
                 {formatUsdFromCents(valueAnalysis.lowEffortValueCents)} to {formatUsdFromCents(valueAnalysis.bestCaseValueCents)}
               </h3>
               <p className="mt-4 max-w-2xl text-sm sm:text-base text-pm-ink-700">
                 Low-effort value assumes simple cash-like or portal-style use. Best case assumes you pursue the strongest redemption path for each program. Your realistic sweet spot is <span className="font-semibold text-pm-ink-900">{formatUsdFromCents(valueAnalysis.likelyValueCents)}</span>.
               </p>
             </div>

             <div className="grid gap-4 md:grid-cols-4">
               <div className="rounded-[24px] border border-pm-border bg-pm-surface p-5 shadow-sm">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-1">Low Effort</p>
                 <p className="text-3xl font-bold text-pm-ink-900 tracking-tight">{formatUsdFromCents(valueAnalysis.lowEffortValueCents)}</p>
                 <p className="mt-2 text-sm text-pm-ink-500">Cash-like or easy direct redemptions.</p>
               </div>
               <div className="rounded-[24px] border border-pm-border bg-pm-surface p-5 shadow-sm">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-1">Most Likely</p>
                 <p className="text-3xl font-bold text-pm-ink-900 tracking-tight">{formatUsdFromCents(valueAnalysis.likelyValueCents)}</p>
                 <p className="mt-2 text-sm text-pm-ink-500">Reasonable value without chasing every edge case.</p>
               </div>
               <div className="rounded-[24px] border border-pm-success-border bg-pm-success-soft/50 p-5 shadow-sm">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-pm-success mb-1">Best Case</p>
                 <p className="text-3xl font-bold text-pm-success tracking-tight">{formatUsdFromCents(valueAnalysis.bestCaseValueCents)}</p>
                 <p className="mt-2 text-sm text-pm-ink-700">Highest-value path across your wallet.</p>
               </div>
               <div className="rounded-[24px] border border-pm-accent-border bg-pm-accent-soft/40 p-5 shadow-sm">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-pm-accent mb-1">Potential Unlock</p>
                 <p className="text-3xl font-bold text-pm-accent-strong tracking-tight">{formatUsdFromCents(valueAnalysis.upsideFromLowEffortCents)}</p>
                 <p className="mt-2 text-sm text-pm-ink-700">
                   {valueAnalysis.cashBaselineAvailable ? 'Value beyond cash-out style redemptions.' : 'Value beyond the simplest path in each program.'}
                 </p>
               </div>
             </div>

             <div className="grid gap-4 lg:grid-cols-3">
               <div className="rounded-[24px] border border-pm-border bg-pm-surface p-6">
                 <p className="text-xs font-bold uppercase tracking-widest text-pm-ink-500 mb-3">Low-Effort Paths</p>
                 <div className="space-y-3">
                   {valueAnalysis.summaries.slice(0, 3).map((summary) => (
                     <div key={`${summary.programId}-low`} className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                       <div className="flex items-center justify-between gap-3">
                         <span className="font-semibold text-pm-ink-900">{summary.programShortName}</span>
                         <span className="text-sm font-semibold text-pm-ink-900">{formatUsdFromCents(summary.lowEffortOption.total_value_cents)}</span>
                       </div>
                       <p className="mt-1 text-sm text-pm-ink-500">{summary.lowEffortOption.label}</p>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="rounded-[24px] border border-pm-border bg-pm-surface p-6">
                 <p className="text-xs font-bold uppercase tracking-widest text-pm-ink-500 mb-3">Likely Sweet Spots</p>
                 <div className="space-y-3">
                   {valueAnalysis.summaries.slice(0, 3).map((summary) => (
                     <div key={`${summary.programId}-likely`} className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                       <div className="flex items-center justify-between gap-3">
                         <span className="font-semibold text-pm-ink-900">{summary.programShortName}</span>
                         <span className="text-sm font-semibold text-pm-ink-900">{formatUsdFromCents(summary.likelyOption.total_value_cents)}</span>
                       </div>
                       <p className="mt-1 text-sm text-pm-ink-500">{summary.likelyOption.label}</p>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="rounded-[24px] border border-pm-accent-border bg-pm-accent-soft/20 p-6">
                 <p className="text-xs font-bold uppercase tracking-widest text-pm-accent mb-3">Stretch Ceiling</p>
                 <div className="space-y-3">
                   {valueAnalysis.summaries.slice(0, 3).map((summary) => (
                     <div key={`${summary.programId}-best`} className="rounded-2xl border border-pm-accent-border/40 bg-pm-surface px-4 py-3">
                       <div className="flex items-center justify-between gap-3">
                         <span className="font-semibold text-pm-ink-900">{summary.programShortName}</span>
                         <span className="text-sm font-semibold text-pm-accent-strong">{formatUsdFromCents(summary.bestOption.total_value_cents)}</span>
                       </div>
                       <p className="mt-1 text-sm text-pm-ink-500">{summary.bestOption.label}</p>
                     </div>
                   ))}
                 </div>
               </div>
             </div>

             <div className="rounded-[28px] border border-pm-border bg-pm-surface p-6 sm:p-8">
               <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                 <div>
                   <p className="text-xs font-bold uppercase tracking-widest text-pm-ink-500 mb-2">Program-by-Program Breakdown</p>
                   <h4 className="text-2xl font-bold text-pm-ink-900">Where your wallet is carrying the most value</h4>
                 </div>
                 <p className="text-sm text-pm-ink-500">Each program shows your floor, realistic value, and stretch ceiling.</p>
               </div>

               <div className="mt-6 space-y-4">
                 {valueAnalysis.summaries.map((summary) => (
                   <div key={summary.programId} className="rounded-[24px] border border-pm-border bg-pm-surface-soft p-5">
                     <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                       <div>
                         <div className="flex items-center gap-3">
                           <span
                             className="h-3 w-3 rounded-full border border-white/50"
                             style={{ backgroundColor: summary.programColor }}
                           />
                           <h5 className="text-lg font-bold text-pm-ink-900">{summary.programName}</h5>
                           <span className="text-sm text-pm-ink-500">{summary.points.toLocaleString()} pts</span>
                         </div>
                         <p className="mt-2 text-sm text-pm-ink-500">
                           Best current use: {summary.bestOption.label}
                         </p>
                       </div>
                       <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                         <div>
                           <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500">Low Effort</p>
                           <p className="mt-1 text-xl font-bold text-pm-ink-900">{formatUsdFromCents(summary.lowEffortOption.total_value_cents)}</p>
                           <p className="mt-1 text-xs text-pm-ink-500">{summary.lowEffortOption.label}</p>
                         </div>
                         <div>
                           <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500">Likely</p>
                           <p className="mt-1 text-xl font-bold text-pm-ink-900">{formatUsdFromCents(summary.likelyOption.total_value_cents)}</p>
                           <p className="mt-1 text-xs text-pm-ink-500">{summary.likelyOption.label}</p>
                         </div>
                         <div>
                           <p className="text-[10px] font-bold uppercase tracking-widest text-pm-accent">Best Case</p>
                           <p className="mt-1 text-xl font-bold text-pm-accent-strong">{formatUsdFromCents(summary.bestOption.total_value_cents)}</p>
                           <p className="mt-1 text-xs text-pm-ink-500">{summary.bestOption.label}</p>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             <div className="grid gap-4 lg:grid-cols-3">
               <div className="rounded-[24px] border border-pm-border bg-pm-surface p-6">
                 <p className="text-xs font-bold uppercase tracking-widest text-pm-ink-500 mb-3">Easy Wins Now</p>
                 <div className="space-y-3">
                   {valueAnalysis.easyWins.length > 0 ? valueAnalysis.easyWins.slice(0, 3).map((summary) => (
                     <div key={`${summary.programId}-easy`} className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                       <p className="font-semibold text-pm-ink-900">{summary.programShortName}</p>
                       <p className="mt-1 text-sm text-pm-ink-500">
                         You are already close to best-case value with {summary.likelyOption.label}.
                       </p>
                     </div>
                   )) : (
                     <p className="text-sm text-pm-ink-500">No obvious easy wins yet. This wallet likely needs a bit more planning to extract full value.</p>
                   )}
                 </div>
               </div>

               <div className="rounded-[24px] border border-pm-accent-border bg-pm-accent-soft/20 p-6">
                 <p className="text-xs font-bold uppercase tracking-widest text-pm-accent mb-3">High-Upside But Harder</p>
                 <div className="space-y-3">
                   {valueAnalysis.stretchPrograms.length > 0 ? valueAnalysis.stretchPrograms.slice(0, 3).map((summary) => (
                     <div key={`${summary.programId}-stretch`} className="rounded-2xl border border-pm-accent-border/40 bg-pm-surface px-4 py-3">
                       <p className="font-semibold text-pm-ink-900">{summary.programShortName}</p>
                       <p className="mt-1 text-sm text-pm-ink-500">
                         {summary.bestOption.label} adds {formatUsdFromCents(summary.bestOption.total_value_cents - summary.likelyOption.total_value_cents)} beyond your likely path.
                       </p>
                     </div>
                   )) : (
                     <p className="text-sm text-pm-ink-500">Your current wallet does not have big transfer-driven gaps right now.</p>
                   )}
                 </div>
               </div>

               <div className="rounded-[24px] border border-pm-border bg-pm-surface p-6">
                 <p className="text-xs font-bold uppercase tracking-widest text-pm-ink-500 mb-3">Smaller or Stranded Balances</p>
                 <div className="space-y-3">
                   {valueAnalysis.strandedPrograms.length > 0 ? valueAnalysis.strandedPrograms.slice(0, 3).map((summary) => (
                     <div key={`${summary.programId}-stranded`} className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                       <p className="font-semibold text-pm-ink-900">{summary.programShortName}</p>
                       <p className="mt-1 text-sm text-pm-ink-500">
                         {summary.points.toLocaleString()} points currently map to {formatUsdFromCents(summary.bestOption.total_value_cents)} at best.
                       </p>
                     </div>
                   )) : (
                     <p className="text-sm text-pm-ink-500">None of your balances look especially stranded right now.</p>
                   )}
                 </div>
               </div>
             </div>

             <div className="flex flex-col gap-3 sm:flex-row">
               <button onClick={() => state.setResult(null)} className="pm-button-secondary w-full sm:w-auto">Reset Calculation</button>
               <button onClick={() => state.calculate()} className="pm-button w-full sm:w-auto">Refresh Analysis</button>
             </div>
           </div>
        ) : (
           <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
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

             <div className="rounded-[28px] border border-pm-border bg-pm-surface p-6 sm:p-8 flex flex-col justify-between">
               <div>
                 <div className="w-16 h-16 bg-pm-surface-soft rounded-full shadow-sm flex items-center justify-center border border-pm-border text-pm-success mb-5">
                   <Calculator className="w-8 h-8" />
                 </div>
                 <h3 className="text-2xl font-bold text-pm-ink-900 tracking-tight">Analyze what your points are actually worth</h3>
                 <p className="text-pm-ink-600 mt-3 leading-relaxed">
                   Add one or more balances here, then we&apos;ll show your low-effort floor, realistic value, and best-case upside.
                 </p>
                 <div className="mt-5 rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                   <p className="text-xs font-bold uppercase tracking-widest text-pm-ink-500">Current Wallet Input</p>
                   <p className="mt-2 text-3xl font-bold text-pm-ink-900">{state.totalTrackedPoints.toLocaleString()} pts</p>
                   <p className="mt-1 text-sm text-pm-ink-500">
                     {state.enteredBalances.length > 0
                       ? `${state.enteredBalances.length} program${state.enteredBalances.length === 1 ? '' : 's'} ready to analyze`
                       : 'No balances entered yet'}
                   </p>
                 </div>
               </div>

               <div className="mt-6 flex flex-col gap-3">
                 <button 
                    onClick={() => state.calculate()} 
                    className="pm-button px-8 py-3.5 text-lg bg-pm-success hover:bg-green-600 border-none shadow-sm hover:shadow-glow text-white w-full inline-flex items-center justify-center gap-2"
                 >
                    <Calculator className="w-5 h-5" /> Calculate Portfolio Value
                 </button>
                 <button
                   onClick={() => router.push(`/${region}/profile`)}
                   className="pm-button-secondary w-full"
                 >
                   {user ? 'Manage balances in Wallet' : 'Open Wallet'}
                 </button>
               </div>
             </div>
           </div>
        )}
      </div>
    </motion.div>
  )

  // Render AI Advisor Tool
  const renderAIAdvisor = () => (
    <motion.div
      key="ai"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto w-full pt-8 pb-24 pm-shell"
    >
      <button onClick={() => setActiveTool('hub')} className="mb-6 flex items-center gap-2 text-sm font-semibold text-pm-ink-500 hover:text-pm-ink-900 transition-colors group">
         <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
         Back to Dashboard
      </button>

      <div className="shadow-card rounded-[32px] overflow-hidden border border-pm-accent-border bg-pm-surface-soft pm-glass flex flex-col min-h-[600px] mt-2">
         <div className="bg-pm-surface-soft border-b border-pm-accent-border/40 px-8 py-6 shrink-0 flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-pm-ink-900 text-pm-bg flex items-center justify-center shadow-md">
             <Sparkles className="w-7 h-7" />
           </div>
           <div>
             <h3 className="pm-display text-[1.75rem] leading-none text-pm-ink-900 tracking-tight">Booking Advisor</h3>
             <p className="text-sm font-medium text-pm-ink-500 mt-1.5 flex items-center gap-2">
               <span>Powered by PointsMax AI</span>
             </p>
           </div>
         </div>
         <div className="flex-1">
           <AIChat
              chatMessages={state.chatMessages}
              chatInput={state.chatInput}
              aiLoading={state.aiLoading}
              aiStatus={state.aiStatus}
              aiError={state.aiError}
              blockedReason={state.advisorBlockedReason}
              canUseAdvisor={state.canUseAdvisor}
              hasCalculatorResult={true} // Override to true since it's a dedicated view
              result={state.result}
              user={user}
              chatEndRef={state.chatEndRef}
              onChatInputChange={state.setChatInput}
              onSendMessage={state.sendMessage}
              onRetryLastMessage={state.retryLastMessage}
              onClearChat={() => { state.setChatMessages([]); state.setGeminiHistory([]); state.setMessageCount(0) }}
              onSwitchPanel={() => {}} 
            />
         </div>
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-pm-bg overflow-x-hidden">
      <NavBar />
      <main className="flex-1 relative z-20 flex flex-col mt-[var(--navbar-height)]">
        <AnimatePresence mode="wait">
          {activeTool === 'hub' && renderHub()}
          {activeTool === 'trip' && renderTripPlanner()}
          {activeTool === 'value' && renderValueAnalyzer()}
          {activeTool === 'ai' && renderAIAdvisor()}
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
