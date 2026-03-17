'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { trackEvent } from '@/lib/analytics'
import { REGIONS, type Region } from '@/lib/regions'
import { readLocalBalanceCache, writeLocalBalanceCache } from '@/lib/local-balance-cache'
import { extractJsonObject } from './ai-response'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type Program = {
  id: string
  name: string
  short_name: string
  type: string
  color_hex: string
  geography?: string | null
}

export type RedemptionResult = {
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

export type CalculateResponse = {
  total_cash_value_cents: number | null
  total_optimal_value_cents: number
  value_left_on_table_cents: number | null
  cash_baseline_available: boolean
  results: RedemptionResult[]
}

export type BalanceRow = {
  id: string
  program_id: string
  amount: string
}

export type AILink = { label: string; url: string }

export type AIFlight = {
  airline: string
  cabin: string
  route: string
  points_needed: string
  transfer_chain: string
  notes: string
}

export type AIHotel = {
  name: string
  chain: string
  points_per_night: string
  transfer_chain: string
  notes: string
}

export type AIRec = {
  type: 'recommendation'
  headline: string
  reasoning: string
  flight: AIFlight | null
  hotel: AIHotel | null
  total_summary: string
  steps: string[]
  tip: string
  links: AILink[]
  metadata?: {
    freshness: string
    source: string
    confidence?: 'low' | 'medium' | 'high'
  }
}

export type AIClarify = {
  type: 'clarifying'
  message: string
  questions: string[]
}

export type Preferences = {
  home_airport: string | null
  preferred_cabin: string
  preferred_airlines: string[]
  avoided_airlines: string[]
}

export type ChatMsg =
  | { role: 'user'; text: string }
  | { role: 'ai'; payload: AIRec | AIClarify }

export type GeminiTurn = { role: 'user' | 'model'; parts: [{ text: string }] }

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first'

export type AwardSearchResult = {
  program_slug: string
  program_name: string
  program_color: string
  estimated_miles: number
  estimated_cash_value_cents: number
  cpp_cents: number
  baseline_cpp_cents: number
  cash_value_source: 'modeled_route_fare' | 'static_program_cpp'
  cash_value_confidence: 'low' | 'medium'
  transfer_chain: string | null
  transfer_is_instant: boolean
  points_needed_from_wallet: number
  availability: { date: string; available: boolean; source: 'seats_aero' } | null
  deep_link: { url: string; label: string; note?: string }
  has_real_availability: boolean
  is_reachable: boolean
}

export type AwardNarrative = {
  headline: string
  body: string
  top_pick_slug: string
  warnings: string[]
  booking_tips: string[]
}

export type AwardSearchResponse = {
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

export type AwardParams = {
  origin: string
  destination: string
  start_date: string
  end_date: string
  cabin: CabinClass
  passengers: number
}

export type HotelParams = {
  destination: string
  start_date: string
  end_date: string
  hotel_name: string
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

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

function parsePointsInput(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '')
  if (!digitsOnly) return NaN
  return Number.parseInt(digitsOnly, 10)
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useCalculatorState() {
  const params = useParams()
  const searchParams = useSearchParams()
  const region = (params.region as Region) || 'us'
  const config = REGIONS[region] ?? REGIONS.us
  const { user, preferences, refreshPreferences } = useAuth()

  // ── Core state ──────────────────────────────────────────────
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [rows, setRows] = useState<BalanceRow[]>([{ id: '1', program_id: '', amount: '' }])
  const [result, setResult] = useState<CalculateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [showAllResults, setShowAllResults] = useState(false)
  const [saveToast, setSaveToast] = useState(false)
  
  // Alert banner state
  const [alertEmailInput, setAlertEmailInput] = useState('')
  const [alertBannerDismissed, setAlertBannerDismissed] = useState(false)
  const [alertSubscribed, setAlertSubscribed] = useState(false)
  const [alertBannerLoading, setAlertBannerLoading] = useState(false)
  const [alertBannerError, setAlertBannerError] = useState<string | null>(null)
  
  // Share state
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  // Preferences panel state
  const [prefOpen, setPrefOpen] = useState(false)
  const [prefForm, setPrefForm] = useState<Preferences>({
    home_airport: '',
    preferred_cabin: 'any',
    preferred_airlines: [],
    avoided_airlines: [],
  })
  const [prefInput, setPrefInput] = useState({ preferred: '', avoided: '' })
  const [prefSaving, setPrefSaving] = useState(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [geminiHistory, setGeminiHistory] = useState<GeminiTurn[]>([])
  const [chatInput, setChatInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [messageCount, setMessageCount] = useState(0)
  const [advisorBlockedReason, setAdvisorBlockedReason] = useState<string | null>(null)

  // Award search state
  const initialOrigin = searchParams?.get('origin') || ''
  const initialDestination = searchParams?.get('destination') || ''
  
  const [awardParams, setAwardParams] = useState<AwardParams>({
    origin: initialOrigin, destination: initialDestination, start_date: '', end_date: '',
    cabin: 'business', passengers: 1,
  })
  const [awardLoading, setAwardLoading] = useState(false)
  const [awardResult, setAwardResult] = useState<AwardSearchResponse | null>(null)
  const [awardError, setAwardError] = useState<string | null>(null)
  
  // Hotel search state
  const [hotelParams, setHotelParams] = useState<HotelParams>({
    destination: initialDestination,
    start_date: '',
    end_date: '',
    hotel_name: ''
  })
  
  const [activePanel, setActivePanel] = useState<'redemptions' | 'awards' | 'advisor'>(
    initialOrigin && initialDestination ? 'awards' : 'redemptions'
  )

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null)
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const milestoneFired = useRef<Set<string>>(new Set())
  const lastAdvisorMessage = useRef<string | null>(null)
  const hasAttemptedAutoSearch = useRef(false)

  // ── Derived state ───────────────────────────────────────────
  const byType = useCallback((type: string) => programs.filter(p => p.type === type), [programs])
  
  const enteredBalances = useMemo(() => 
    rows
      .filter(r => r.program_id && r.amount)
      .map(r => ({ program_id: r.program_id, amount: parsePointsInput(r.amount) }))
      .filter(b => b.amount > 0),
    [rows]
  )
  
  const totalTrackedPoints = useMemo(() => 
    enteredBalances.reduce((sum, b) => sum + b.amount, 0),
    [enteredBalances]
  )
  
  const visibleResults = useMemo(() => 
    result ? (showAllResults ? result.results : result.results.slice(0, RESULTS_PREVIEW)) : [],
    [result, showAllResults]
  )
  
  const bestOverall = useMemo(() => 
    result?.results.find(r => r.is_best) ?? result?.results[0] ?? null,
    [result]
  )
  
  const hasCalculatorResult = Boolean(result)
  const canUseAdvisor = Boolean(user) || messageCount < ANON_MESSAGE_LIMIT
  
  const hasBookingPlan = useMemo(() => 
    chatMessages.some((m) => m.role === 'ai' && m.payload.type === 'recommendation') || 
    Boolean(awardResult?.results.some(r => r.is_reachable)),
    [chatMessages, awardResult]
  )
  
  const hasActionableOutput = Boolean(result || awardResult || chatMessages.length > 0 || aiLoading)
  
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
    result && alertProgramIds.length > 0 && !alertBannerDismissed
  )

  const steps = useMemo(() => [
    { label: 'Add balances', done: enteredBalances.length > 0 },
    { label: 'Set goal', done: Boolean(awardParams.destination || awardParams.origin || prefForm.home_airport || chatMessages.length) },
    { label: 'See options', done: Boolean(result || awardResult) },
    { label: 'Book', done: hasBookingPlan },
  ], [enteredBalances.length, awardParams.destination, awardParams.origin, prefForm.home_airport, chatMessages.length, result, awardResult, hasBookingPlan])

  // ── Effects ─────────────────────────────────────────────────

  // Clear balances when region changes
  useEffect(() => {
    setRows([{ id: '1', program_id: '', amount: '' }])
    setResult(null)
    setAwardResult(null)
  }, [region])

  // Load programs for the current region
  useEffect(() => {
    setProgramsLoading(true)
    setPrograms([])
    fetch(`/api/programs?region=${encodeURIComponent(region.toUpperCase())}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load programs (${r.status})`)
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const validPrograms = data.filter((p: Program) => {
            if (!p.geography) return true
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

  // Restore alert-banner dismissed preference
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

  // Set alert email from user
  useEffect(() => {
    if (user?.email && !alertEmailInput) {
      setAlertEmailInput(user.email)
    }
  }, [user, alertEmailInput])

  // Load saved balances
  useEffect(() => {
    if (!user) {
      try {
        const cached = readLocalBalanceCache()
        if (cached) {
          const parsed = cached.balances
          if (Array.isArray(parsed) && parsed.length > 0) {
             setRows(parsed.map((b: { program_id: string; balance: number }, i: number) => ({
               id: String(i + 1),
               program_id: b.program_id,
               amount: String(Math.max(0, Math.round(b.balance))),
             })))
             return
          }
        }
      } catch (e) {
        console.error('Failed to parse local balances:', e)
      }
      setRows([{ id: '1', program_id: '', amount: '' }])
      return
    }

    fetch(`/api/user/balances?region=${encodeURIComponent(region.toUpperCase())}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(r => r.json())
      .then(({ balances }) => {
        if (!balances?.length) {
          setRows([{ id: '1', program_id: '', amount: '' }])
          return
        }
        setRows(balances.map((b: { program_id: string; balance: number }, i: number) => ({
          id: String(i + 1),
          program_id: b.program_id,
          amount: String(Math.max(0, Math.round(b.balance))),
        })))
      })
  }, [user, region])

  useEffect(() => {
    if (user || messageCount < ANON_MESSAGE_LIMIT) {
      setAdvisorBlockedReason(null)
    }
  }, [user, messageCount])

  // Sync preferences form
  useEffect(() => {
    if (preferences) {
      setPrefForm({
        home_airport: preferences.home_airport ?? '',
        preferred_cabin: preferences.preferred_cabin ?? 'any',
        preferred_airlines: preferences.preferred_airlines ?? [],
        avoided_airlines: preferences.avoided_airlines ?? [],
      })
      if (preferences.home_airport) {
        setAwardParams(p => p.origin ? p : { ...p, origin: preferences.home_airport!.toUpperCase() })
      }
    }
  }, [preferences])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatMessages.length > 0 || aiLoading) {
      const container = chatEndRef.current?.parentElement
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
      }
    }
  }, [chatMessages, aiLoading])

  // Track funnel milestones
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

  // ── Actions ─────────────────────────────────────────────────

  const addRow = useCallback(() => {
    trackEvent('calculator_add_row_clicked', { existing_rows: rows.length, region })
    setRows(p => [...p, { id: Date.now().toString(), program_id: '', amount: '' }])
  }, [rows.length, region])

  const removeRow = useCallback((id: string) =>
    setRows(p => p.filter(r => r.id !== id)),
  [])

  const updateRow = useCallback((id: string, field: 'program_id' | 'amount', value: string) =>
    setRows(p => p.map(r => r.id === id ? { ...r, [field]: value } : r)),
  [])

  const saveBalances = useCallback(async (balances: { program_id: string; amount: number }[]) => {
    if (!user) {
      try {
        const toSave = balances.map(b => ({
          program_id: b.program_id,
          balance: b.amount
        }))
        writeLocalBalanceCache(toSave)
        setSaveToast(true)
        setTimeout(() => setSaveToast(false), 3000)
      } catch (e) {
        console.error('Failed to save local balances', e)
      }
      return
    }
    
    await fetch('/api/user/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balances: balances.map(b => ({ program_id: b.program_id, balance: b.amount })) }),
    })
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)
  }, [user])

  const dismissAlertBanner = useCallback(() => {
    setAlertBannerDismissed(true)
    try {
      localStorage.setItem(ALERT_BANNER_DISMISSED_KEY, '1')
    } catch {
      // ignore localStorage failures
    }
  }, [])

  const calculate = useCallback(async () => {
    setCalcError(null)
    setResult(null)
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

    if (balances.length === 0) {
      setCalcError('Select at least one program and enter a balance.')
      trackEvent('calculator_calculate_blocked', { reason: 'no_balances', region })
      return
    }

    const validProgramIds = new Set(programs.map(p => p.id))
    const invalidBalances = balances.filter(b => !validProgramIds.has(b.program_id))
    if (invalidBalances.length > 0) {
      setCalcError('One or more selected programs are invalid. Please refresh and try again.')
      trackEvent('calculator_calculate_blocked', { reason: 'invalid_program_ids', region })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balances }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Calculation failed' }))
        const errorMessage = typeof err.error === 'object' && err.error?.message ? err.error.message : (err.error ?? 'Calculation failed')
        throw new Error(errorMessage)
      }
      const data: CalculateResponse = await res.json()
      setResult(data)
      trackEvent('calculator_calculate_succeeded', {
        results_count: data.results.length,
        top_value_cents: data.total_optimal_value_cents,
        region,
      })

      await saveBalances(balances)
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : 'Calculation failed')
      trackEvent('calculator_calculate_failed', {
        message: e instanceof Error ? e.message : 'calculation_failed',
        region,
      })
    } finally {
      setLoading(false)
    }
  }, [rows, user, region, programs, saveBalances])

  const savePreferences = useCallback(async () => {
    setPrefSaving(true)
    await fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefForm),
    })
    await refreshPreferences()
    setPrefSaving(false)
    setPrefOpen(false)
  }, [prefForm, refreshPreferences])

  const runAwardSearch = useCallback(async () => {
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


    setAwardLoading(true)
    try {
      const res = await fetch('/api/award-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...awardParams, balances }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Search failed' }))
        const errorMessage = typeof err.error === 'object' && err.error?.message ? err.error.message : (err.error ?? 'Search failed')
        throw new Error(errorMessage)
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
  }, [awardParams, rows, region])

  // Auto-run search if coming from the landing page with params
  useEffect(() => {
    if (initialOrigin && initialDestination && !hasAttemptedAutoSearch.current) {
      const timer = setTimeout(() => {
        if (!hasAttemptedAutoSearch.current) {
          hasAttemptedAutoSearch.current = true
          runAwardSearch()
        }
      }, 1000) // Give auth and balances a second to load
      return () => clearTimeout(timer)
    }
  }, [initialOrigin, initialDestination, runAwardSearch])

  const addTag = useCallback((field: 'preferred_airlines' | 'avoided_airlines', inputKey: 'preferred' | 'avoided') => {
    const val = prefInput[inputKey].trim()
    if (!val) return
    setPrefForm(f => ({ ...f, [field]: [...f[field], val] }))
    setPrefInput(p => ({ ...p, [inputKey]: '' }))
  }, [prefInput])

  const removeTag = useCallback((field: 'preferred_airlines' | 'avoided_airlines', idx: number) => {
    setPrefForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }))
  }, [])

  const handleAlertBannerSubscribe = useCallback(async (e: React.FormEvent) => {
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
  }, [alertEmailInput, alertProgramIds, dismissAlertBanner])

  const shareTripSnapshot = useCallback(async () => {
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
  }, [result, awardParams.destination, region])

  const sendMessage = useCallback(async (
    text?: string,
    options?: { bypassAnonLimit?: boolean; countTowardsLimit?: boolean },
  ) => {
    const msg = (text ?? chatInput).trim()
    if (!msg || aiLoading) return

    if (!user && messageCount >= ANON_MESSAGE_LIMIT && !options?.bypassAnonLimit) {
      const blockedMessage = `You’ve used ${ANON_MESSAGE_LIMIT} guest messages. Sign in to keep using the advisor and save your plan.`
      setAdvisorBlockedReason(blockedMessage)
      setAiError(null)
      trackEvent('calculator_ai_anon_limit_reached', {
        limit: ANON_MESSAGE_LIMIT,
        region,
      })
      return
    }
    setActivePanel('advisor')
    setAdvisorBlockedReason(null)
    trackEvent('calculator_ai_message_sent', {
      message_index: messageCount + 1,
      signed_in: Boolean(user),
      preset: Boolean(text),
      region,
    })

    setChatInput('')
    setAiError(null)

    const userMsg: ChatMsg = { role: 'user', text: msg }
    setChatMessages(prev => [...prev, userMsg])

    const namedBalances = rows
      .filter(r => r.program_id && r.amount)
      .map(r => ({
        program_id: r.program_id,
        name: programs.find(p => p.id === r.program_id)?.name ?? r.program_id,
        amount: parsePointsInput(r.amount),
      }))
      .filter(b => b.amount > 0)

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

    lastAdvisorMessage.current = msg
    setAiLoading(true)
    if (options?.countTowardsLimit !== false) {
      setMessageCount(c => c + 1)
    }
    setAiStatus(AI_STATUSES[0])
    let statusIdx = 0
    statusTimer.current = setInterval(() => {
      statusIdx = (statusIdx + 1) % AI_STATUSES.length
      setAiStatus(AI_STATUSES[statusIdx])
    }, 2000)

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

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
      }

      const jsonPayload = extractJsonObject(fullText)
      if (!jsonPayload) throw new Error('Could not parse AI response')
      const data = JSON.parse(jsonPayload) as AIRec | AIClarify | { error: string }

      if ('error' in data) throw new Error(data.error)

      setChatMessages(prev => [...prev, { role: 'ai', payload: data as AIRec | AIClarify }])
      trackEvent('calculator_ai_response_received', {
        response_type: (data as AIRec | AIClarify).type,
        region,
      })

      setGeminiHistory(prev => [
        ...prev,
        { role: 'user', parts: [{ text: msg }] },
        { role: 'model', parts: [{ text: jsonPayload }] },
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
  }, [chatInput, aiLoading, user, messageCount, rows, programs, geminiHistory, result, preferences, region])

  const retryLastMessage = useCallback(() => {
    if (!lastAdvisorMessage.current || aiLoading) return
    void sendMessage(lastAdvisorMessage.current, {
      bypassAnonLimit: true,
      countTowardsLimit: false,
    })
  }, [aiLoading, sendMessage])

  const switchPanel = useCallback((panel: 'redemptions' | 'awards' | 'advisor', source: string) => {
    setActivePanel(panel)
    trackEvent('calculator_panel_changed', { panel, source, region })
    if (panel === 'advisor') {
      trackEvent('advisor_opened', { source, region, hasActionableOutput })
    }
  }, [hasActionableOutput, region])

  // ── Return ──────────────────────────────────────────────────
  return {
    // Region/config
    region,
    config,
    
    // Auth
    user,
    preferences,
    
    // Core state
    programs,
    programsLoading,
    rows,
    result,
    loading,
    calcError,
    showAllResults,
    saveToast,
    
    // Alert state
    alertEmailInput,
    alertBannerDismissed,
    alertSubscribed,
    alertBannerLoading,
    alertBannerError,
    alertProgramIds,
    alertProgramNames,
    showAlertBanner,
    
    // Share state
    shareBusy,
    shareError,
    shareUrl,
    
    // Preferences state
    prefOpen,
    prefForm,
    prefInput,
    prefSaving,
    
    // Chat state
    chatMessages,
    geminiHistory,
    chatInput,
    aiLoading,
    aiStatus,
    aiError,
    messageCount,
    advisorBlockedReason,
    
    // Award state
    awardParams,
    awardLoading,
    awardResult,
    awardError,
    hotelParams,
    activePanel,
    
    // Refs
    chatEndRef,
    
    // Derived
    byType,
    enteredBalances,
    totalTrackedPoints,
    visibleResults,
    bestOverall,
    hasCalculatorResult,
    canUseAdvisor,
    hasBookingPlan,
    hasActionableOutput,
    steps,
    
    // Setters (for direct access in components)
    setResult,
    setShowAllResults,
    setChatInput,
    setChatMessages,
    setGeminiHistory,
    setMessageCount,
    setAwardParams,
    setHotelParams,
    setPrefOpen,
    setPrefForm,
    setPrefInput,
    setAlertEmailInput,
    
    // Actions
    addRow,
    removeRow,
    updateRow,
    calculate,
    savePreferences,
    addTag,
    removeTag,
    runAwardSearch,
    dismissAlertBanner,
    handleAlertBannerSubscribe,
    shareTripSnapshot,
    sendMessage,
    retryLastMessage,
    switchPanel,
  }
}
