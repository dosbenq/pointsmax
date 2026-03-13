'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { motion, AnimatePresence } from 'framer-motion'
import { Plane, ArrowRight, Navigation, Calculator, Sparkles, ArrowLeft } from 'lucide-react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useCalculatorState } from './hooks/use-calculator-state'
import { AwardResults, HotelResults, AIChat } from './components'
import { type Region } from '@/lib/regions'

type Tool = 'hub' | 'trip' | 'value' | 'ai'

export default function CalculatorPage() {
  const state = useCalculatorState()
  const params = useParams()
  const router = useRouter()
  const region = (params.region as Region) || 'us'
  const { user } = useAuth()
  
  const [activeTool, setActiveTool] = useState<Tool>('hub')
  const [activeTab, setActiveTab] = useState<'flights' | 'hotels'>('flights')

  // Derive empty wallet state
  const hasLoadedPrograms = !state.programsLoading && state.programs.length > 0;
  const hasEmptyWallet = hasLoadedPrograms && state.totalTrackedPoints === 0;

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
         <div className="pm-glass flex items-center p-1.5 rounded-full border border-pm-border">
            <button
               onClick={() => setActiveTab('flights')}
               className={`relative px-8 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === 'flights' ? 'text-pm-ink-900 shadow-sm' : 'text-pm-ink-500 hover:text-pm-ink-900'}`}
            >
                {activeTab === 'flights' && (
                   <motion.div layoutId="searchTabBg" className="absolute inset-0 bg-pm-surface rounded-full shadow-soft -z-10" />
                )}
                <span className="flex items-center gap-2">✈️ Flights</span>
            </button>
            <button
               onClick={() => setActiveTab('hotels')}
               className={`relative px-8 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === 'hotels' ? 'text-pm-ink-900 shadow-sm' : 'text-pm-ink-500 hover:text-pm-ink-900'}`}
            >
                {activeTab === 'hotels' && (
                   <motion.div layoutId="searchTabBg" className="absolute inset-0 bg-pm-surface rounded-full shadow-soft -z-10" />
                )}
                <span className="flex items-center gap-2">🏨 Hotels</span>
            </button>
         </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full shadow-card rounded-[32px] overflow-hidden border border-pm-border bg-pm-surface pm-glass min-h-[400px] mb-8"
      >
        {activeTab === 'flights' ? (
            <AwardResults
              awardParams={state.awardParams}
              setAwardParams={state.setAwardParams}
              awardLoading={state.awardLoading}
              awardResult={state.awardResult}
              awardError={state.awardError}
              onSearch={state.runAwardSearch}
              region={region}
            />
        ) : (
            <HotelResults
              hotelParams={state.hotelParams}
              setHotelParams={state.setHotelParams}
            />
        )}
      </motion.div>

      {activeTab === 'flights' && (
        <motion.div
           initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
           className="w-full"
        >
           <h2 className="text-sm font-semibold uppercase tracking-widest text-pm-accent mb-4">Quick Routes</h2>
           <div className="flex flex-wrap gap-4">
              {[
                  { origin: 'JFK', dest: 'HND', label: 'Tokyo' },
                  { origin: 'SFO', dest: 'LHR', label: 'London' },
                  { origin: 'LAX', dest: 'CDG', label: 'Paris' },
                  { origin: 'ORD', dest: 'FCO', label: 'Rome' }
              ].map((route) => (
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
      )}
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
         <p className="text-pm-ink-500 mt-3 text-lg">Calculate the true potential of your {state.totalTrackedPoints.toLocaleString()} points.</p>
      </div>

      <div className="pm-card p-10 max-w-2xl mx-auto text-center flex flex-col items-center justify-center shadow-card bg-pm-surface-soft border border-pm-border min-h-[300px]">
        {state.loading ? (
             <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-pm-success-border border-t-pm-success animate-spin" />
                <p className="text-pm-ink-700 font-medium tracking-tight">Crunching the numbers across all programs...</p>
             </div>
        ) : state.result ? (
           <div className="space-y-8 w-full">
               <div className="bg-pm-success-soft border border-pm-success-border rounded-[24px] p-8 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pm-success/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  <p className="text-xs font-bold uppercase tracking-widest text-pm-success mb-2">Optimal Value</p>
                  <h3 className="pm-display text-6xl text-pm-success tracking-tighter drop-shadow-sm">
                    ${((state.result?.total_optimal_value_cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </h3>
               </div>
               
               {state.result.cash_baseline_available && state.result.total_cash_value_cents && (
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-pm-surface rounded-[24px] p-6 border border-pm-border shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500 mb-1">Cash Baseline</p>
                        <p className="text-3xl font-bold text-pm-ink-900 tracking-tight">${(state.result.total_cash_value_cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                     </div>
                     <div className="bg-pm-accent-soft rounded-[24px] p-6 border border-pm-accent-border shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-pm-accent mb-1">+ Value Unlocked</p>
                        <p className="text-3xl font-bold text-pm-accent-strong tracking-tight">${((state.result.value_left_on_table_cents ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                     </div>
                  </div>
               )}
               <button onClick={() => state.setResult(null)} className="pm-button-secondary mt-4 w-full">Reset Calculation</button>
           </div>
        ) : (
           <div className="space-y-6">
              <div className="w-20 h-20 bg-pm-surface rounded-full shadow-sm flex items-center justify-center mx-auto border border-pm-border text-pm-success mb-6">
                 <Calculator className="w-10 h-10" />
              </div>
              <p className="text-pm-ink-700 font-medium max-w-sm mx-auto mb-2 text-base leading-relaxed">
                 We&apos;ll analyze every point in your wallet against live valuations and partner transfer ratios to find your ultimate portfolio worth.
              </p>
              <button 
                 onClick={() => state.calculate()} 
                 className="pm-button px-8 py-3.5 text-lg bg-pm-success hover:bg-green-600 border-none shadow-sm hover:shadow-glow text-white w-full sm:w-auto mt-4 inline-flex items-center justify-center gap-2"
              >
                 <Calculator className="w-5 h-5" /> Calculate Now
              </button>
              {state.calcError && <p className="text-pm-danger text-sm mt-4 font-medium">{state.calcError}</p>}
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
               <span>Powered by Gemini 1.5 Pro</span>
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

