'use client'

import Image from 'next/image'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Sparkles, ChevronLeft, Loader2, ArrowLeft } from 'lucide-react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { CompareGrid } from '@/components/ui/compare/CompareGrid'
import { WinnerBar } from '@/components/ui/compare/WinnerBar'
import type { CardWithRates, SpendCategory } from '@/types/database'
import type { CardComparePayload } from '@/features/card-recommender'
import {
  formatCurrencyRounded,
  getCategoriesForRegion,
  spendInputPrefix,
  CARD_ART_MAP,
} from '@/lib/card-tools'
import { REGIONS, type Region } from '@/lib/regions'
import { openAffiliateLink } from '@/lib/affiliate-client'
import { getCanonicalCardSlug, getSafeExternalUrl } from '@/lib/card-surfaces'
import { readLocalBalanceCache } from '@/lib/local-balance-cache'
import { buildCardComparePayloads } from '@/lib/card-compare'
import {
  useCardScorer,
  useSpendOnlyRanking,
  getWalletStrategy,
  TRAVEL_GOALS,
  type RecommendationMode,
  type AnnualFeeTolerance,
  type WalletStrategy,
} from '@/features/card-recommender'

type SpendInputs = Partial<Record<SpendCategory, string>>
type WalletBalanceSummary = {
  program_id: string
  balance: number
  source: 'manual' | 'connector'
  as_of: string | null
  synergy_status: string | null
  is_stale: boolean
  connected_account_id: string | null
}

type WalletCacheNotice = {
  state: 'cached' | 'stale'
  cachedAt: string | null
} | null

const FallbackCard = ({ name, type }: { name: string, type: string }) => {
  // Generate consistent hues based on characters and length
  const hue1 = (name.length * 15) % 360
  const hue2 = (name.charCodeAt(0) * 20) % 360
  
  return (
    <div 
      className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-sm border border-white/20 p-5 flex flex-col justify-between"
      style={{ background: `linear-gradient(135deg, hsl(${hue1}, 70%, 25%), hsl(${hue2}, 80%, 15%))` }}
    >
      {/* Gloss overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
      
      <div className="flex justify-between items-start relative z-10 w-full">
         {/* EMV Chip */}
         <div className="w-10 h-8 rounded bg-gradient-to-br from-amber-200 to-yellow-600 border border-amber-800/50 opacity-90 relative overflow-hidden flex flex-col justify-evenly px-1 shadow-sm">
             <div className="w-full h-[1px] bg-amber-900/40" />
             <div className="w-full h-[1px] bg-amber-900/40" />
             <div className="w-full h-[1px] bg-amber-900/40" />
         </div>
         <span className="text-white/60 text-[10px] uppercase tracking-widest font-bold">{type}</span>
      </div>
      
      <div className="relative z-10 w-full">
         <p className="text-white/95 font-bold tracking-widest text-lg drop-shadow-md leading-tight">{name}</p>
      </div>
    </div>
  )
}

function toWalletBalanceSummaries(
  balances: Array<{ program_id: string; balance: number }>,
  asOf: string | null,
  isStale: boolean,
): WalletBalanceSummary[] {
  return balances.map((balance) => ({
    program_id: balance.program_id,
    balance: balance.balance,
    source: 'manual',
    as_of: asOf,
    synergy_status: null,
    is_stale: isStale,
    connected_account_id: null,
  }))
}

export default function CardRecommenderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const regionCode = (params.region as Region) || 'us'
  const config = REGIONS[regionCode]
  const reduceMotion = useReducedMotion()
  
  const initialView = searchParams.get('view') === 'earnings' ? 'earnings' : 'strategy'

  // Wizard State
  const [step, setStep] = useState(0)
  /*
    0: Intro
    1: Goals
    2: Spend
    3: Guidelines (Fee & 5/24)
    4: Owned Cards
    5: Analyzing...
    6: Reveal
  */

  const [cards, setCards] = useState<CardWithRates[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  
  // Recommender Inputs
  const [spend, setSpend] = useState<SpendInputs>(config.defaultSpend as SpendInputs)
  const [travelGoals, setTravelGoals] = useState<Set<string>>(new Set())
  const [ownedCards, setOwnedCards] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<RecommendationMode>('next_best_card')
  const [annualFeeTolerance, setAnnualFeeTolerance] = useState<AnnualFeeTolerance>('medium')
  const [recentOpenAccounts24m, setRecentOpenAccounts24m] = useState('0')
  
  const [walletBalances, setWalletBalances] = useState<WalletBalanceSummary[]>([])
  const [walletCacheNotice, setWalletCacheNotice] = useState<WalletCacheNotice>(null)
  const [activeView, setActiveView] = useState<'strategy' | 'earnings'>(initialView)
  const [redirectingCardId, setRedirectingCardId] = useState<string | null>(null)

  const categories = getCategoriesForRegion(regionCode)
  const spendPrefix = spendInputPrefix(config.currency)

  useEffect(() => {
    setSpend(config.defaultSpend as SpendInputs)
  }, [config.defaultSpend])

  useEffect(() => {
    const nextView = searchParams.get('view') === 'earnings' ? 'earnings' : 'strategy'
    setActiveView(nextView)
    if (nextView === 'earnings') {
      setMode('long_term_value')
      setStep(6) // skip wizard
    }
  }, [searchParams])

  useEffect(() => {
    fetch(`/api/cards?geography=${encodeURIComponent(regionCode.toUpperCase())}`)
      .then(async r => {
        if (!r.ok) throw new Error(`Failed to load cards (${r.status})`)
        return r.json()
      })
      .then(({ cards: data }) => {
        setCards(data ?? [])
        setLoading(false)
      })
      .catch(() => {
        setCards([])
        setLoadError('Server error while loading card data. Please try again.')
        setLoading(false)
      })
  }, [regionCode])

  useEffect(() => {
    fetch(`/api/user/balances?region=${encodeURIComponent(regionCode.toUpperCase())}`)
      .then(async response => {
        if (!response.ok) return { balances: [] }
        return response.json()
      })
      .then(payload => {
        const balances = Array.isArray(payload.balances) ? payload.balances : []
        if (balances.length > 0) {
          setWalletBalances(balances)
          setWalletCacheNotice(null)
          return
        }

        const cached = readLocalBalanceCache()
        if (cached && !cached.isExpired) {
          setWalletBalances(toWalletBalanceSummaries(cached.balances, cached.cachedAt, false))
          setWalletCacheNotice({ state: 'cached', cachedAt: cached.cachedAt })
          return
        }

        setWalletBalances([])
        setWalletCacheNotice(cached ? { state: 'stale', cachedAt: cached.cachedAt } : null)
      })
      .catch(() => {
        const cached = readLocalBalanceCache()
        if (cached && !cached.isExpired) {
          setWalletBalances(toWalletBalanceSummaries(cached.balances, cached.cachedAt, false))
          setWalletCacheNotice({ state: 'cached', cachedAt: cached.cachedAt })
          return
        }

        setWalletBalances([])
        setWalletCacheNotice(cached ? { state: 'stale', cachedAt: cached.cachedAt } : null)
      })
  }, [regionCode])

  const { all: allResults, visible: visibleResults, blocked: blockedResults } = useCardScorer({
    cards,
    spend,
    travelGoals,
    ownedCards,
    regionCode,
    programGoalMap: config.programGoalMap,
    annualFeeTolerance,
    mode,
    recentOpenAccounts24m: Number.parseInt(recentOpenAccounts24m || '0', 10) || 0,
    walletBalances,
    targetGoalValue: null,
    showResults: step === 6 && activeView === 'strategy',
  })

  const walletStrategy = useMemo<WalletStrategy | null>(() => {
    if (allResults.length === 0) return null
    return getWalletStrategy(allResults, {
      spend,
      travelGoals,
      ownedCards,
      regionCode,
      programGoalMap: config.programGoalMap,
      annualFeeTolerance,
      mode,
      recentOpenAccounts24m: Number.parseInt(recentOpenAccounts24m || '0', 10) || 0,
      walletBalances,
      targetGoalValue: null,
    })
  }, [allResults, spend, travelGoals, ownedCards, regionCode, config.programGoalMap, annualFeeTolerance, mode, recentOpenAccounts24m, walletBalances])

  const spendOnlyResults = useSpendOnlyRanking({
    cards,
    spend,
    regionCode,
    enabled: activeView === 'earnings',
    limit: 5,
  })

  const runAnalysis = () => {
    setStep(5)
    setTimeout(() => {
      setStep(6)
    }, 2800)
  }

  const handleApplyClick = async (card: CardWithRates, rank: number, firstYearValue: number) => {
    const fallbackUrl = getSafeExternalUrl(card.apply_url)
    if (!fallbackUrl) return
    setRedirectingCardId(card.id)
    try {
      await openAffiliateLink({
        card,
        sourcePage: 'card-recommender',
        rank,
        region: regionCode,
        recommendationMode: mode,
        firstYearValue,
      })
    } finally {
      setRedirectingCardId(null)
    }
  }

  // WIZARD RENDERING
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div key="step-0" className="w-full flex-col items-center">
            {/* Scrollytelling Hero Area */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}
              className="min-h-[80vh] flex flex-col items-center justify-center text-center relative px-4"
            >
              {/* Background ambient glow matching Flow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pm-accent-glow rounded-full blur-[120px] pointer-events-none opacity-50" />
              
              <span className="inline-flex items-center gap-2 rounded-full border border-pm-accent-border bg-pm-surface/80 pm-glass px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-pm-accent mb-8 z-10 shadow-glow">
                <Sparkles className="w-3 h-3" /> Intelligent Recommendation Engine
              </span>
              <h1 className="pm-display text-5xl md:text-[6rem] leading-[0.9] mb-8 tracking-tight text-pm-ink-900 drop-shadow-sm z-10">
                Find your perfect wallet.
              </h1>
              <p className="text-xl text-pm-ink-500 mb-12 max-w-2xl mx-auto leading-relaxed z-10">
                Stop guessing. Answer four quick questions and let our algorithm match you with the absolute best credit card strategy for your unique spend and travel goals.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 z-10">
                <button 
                  onClick={() => setStep(1)} 
                  disabled={loading}
                  className="pm-button text-lg px-8 py-4 w-full sm:w-auto flex items-center justify-center gap-2 transform transition-transform hover:scale-105 active:scale-95"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Start the Matcher'} <ArrowRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => { setActiveView('earnings'); setStep(6) }}
                  className="pm-button-secondary text-lg px-8 py-4 w-full sm:w-auto hover:bg-pm-surface hover:border-pm-accent-border"
                >
                  Explore All Cards
                </button>
              </div>
            </motion.div>

            {/* Deep dive sections simulating "depth" */}
            <div className="w-full max-w-6xl mx-auto py-24 space-y-32">
              <motion.div 
                initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }}
                className="flex flex-col md:flex-row items-center gap-12"
              >
                <div className="md:w-1/2 pm-glass p-8 md:p-12 border border-pm-accent-border bg-pm-surface-soft relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-tr from-pm-bg to-pm-accent-glow opacity-30 group-hover:opacity-60 transition-opacity duration-700" />
                   <div className="relative z-10">
                     <h3 className="text-2xl font-bold mb-4">Precision Scoring</h3>
                     <p className="text-pm-ink-500 leading-relaxed text-lg">We don&apos;t just recommend the card with the highest signup bonus. We calculate your exact earning potential across every category, mapping it directly to your stated travel goals.</p>
                   </div>
                </div>
                <div className="md:w-1/2">
                   <div className="text-sm font-semibold uppercase tracking-widest text-pm-accent mb-2">Scoring Lens</div>
                   <h2 className="text-4xl font-bold mb-6">Built for actual travelers.</h2>
                   <p className="text-lg text-pm-ink-500">Traditional sites push cards based on affiliate payouts. We push cards based on math and synergy with the points you already have.</p>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }}
                className="flex flex-col md:flex-row-reverse items-center gap-12"
              >
                <div className="md:w-1/2 pm-glass p-8 md:p-12 border border-pm-accent-border bg-pm-surface-soft relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-tl from-pm-bg to-pm-accent-glow opacity-30 group-hover:opacity-60 transition-opacity duration-700" />
                   <div className="relative z-10">
                     <h3 className="text-2xl font-bold mb-4">Issuer Rules Enforced</h3>
                     <p className="text-pm-ink-500 leading-relaxed text-lg">Tired of getting denied? We automatically filter out cards based on strict rules like Chase 5/24 or anti-churning velocity algorithms, ensuring you only apply for winners.</p>
                   </div>
                </div>
                <div className="md:w-1/2">
                   <div className="text-sm font-semibold uppercase tracking-widest text-pm-accent mb-2">Guardrail Layer</div>
                   <h2 className="text-4xl font-bold mb-6">Smart Constraints.</h2>
                   <p className="text-lg text-pm-ink-500">Tell us what you already hold and how fee-tolerant you are. The engine handles the complex overlapping rules of major issuers instantly.</p>
                </div>
              </motion.div>
            </div>
          </div>
        )

      case 1:
        return (
          <WizardLayout key="step-1" title="What are your travel goals?" subtitle="Select all that apply. We'll score cards higher if they map directly to these redemptions." onNext={() => setStep(2)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              {TRAVEL_GOALS.map(goal => {
                const active = travelGoals.has(goal.key)
                return (
                  <button
                    key={goal.key}
                    onClick={() => setTravelGoals(prev => {
                      const next = new Set(prev)
                      if (next.has(goal.key)) next.delete(goal.key)
                      else next.add(goal.key)
                      return next
                    })}
                    className={`flex items-center justify-between p-5 rounded-[20px] text-left border-2 transition-all duration-200 shadow-sm ${
                      active ? 'border-pm-accent bg-pm-accent-soft/40 shadow-pm-accent/10 translate-y-[-2px]' : 'border-pm-border bg-pm-surface hover:border-pm-accent/40 hover:bg-pm-surface-soft'
                    }`}
                  >
                    <span className={`text-base font-semibold ${active ? 'text-pm-accent-strong' : 'text-pm-ink-900'}`}>{goal.label}</span>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'bg-pm-accent border-pm-accent text-white' : 'border-pm-ink-300'}`}>
                      {active && <Check className="w-4 h-4" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </WizardLayout>
        )

      case 2:
        return (
          <WizardLayout key="step-2" title="Where do you spend the most?" subtitle={`Enter your estimated monthly spend in ${config.currency}. This dictates annual earning potential.`} onNext={() => setStep(3)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
              {categories.map(({ key, label, icon }) => (
                <div key={key} className="relative group">
                  <label className="block text-sm font-semibold text-pm-ink-700 mb-2 uppercase tracking-wider">{icon} {label}</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-pm-ink-500 text-lg font-medium">{spendPrefix}</span>
                    <input
                      type="number"
                      min="0"
                      value={spend[key] ?? ''}
                      onChange={e => setSpend(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-pm-surface border-2 border-pm-border rounded-[16px] pl-10 pr-4 py-4 text-xl font-semibold text-pm-ink-900 transition-all focus:border-pm-accent focus:ring-4 focus:ring-pm-accent/10 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </WizardLayout>
        )

      case 3:
        return (
          <WizardLayout key="step-3" title="Any rules or constraints?" subtitle="We need to know your fee tolerance and recent approval history to filter out cards you won't get approved for." onNext={() => setStep(4)}>
            <div className="space-y-10 mt-8">
              <div>
                <label className="block text-sm font-semibold text-pm-ink-700 mb-4 uppercase tracking-wider">Annual Fee Tolerance</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  {[
                    { value: 'low', label: 'Keep fees low (<$100)' },
                    { value: 'medium', label: 'Balanced ($95 - $250)' },
                    { value: 'high', label: 'Premium is OK ($250+)' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setAnnualFeeTolerance(option.value as AnnualFeeTolerance)}
                      className={`flex-1 p-4 rounded-[16px] text-center border-2 font-semibold transition-all ${
                        annualFeeTolerance === option.value ? 'bg-pm-accent-soft text-pm-accent border-pm-accent shadow-sm translate-y-[-2px]' : 'bg-pm-surface text-pm-ink-700 border-pm-border hover:border-pm-accent/40'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-pm-ink-700 mb-4 uppercase tracking-wider">Cards opened in the last 24 months</label>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    min="0"
                    value={recentOpenAccounts24m}
                    onChange={e => setRecentOpenAccounts24m(e.target.value)}
                    className="w-full bg-pm-surface border-2 border-pm-border rounded-[16px] px-4 py-4 text-xl font-semibold text-pm-ink-900 transition-all focus:border-pm-accent focus:ring-4 focus:ring-pm-accent/10 outline-none"
                    placeholder="0"
                  />
                  <p className="absolute -bottom-6 left-1 text-xs text-pm-ink-500">Crucial for Chase 5/24 & strict issuer rules.</p>
                </div>
              </div>
            </div>
          </WizardLayout>
        )

      case 4:
        return (
          <WizardLayout key="step-4" title="What cards do you already have?" subtitle="Select cards you currently hold. We will exclude them from the top recommendations." onNext={runAnalysis} nextTabLabel="Reveal Match">
            <div className="mt-8">
              <div className="flex flex-wrap gap-2 max-h-[40vh] overflow-y-auto p-2">
                {cards.map(card => {
                  const owned = ownedCards.has(card.id)
                  return (
                    <button
                      key={card.id}
                      onClick={() => setOwnedCards(prev => {
                        const next = new Set(prev)
                        if (next.has(card.id)) next.delete(card.id)
                        else next.add(card.id)
                        return next
                      })}
                      className={`text-sm px-4 py-2.5 rounded-full border-2 transition-all font-medium shadow-sm ${
                        owned
                          ? 'bg-pm-surface-soft text-pm-ink-500 border-pm-border line-through opacity-70 scale-95'
                          : 'bg-pm-surface text-pm-ink-900 border-pm-border hover:border-pm-accent hover:text-pm-accent'
                      }`}
                    >
                      {card.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </WizardLayout>
        )

      case 5:
        return (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[50vh] text-center"
          >
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-pm-accent/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-pm-accent rounded-full border-t-transparent animate-spin"></div>
              <Sparkles className="absolute inset-0 m-auto text-pm-accent w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-3xl font-bold text-pm-ink-900 mb-3 animate-pulse">Running the algorithm...</h2>
            <p className="text-pm-ink-500 text-lg">Checking issuer rules, wallet synergy, and first-year value equations.</p>
          </motion.div>
        )

      case 6:
        return renderResults()
      
      default: return null
    }
  }

  // WRAPPER FOR WIZARD STEPS
  const WizardLayout = ({ title, subtitle, children, onNext, nextTabLabel = "Continue" }: React.PropsWithChildren<{ title: string; subtitle?: string; onNext: () => void; nextTabLabel?: string }>) => (
    <motion.div 
      initial={reduceMotion ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="max-w-5xl mx-auto w-full flex flex-col min-h-[65vh]"
    >
      <button onClick={() => setStep(s => Math.max(0, s - 1))} className="text-sm text-pm-ink-500 hover:text-pm-ink-900 flex items-center gap-1 mb-8 transition-colors shrink-0">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="mb-8 shrink-0">
        <h2 className="text-3xl md:text-5xl font-bold text-pm-ink-900 tracking-tight leading-tight">{title}</h2>
        {subtitle && <p className="text-lg text-pm-ink-500 mt-3">{subtitle}</p>}
      </div>
      <div className="flex-1 min-h-[30vh]">
        {children}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-pm-border pt-8 shrink-0">
        <div className="flex gap-2">
          {[1,2,3,4].map(s => (
            <div key={s} className={`h-2 rounded-full transition-all duration-500 ${s <= step ? 'w-8 bg-pm-accent' : 'w-4 bg-pm-surface-soft border border-pm-border'}`} />
          ))}
        </div>
        <button onClick={onNext} className="pm-button px-8 py-3.5 text-lg flex items-center gap-2 shadow-xl shadow-pm-accent/20">
          {nextTabLabel} <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  )

  const renderResults = () => {
    if (activeView === 'earnings') {
      return (
        <motion.div key="step-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto w-full pb-20">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => { setActiveView('strategy'); setStep(0) }} className="text-sm font-medium text-pm-ink-500 hover:text-pm-ink-900 flex flex-row items-center gap-2">
               <ChevronLeft className="w-4 h-4" /> Start Wizard
            </button>
            <h2 className="text-2xl font-bold text-pm-ink-900">Explore All Cards</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spendOnlyResults.map(({ card, pointsPerYear, netValue }, index) => (
              <div key={card.id} className="pm-card flex flex-col overflow-hidden group hover:border-pm-accent transition-colors">
                 <div className="p-4 bg-pm-surface-soft border-b border-pm-border flex justify-between items-center text-xs">
                   <span className="font-bold text-pm-ink-500 uppercase tracking-widest">Rank #{index + 1}</span>
                   {netValue > 0 ? (
                     <span className="font-bold text-pm-success px-2 py-0.5 bg-pm-success-soft rounded-full border border-pm-success-border">+{formatCurrencyRounded(netValue, card.currency)} Net</span>
                   ) : (
                     <span className="font-bold text-pm-ink-500 px-2 py-0.5 bg-pm-surface-soft rounded-full border border-pm-border">No Net Value</span>
                   )}
                 </div>
                 <div className="p-6 flex flex-col flex-1">
                   <div className="mb-6 w-full max-w-[240px] mx-auto drop-shadow-xl group-hover:-translate-y-2 transition-transform duration-500">
                     {(CARD_ART_MAP[card.name] || card.image_url) ? (
                       <Image src={CARD_ART_MAP[card.name] || card.image_url!} alt={card.name} width={400} height={252} className="w-full h-auto rounded-xl border border-pm-border/50" />
                     ) : (
                       <FallbackCard name={card.name} type={'CREDIT'} />
                     )}
                   </div>
                   <h3 className="font-bold text-lg text-pm-ink-900 text-center mb-1 leading-tight">{card.name}</h3>
                   <p className="text-xs text-pm-ink-500 text-center mb-3">{card.issuer} • {card.program_name}</p>
                   {card.expert_summary && (
                     <p className="text-xs text-pm-ink-600 text-center mb-6 leading-relaxed line-clamp-3">{card.expert_summary.slice(0, 120)}...</p>
                   )}
                   {!card.expert_summary && <div className="mb-6" />}
                   
                   <div className="mt-auto grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-pm-surface-soft p-3 rounded-xl border border-pm-border text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-1">Proj. Rewards</p>
                        <p className="text-sm font-bold text-pm-ink-900">{Math.round(pointsPerYear).toLocaleString()} pts</p>
                      </div>
                      <div className="bg-pm-surface-soft p-3 rounded-xl border border-pm-border text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-1">Annual Fee</p>
                        <p className="text-sm font-bold text-pm-ink-900">{card.annual_fee_usd === 0 ? 'Free' : formatCurrencyRounded(card.annual_fee_usd, card.currency)}</p>
                      </div>
                   </div>
                   
                   {getSafeExternalUrl(card.apply_url) ? (
                      <button
                         onClick={() => handleApplyClick(card, index + 1, netValue)}
                         className="pm-button w-full py-3 shadow-md transition-all hover:-translate-y-1 hover:shadow-pm-accent/20"
                      >
                         Apply Now
                      </button>
                   ) : (
                      <button disabled className="pm-button-secondary opacity-50 w-full py-3 cursor-not-allowed">Offer Link Unavailable</button>
                   )}
                 </div>
              </div>
            ))}
          </div>
        </motion.div>
      )
    }

    const bestMatch = visibleResults[0]
    const runnerUps = visibleResults.slice(1)

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto w-full pb-20 mt-4">
        <div className="flex justify-between items-center mb-10">
           <button onClick={() => setStep(0)} className="text-sm font-medium text-pm-ink-500 hover:text-pm-ink-900 flex flex-row items-center gap-2">
             <ChevronLeft className="w-4 h-4" /> Start Over
           </button>
           <div className="text-right">
              <span className="inline-flex rounded-full border border-pm-accent-border bg-pm-accent-soft px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-pm-accent">
                Algorithm Match
              </span>
           </div>
        </div>

        {loadError && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {loadError}
          </div>
        )}

        {walletCacheNotice && (
          <div className="mb-6 rounded-2xl border border-pm-border bg-pm-surface-soft px-5 py-4 text-sm text-pm-ink-700">
            {walletCacheNotice.state === 'cached'
              ? `Using locally cached balances${walletCacheNotice.cachedAt ? ` from ${new Date(walletCacheNotice.cachedAt).toLocaleDateString('en-US')}` : ''}. Sign in or refresh your wallet to update them.`
              : `Local wallet balances were found${walletCacheNotice.cachedAt ? ` from ${new Date(walletCacheNotice.cachedAt).toLocaleDateString('en-US')}` : ''}, but they are too old to trust for recommendations.`}
          </div>
        )}

        {bestMatch ? (
          <div className="mb-12">
            <div className="rounded-[32px] overflow-hidden shadow-card border border-pm-border bg-pm-surface flex flex-col lg:flex-row relative">
              {/* Left Side: Art & High Level */}
              <div className="lg:w-2/5 bg-gradient-to-br from-pm-surface-soft to-pm-surface p-10 flex flex-col items-center justify-center border-r border-pm-border relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--pm-accent-rgb),0.05)_0%,transparent_100%)]"></div>
                
                <h3 className="text-sm font-bold tracking-widest text-pm-ink-500 uppercase mb-8 z-10 w-full text-center">Your Perfect Match</h3>
                
                <div className="w-full max-w-[320px] drop-shadow-2xl hover:-translate-y-2 transition-transform duration-500 z-10 rounded-[12px] overflow-hidden border border-pm-border/50">
                    <Link href={`/${regionCode}/cards/${getCanonicalCardSlug(bestMatch.card)}`}>
                      {(CARD_ART_MAP[bestMatch.card.name] || bestMatch.card.image_url) ? (
                          <Image src={CARD_ART_MAP[bestMatch.card.name] || bestMatch.card.image_url!} alt={`${bestMatch.card.name} card art`} width={640} height={404} className="w-full h-auto" />
                        ) : (
                          <FallbackCard name={bestMatch.card.name} type={'CREDIT'} />
                        )}
                    </Link>
                </div>
                
                <h2 className="text-3xl font-extrabold text-pm-ink-900 mt-8 mb-2 z-10 text-center balance">{bestMatch.card.name}</h2>
                {bestMatch.card.expert_summary && (
                  <p className="text-sm text-pm-ink-600 text-center mt-2 mb-2 z-10 leading-relaxed max-w-[280px]">{bestMatch.card.expert_summary.slice(0, 150)}...</p>
                )}
                <div className="flex gap-2 z-10">
                   <span className="text-xs font-semibold px-3 py-1 bg-pm-success-soft text-pm-success rounded-full border border-pm-success-border">
                     {bestMatch.confidence.level} confidence
                   </span>
                </div>

                <div className="mt-8 z-10 w-full text-center">
                  <p className="text-xs text-pm-ink-500 uppercase tracking-widest font-semibold mb-1">First Year Value</p>
                  <p className="text-4xl font-extrabold text-pm-success tabular-nums tracking-tight">
                    +{formatCurrencyRounded(bestMatch.firstYearValue, bestMatch.card.currency)}
                  </p>
                </div>
              </div>

              {/* Right Side: Details */}
              <div className="lg:w-3/5 p-8 lg:p-10 flex flex-col">
                <div className="flex-1 space-y-8">
                  
                  {/* Why this card */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-5 h-5 text-pm-accent" />
                      <h4 className="text-lg font-bold text-pm-ink-900">Why this card?</h4>
                    </div>
                    <ul className="space-y-3">
                      {bestMatch.explanation.whyThisCard.map(line => (
                        <li key={line} className="flex gap-3 text-sm text-pm-ink-700 leading-relaxed">
                          <span className="text-pm-accent flex-shrink-0 mt-0.5">•</span> <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Math Breakdown grid (Expandable Math) */}
                  <details className="group mb-4 bg-pm-surface-soft rounded-2xl border border-pm-border overflow-hidden">
                    <summary className="font-bold text-pm-ink-900 flex justify-between items-center p-4 cursor-pointer hover:bg-pm-surface transition-colors focus:outline-none list-none text-sm">
                      <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-pm-accent" /> Show the Math</span>
                      <span className="text-pm-ink-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="grid grid-cols-2 gap-px bg-pm-border p-px">
                       <div className="bg-pm-surface-soft p-4">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-1">Annual Rewards</p>
                         <p className="text-xl font-bold text-pm-ink-900">{formatCurrencyRounded(bestMatch.annualRewardsValue, bestMatch.card.currency)}</p>
                       </div>
                       <div className="bg-pm-surface-soft p-4">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-1">Signup Bonus</p>
                         <p className="text-xl font-bold text-pm-ink-900">{bestMatch.card.signup_bonus_pts > 0 ? formatCurrencyRounded(bestMatch.signupValueEligible, bestMatch.card.currency) : 'None'}</p>
                       </div>
                       <div className="bg-pm-surface-soft p-4">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-1">Synergy Boosts</p>
                         <p className="text-xl font-bold text-pm-accent-strong">{formatCurrencyRounded(bestMatch.breakdown.goalAlignmentBonus + bestMatch.breakdown.walletSynergyBonus, bestMatch.card.currency)}</p>
                       </div>
                       <div className="bg-pm-surface-soft p-4">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-1">Annual Fee</p>
                         <p className="text-xl font-bold text-pm-ink-900 text-red-600/80">-{bestMatch.card.annual_fee_usd === 0 ? 'Free' : formatCurrencyRounded(bestMatch.card.annual_fee_usd, bestMatch.card.currency)}</p>
                       </div>
                    </div>
                  </details>

                  {/* Goal Alignment visual */}
                  {travelGoals.size > 0 && (
                    <div className="pt-2">
                       {bestMatch.goalCount > 0 ? (
                         <div className="flex gap-2 items-center text-sm font-semibold text-pm-success bg-pm-success-soft px-4 py-3 rounded-xl border border-pm-success-border">
                           <Check className="w-5 h-5" /> Excellent alignment with your travel goals
                         </div>
                       ) : (
                         <div className="text-sm font-semibold text-amber-700 bg-amber-50 px-4 py-3 rounded-xl border border-amber-200">
                           Not directly aligned with your selected travel goals
                         </div>
                       )}
                    </div>
                  )}

                  {bestMatch.ecosystemNote && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                      {bestMatch.ecosystemNote}
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-pm-border flex flex-col sm:flex-row gap-4">
                  {getSafeExternalUrl(bestMatch.card.apply_url) ? (
                    <button
                      type="button"
                      onClick={() => handleApplyClick(bestMatch.card, bestMatch.rank, bestMatch.firstYearValue)}
                      disabled={redirectingCardId === bestMatch.card.id}
                      className="pm-button flex-1 py-4 text-lg shadow-xl shadow-pm-accent/20 transition-all hover:-translate-y-1 hover:shadow-pm-accent/30"
                    >
                      {redirectingCardId === bestMatch.card.id ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Apply Now →'}
                    </button>
                  ) : (
                    <button disabled className="pm-button-secondary flex-1 py-4 cursor-not-allowed opacity-50">Offer unavailable</button>
                  )}
                  <Link href={`/${regionCode}/cards/${getCanonicalCardSlug(bestMatch.card)}`} className="pm-button-secondary flex-1 py-4 text-lg text-center bg-pm-surface-soft hover:bg-pm-surface hover:border-pm-accent/40">
                    Read Review
                  </Link>
                  {runnerUps.length > 0 && (
                    <Link
                      href={`/${regionCode}/cards/compare?cards=${[bestMatch.card, ...runnerUps.slice(0, 2).map((entry) => entry.card)].map((card) => getCanonicalCardSlug(card)).join(',')}`}
                      className="pm-button-secondary flex-1 py-4 text-lg text-center bg-pm-surface-soft hover:bg-pm-surface hover:border-pm-accent/40"
                    >
                      Compare
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 px-6">
            <h3 className="text-2xl font-bold text-pm-ink-900 mb-3">No match found</h3>
            <p className="text-pm-ink-500 mb-6">We couldn&apos;t find a card that fits your strict criteria.</p>
            <button onClick={() => setStep(0)} className="pm-button">Try Again</button>
          </div>
        )}

        {/* Compare / Alternatives block */}
        {runnerUps.length > 0 && (() => {
          const compareCandidates = [bestMatch, ...runnerUps].slice(0, 4)
          const compareCards = buildCardComparePayloads(
            compareCandidates.map((entry) => entry.card),
            regionCode,
          ).map((payload, index) => ({
            ...payload,
            rank: compareCandidates[index]?.rank ?? payload.rank,
            quickVerdict: compareCandidates[index]?.explanation.whyThisCard[0] ?? payload.quickVerdict,
          })) as CardComparePayload[]
          const compareHref = `/${regionCode}/cards/compare?cards=${compareCandidates.map((entry) => getCanonicalCardSlug(entry.card)).join(',')}`
          return (
            <div className="mt-16">
              <div className="flex items-center justify-between gap-4 px-2 mb-8">
                <h3 className="text-3xl font-bold text-pm-ink-900">Compare the Contenders</h3>
                <Link href={compareHref} className="pm-button-secondary px-4 py-2 text-sm">
                  Open Full Compare
                </Link>
              </div>
              <WinnerBar cards={compareCards} />
              <CompareGrid
                cards={compareCards}
                region={regionCode}
                sourcePage="card-recommender-compare"
                recommendationMode={mode}
              />
            </div>
          )
        })()}

        {blockedResults.length > 0 && (
          <div className="mt-12 px-6 py-6 bg-pm-surface-soft border border-pm-border rounded-[24px]">
             <h4 className="text-sm font-bold text-pm-ink-900 mb-2">Hidden Cards</h4>
             <p className="text-xs text-pm-ink-500 mb-4">The following cards were highly ranked but blocked by your constraints or issuer rules.</p>
             <div className="flex flex-wrap gap-2">
               {blockedResults.map(r => (
                 <span key={r.card.id} className="text-xs px-3 py-1.5 bg-pm-surface text-pm-ink-500 border border-pm-border rounded-full" title={r.eligibility.reasons.join(', ')}>
                   {r.card.name} (Blocked)
                 </span>
               ))}
             </div>
          </div>
        )}

        {walletStrategy && (
          <div className="mt-10 p-6 bg-gradient-to-br from-pm-accent/5 to-pm-accent/10 rounded-2xl border border-pm-accent/20">
            <h2 className="text-xl font-bold text-pm-ink-900 mb-2">Recommended Card Strategy</h2>
            <p className="text-sm text-pm-ink-500 mb-6">Based on your spending profile, here&apos;s the optimal card setup:</p>

            <div className="space-y-4">
              {/* Workhorse card */}
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-pm-surface rounded-xl border border-pm-border">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-lg" aria-hidden="true">&#128295;</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Workhorse</span>
                    <span className="text-sm font-bold text-pm-ink-900">{walletStrategy.workhorse.card.card.name}</span>
                  </div>
                  <p className="text-xs text-pm-ink-500 mt-0.5">Use for: {walletStrategy.workhorse.useFor}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-pm-accent">{formatCurrencyRounded(walletStrategy.workhorse.card.card.annual_fee_usd, walletStrategy.workhorse.card.card.currency)}/yr</div>
                </div>
              </div>

              {/* Power card */}
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-pm-surface rounded-xl border border-pm-border">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-300 text-lg" aria-hidden="true">&#9889;</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Power Card</span>
                    <span className="text-sm font-bold text-pm-ink-900">{walletStrategy.powerCard.card.card.name}</span>
                  </div>
                  <p className="text-xs text-pm-ink-500 mt-0.5">Use for: {walletStrategy.powerCard.useFor}</p>
                </div>
              </div>

              {/* Premium card (only if user travels frequently) */}
              {walletStrategy.premium && (
                <div className="flex items-center gap-4 p-4 bg-white dark:bg-pm-surface rounded-xl border border-pm-border">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-300 text-lg" aria-hidden="true">&#9992;&#65039;</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">Premium</span>
                      <span className="text-sm font-bold text-pm-ink-900">{walletStrategy.premium.card.card.name}</span>
                    </div>
                    <p className="text-xs text-pm-ink-500 mt-0.5">Use for: {walletStrategy.premium.useFor}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-pm-bg">
      <NavBar />
      <main className="flex-1 flex flex-col p-4 sm:p-8 relative">
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
