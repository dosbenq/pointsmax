'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
import { ConnectedWallets } from '@/components/ConnectedWallets'
import { CARD_ART_MAP } from '@/lib/card-tools'
import Image from 'next/image'
import type { Region } from '@/lib/regions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const AIRLINE_OPTIONS = [
  'Aer Lingus', 'Aeromexico', 'Air Canada', 'Air France', 'Air New Zealand',
  'Alaska Airlines', 'All Nippon Airways (ANA)', 'American Airlines', 'Avianca',
  'British Airways', 'Cathay Pacific', 'Delta Air Lines', 'Emirates',
  'Etihad Airways', 'EVA Air', 'Frontier Airlines', 'Hawaiian Airlines',
  'Iberia', 'JetBlue Airways', 'KLM', 'Korean Air', 'LATAM Airlines',
  'Lufthansa', 'Qantas Airways', 'Qatar Airways', 'Singapore Airlines',
  'Southwest Airlines', 'Spirit Airlines', 'SWISS', 'TAP Air Portugal',
  'Turkish Airlines', 'United Airlines', 'Virgin Atlantic'
]

type Preferences = {
  home_airport: string | null
  preferred_cabin: string
  preferred_airlines: string[]
  avoided_airlines: string[]
}

type Program = { id: string; name: string; type: string; geography?: string | null; slug?: string }

type UnifiedBalance = {
  program_id: string
  balance: number
  source: 'manual' | 'connector'
  as_of: string | null
  confidence: 'high' | 'medium' | 'low'
  sync_status: string | null
  is_stale: boolean
  connected_account_id: string | null
}

// Region detection helper - reads from localStorage (set by regional pages)
function getStoredRegion(): Region | null {
  if (typeof window === 'undefined') return null
  try {
    const searchRegion = new URLSearchParams(window.location.search).get('region')
    if (searchRegion === 'us' || searchRegion === 'in') return searchRegion
    const stored = localStorage.getItem('pm_region')
    if (stored === 'us' || stored === 'in') return stored
  } catch {
    // localStorage or URL access failed
  }
  return null
}

// Alert Subscriptions Card
function AlertSubscriptionsCard({ userEmail, region }: { userEmail: string; region: Region }) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState(userEmail)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<'saved' | 'error' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // Region-scoped program fetch - ensures US and India programs are not mixed
    fetch(`/api/programs?region=${encodeURIComponent(region.toUpperCase())}`)
      .then(r => r.json())
      .then((data: Program[]) => {
        const transferable = data.filter((p: Program) => p.type === 'transferable_points')
        setPrograms(transferable)
      })
      .catch(() => setPrograms([]))
      .finally(() => setLoading(false))
  }, [region])

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = async () => {
    if (selectedIds.size === 0) return
    setSaving(true)
    setToast(null)
    try {
      const res = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, program_ids: Array.from(selectedIds) }),
      })
      if (res.ok) {
        setToast('saved')
        setTimeout(() => setToast(null), 3000)
      } else {
        setToast('error')
      }
    } catch {
      setToast('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pm-card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="pm-heading text-base">Transfer Bonus Alerts</h2>
        {toast === 'saved' && (
          <span className="text-xs text-pm-success bg-pm-success-soft border border-pm-success-border px-3 py-1 rounded-full font-medium">
            ✓ Saved
          </span>
        )}
        {toast === 'error' && (
          <span className="text-xs text-pm-danger bg-pm-danger-soft border border-pm-danger-border px-3 py-1 rounded-full font-medium">
            Error — try again
          </span>
        )}
      </div>
      <p className="text-xs text-pm-ink-500 mb-5">Get emailed when a transfer bonus goes live for your programs.</p>

      <div className="space-y-4">
        <div>
          <label className="pm-label block mb-1.5">
            Alert Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="pm-input"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="pm-label">
              Programs to Watch
            </label>
            <span className="text-xs text-pm-ink-500">
              {region === 'in' ? '🇮🇳 India' : '🇺🇸 US'} programs
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {loading && (
              <span className="text-xs text-pm-ink-500">Loading programs…</span>
            )}
            {!loading && programs.map(p => {
              const checked = selectedIds.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    checked
                      ? 'bg-pm-accent text-pm-bg border-pm-accent'
                      : 'bg-pm-surface text-pm-ink-700 border-pm-border hover:border-pm-accent-border'
                  }`}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
          {!loading && programs.length === 0 && (
            <p className="text-xs text-pm-ink-500 mt-2">
              No transferable programs available for your region.
            </p>
          )}
          {!loading && selectedIds.size === 0 && programs.length > 0 && (
            <p className="text-xs text-pm-ink-500 mt-2">
              You&apos;re not watching any programs yet. Set at least one alert to get bonus notifications.
            </p>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving || selectedIds.size === 0}
          className="pm-button"
        >
          {saving ? 'Saving…' : 'Save Alert Preferences'}
        </button>
      </div>
    </div>
  )
}

export function ProfilePageContent({ initialRegion }: { initialRegion?: Region }) {
  const { user, userRecord, loading, signInWithGoogle, signOut, refreshPreferences } = useAuth()
  const router = useRouter()
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)

  const [prefForm, setPrefForm] = useState<Preferences>({
    home_airport: '',
    preferred_cabin: 'any',
    preferred_airlines: [],
    avoided_airlines: [],
  })
  const [prefInput, setPrefInput] = useState({ preferred: '', avoided: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [billingLoading, setBillingLoading] = useState<'checkout' | 'portal' | null>(null)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  
  const [balances, setBalances] = useState<UnifiedBalance[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  
  // Manual Balance State
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualProgramId, setManualProgramId] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  
  // Region state - prefers explicit query parameter, then falls back to persisted selection.
  const [region, setRegion] = useState<Region>(initialRegion ?? 'us')
  
  // Fetch programs and balances
  useEffect(() => {
    // Always fetch programs
    fetch(`/api/programs?region=${encodeURIComponent(region.toUpperCase())}`)
      .then(r => r.json())
      .then(progs => setPrograms(Array.isArray(progs) ? progs : []))
      .catch(console.error)

    if (user) {
      // Logged in: fetch synced balances
      fetch(`/api/user/balances?region=${encodeURIComponent(region.toUpperCase())}`)
        .then(r => r.json())
        .then(bals => setBalances(bals.balances || []))
        .catch(console.error)
    } else {
      // Guest: read local balances
      try {
        const localBalancesRaw = localStorage.getItem('pm_local_balances')
        if (localBalancesRaw) {
          const parsed = JSON.parse(localBalancesRaw)
          // Format them to match UnifiedBalance structure
          // pm_local_balances is an array: [{ program_id: string, balance: number }]
          const formattedBals = (Array.isArray(parsed) ? parsed : []).map((b: any) => ({
            program_id: b.program_id,
            balance: b.balance as number,
            source: 'manual' as const,
            as_of: new Date().toISOString(),
            confidence: 'high' as const,
            sync_status: null,
            is_stale: false,
            connected_account_id: null,
          }))
          setBalances(formattedBals)
        }
      } catch (e) {
        console.error('Failed to parse local balances:', e)
      }
    }
  }, [user, region])
  
  useEffect(() => {
    if (initialRegion) {
      try {
        window.localStorage.setItem('pm_region', initialRegion)
      } catch {
        // Ignore localStorage failures.
      }
      setRegion(initialRegion)
      return
    }
    const detected = getStoredRegion()
    if (detected) {
      setRegion(detected)
      try {
        window.localStorage.setItem('pm_region', detected)
      } catch {
        // Ignore localStorage failures.
      }
    }
  }, [initialRegion])

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false)
      return
    }
    const timeout = window.setTimeout(() => setLoadingTimedOut(true), 4000)
    return () => window.clearTimeout(timeout)
  }, [loading])

  // Auth guard
  useEffect(() => {
    if (!user) return
    fetch('/api/user/preferences')
      .then(r => r.json())
      .then(({ preferences }) => {
        if (preferences) {
          setPrefForm({
            home_airport: preferences.home_airport ?? '',
            preferred_cabin: preferences.preferred_cabin ?? 'any',
            preferred_airlines: preferences.preferred_airlines ?? [],
            avoided_airlines: preferences.avoided_airlines ?? [],
          })
        }
      })
      .catch(() => {
        // Keep wallet page usable even if preferences fail to load.
      })
  }, [user])

  const addTag = (field: 'preferred_airlines' | 'avoided_airlines', inputKey: 'preferred' | 'avoided') => {
    const val = prefInput[inputKey].trim()
    if (!val) return
    // Simple validation against our list (case-insensitive)
    const matchedValidAirline = AIRLINE_OPTIONS.find(a => a.toLowerCase() === val.toLowerCase())
    if (!matchedValidAirline) {
      alert('Please select a valid airline from the drop-down list.')
      return
    }
    
    // Check if already exists based on our state
    if (prefForm[field].includes(matchedValidAirline)) {
       setPrefInput(p => ({ ...p, [inputKey]: '' })) // just clear if it's a dupe
       return
    }

    setPrefForm(f => ({ ...f, [field]: [...f[field], matchedValidAirline] }))
    setPrefInput(p => ({ ...p, [inputKey]: '' }))
  }

  const handleManualAdd = async () => {
    if (!manualProgramId) return alert('Please select a program.')
    const num = parseInt(manualAmount, 10)
    if (isNaN(num) || num < 0) return alert('Please enter a valid amount.')

    setSavingManual(true)
    try {
      // Find the program to get its name/slug for the UI
      const selectedProgram = programs.find(p => p.id === manualProgramId)
      
      if (isGuest) {
        // Save to local storage for guests
        const existingRaw = localStorage.getItem('pm_local_balances')
        let localBalances: any[] = []
        try { localBalances = existingRaw ? JSON.parse(existingRaw) : [] } catch (e) {}
        
        const existingIdx = localBalances.findIndex((b: any) => b.program_id === manualProgramId)
        if (existingIdx >= 0) {
          localBalances[existingIdx].balance = num
        } else {
          localBalances.push({ program_id: manualProgramId, balance: num })
        }
        
        localStorage.setItem('pm_local_balances', JSON.stringify(localBalances))
        
        // Update current state
        setBalances(prev => {
          const next = [...prev]
          const curIdx = next.findIndex(b => b.program_id === manualProgramId)
          if (curIdx >= 0) {
            next[curIdx] = { ...next[curIdx], balance: num, source: 'manual', confidence: 'high', as_of: new Date().toISOString() }
          } else {
            next.push({
              program_id: manualProgramId,
              balance: num,
              source: 'manual',
              as_of: new Date().toISOString(),
              confidence: 'high',
              sync_status: null,
              is_stale: false,
              connected_account_id: null
            })
          }
          return next
        })
      } else {
        // Save to remote DB for authenticated users
        const res = await fetch('/api/user/balances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_id: manualProgramId, balance: num })
        })
        if (!res.ok) {
           const err = await res.json()
           throw new Error(err.error || 'Failed to save balance')
        }
        const updated = await res.json()
        setBalances(updated.balances)
      }
      
      setShowManualEntry(false)
      setManualProgramId('')
      setManualAmount('')
    } catch (e: any) {
      alert(e.message || 'Error saving balance.')
    } finally {
      setSavingManual(false)
    }
  }

  const removeTag = (field: 'preferred_airlines' | 'avoided_airlines', idx: number) => {
    setPrefForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }))
  }

  const savePreferences = async () => {
    setSaving(true)
    await fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefForm),
    })
    await refreshPreferences()
    setSaving(false)
    setToast(true)
    setTimeout(() => setToast(false), 3000)
  }

  const openBillingPortal = async () => {
    setBillingLoading('portal')
    setBillingError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const payload = await res.json()
      if (!res.ok || !payload?.url) {
        throw new Error(payload?.error || 'Unable to open billing portal.')
      }
      window.location.href = payload.url
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Unable to open billing portal.')
    } finally {
      setBillingLoading(null)
    }
  }

  const startCheckout = async () => {
    setBillingLoading('checkout')
    setBillingError(null)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const payload = await res.json()
      if (!res.ok || !payload?.url) {
        throw new Error(payload?.error || 'Unable to start checkout.')
      }
      window.location.href = payload.url
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Unable to start checkout.')
    } finally {
      setBillingLoading(null)
    }
  }

  const deleteAccount = async () => {
    if (deleteConfirm.trim() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm account removal.')
      return
    }

    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Unable to delete account right now.')
      }
      await signOut()
      router.replace('/')
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete account right now.')
      setDeleteLoading(false)
    }
  }

  const isGuest = !user
  const activeUser = user || { email: 'Guest User' }
  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? 'G'

  const enrichedBalances = useMemo(() => {
    return balances.map(b => {
      const p = programs.find(x => x.id === b.program_id)
      return { ...b, name: p?.name || 'Unknown', type: p?.type || 'unknown', slug: p?.slug || '' }
    }).sort((a,b) => b.balance - a.balance)
  }, [balances, programs])
  
  const totalPoints = enrichedBalances.reduce((sum, b) => sum + b.balance, 0)
  const transferableCards = enrichedBalances.filter(b => b.type === 'transferable_points')
  const loyaltyPrograms = enrichedBalances.filter(b => b.type !== 'transferable_points')

  if (loading) {
    if (loadingTimedOut) {
      return (
        <div className="min-h-screen flex flex-col">
          <NavBar />
          <section className="pm-page-header">
            <div className="pm-shell">
              <h1 className="pm-heading text-4xl sm:text-5xl mb-2">Wallet</h1>
              <p className="pm-subtle text-base">Manage balances, alerts, connected accounts, and preferences.</p>
            </div>
          </section>
          <main className="flex-1 pm-shell max-w-3xl py-8 w-full">
            <div className="pm-card-soft p-8 text-center">
              <p className="pm-section-title mb-3">Still loading</p>
              <h2 className="pm-heading text-2xl">Wallet is taking longer than expected.</h2>
              <p className="mt-4 text-sm leading-7 text-pm-ink-700">
                This usually means auth or preferences are slow to respond. You can retry, sign in again, or continue to Planner.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button onClick={() => window.location.reload()} className="pm-button" type="button">
                  Retry wallet
                </button>
                <button onClick={() => void signInWithGoogle()} className="pm-button-secondary" type="button">
                  Sign in with Google
                </button>
                <Link href={`/${region}/calculator`} className="pm-button-secondary">
                  Go to Planner
                </Link>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      )
    }

    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-pm-accent border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  // Helper for premium card gradients
  const getCardGradient = (slug: string) => {
    if (slug.includes('amex')) return 'from-[#FFE066] via-[#D4AF37] to-[#AA7C11] text-[#2C1802]' // Amex Gold
    if (slug.includes('chase')) return 'from-[#0F2027] via-[#203A43] to-[#2C5364] text-white' // Dark Sapphire
    if (slug.includes('capital_one')) return 'from-[#000000] via-[#1B263B] to-[#415A77] text-white' // Venture X Slate
    if (slug.includes('bilt')) return 'from-[#000000] to-[#111111] text-white border border-white/10' // Bilt Black
    if (slug.includes('citi')) return 'from-[#1E3A8A] to-[#0284C7] text-white' // Citi Premier
    return 'from-pm-ink-700 to-pm-ink-900 text-white' // Default dark
  }

  const getProgramIcon = (type: string) => {
    if (type.includes('airline')) return '✈️'
    if (type.includes('hotel')) return '🏨'
    return '💎'
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <h1 className="pm-heading text-4xl sm:text-5xl mb-2">Wallet</h1>
          <p className="pm-subtle text-base">Manage balances, connected accounts, alerts, billing, and travel preferences.</p>
        </div>
      </section>

      <main className="flex-1 pm-shell max-w-4xl py-8 w-full space-y-8">
        {isGuest && (
          <div className="pm-card p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-pm-accent-border bg-pm-accent-soft/30">
            <div>
              <h2 className="pm-heading text-base text-pm-ink-900 flex items-center gap-2">
                <span>👋</span> Guest Wallet
              </h2>
              <p className="text-sm text-pm-ink-700 mt-1 max-w-lg leading-relaxed">
                You are viewing your Wallet as a guest. Your balances are stored locally in this browser. <strong className="text-pm-ink-900 font-semibold">Sign in to sync your accounts and backup your portfolio.</strong>
              </p>
            </div>
            <button onClick={() => void signInWithGoogle()} className="pm-button whitespace-nowrap">
              Sign in with Google
            </button>
          </div>
        )}

        {/* PREMIUM WALLET HERO SECTION */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4">
            <div>
              <p className="pm-section-title mb-1">Your Portfolio</p>
              <h2 className="text-3xl font-bold tracking-tight text-pm-ink-900">Total Balance</h2>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-[-0.04em] text-pm-accent">{totalPoints.toLocaleString()}</span>
              <span className="text-sm font-semibold text-pm-ink-500 uppercase tracking-widest">PTS</span>
            </div>
          </div>

          {enrichedBalances.length === 0 ? (
             <div className="pm-card-soft p-8 text-center border-dashed">
                <p className="text-2xl mb-2">👛</p>
                <h3 className="pm-heading text-lg mb-1">No balances yet</h3>
                <p className="text-sm text-pm-ink-500 max-w-md mx-auto">
                  Your wallet is empty. Connect your accounts or add balances manually to see your portfolio grow.
                </p>
             </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12 align-start">
              
              {/* CREDIT CARDS (TRANSFERABLE) */}
              <div className="lg:col-span-6 xl:col-span-7 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-pm-ink-500 border-b border-pm-border pb-2">Credit Cards & Transferable</h3>
                {transferableCards.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {transferableCards.map(c => {
                      const imgUrl = CARD_ART_MAP[c.name]
                      return (
                      <div key={c.program_id} className={`relative overflow-hidden aspect-[1.586/1] rounded-2xl p-5 shadow-xl bg-gradient-to-br transition-transform hover:-translate-y-1 ${getCardGradient(c.slug)}`}>
                        {imgUrl ? (
                           <div className="absolute inset-0">
                             <Image src={imgUrl} alt={c.name} fill className="object-cover" />
                             <div className="absolute inset-0 bg-black/20" />
                           </div>
                        ) : (
                          <>
                            {/* Premium Gloss Overlay for CSS Fallback */}
                            <div className="absolute inset-0 bg-white/10 [mask-image:linear-gradient(135deg,rgba(255,255,255,0.4)_0%,transparent_60%)] pointer-events-none" />
                            <div className="absolute top-5 left-5 w-8 h-6 rounded bg-gradient-to-br from-amber-200 to-yellow-600 border border-amber-800/50 opacity-90 overflow-hidden flex flex-col justify-evenly px-0.5 shadow-sm">
                               <div className="w-full h-[1px] bg-amber-900/40" />
                               <div className="w-full h-[1px] bg-amber-900/40" />
                               <div className="w-full h-[1px] bg-amber-900/40" />
                            </div>
                          </>
                        )}
                        
                        <div className="relative z-10 flex flex-col h-full justify-between">
                          <div className="flex justify-between items-start">
                             {!imgUrl && <span className="text-2xl drop-shadow-md ml-auto">💳</span>}
                          </div>
                          
                          <div>
                            <span className="font-semibold tracking-tight text-sm drop-shadow-sm leading-tight block mb-2 text-white">{c.name}</span>
                            <p className="text-[9px] uppercase font-bold text-white/70 tracking-widest mb-0.5 drop-shadow-sm">Available Balance</p>
                            <p className="text-2xl font-bold tracking-tight drop-shadow-sm text-white">{c.balance.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="pm-card-soft p-5 text-sm text-pm-ink-500 text-center border-dashed">No transferable currencies found.</div>
                )}
              </div>

              {/* LOYALTY PROGRAMS */}
              <div className="lg:col-span-6 xl:col-span-5 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-pm-ink-500 border-b border-pm-border pb-2">Airlines & Hotels</h3>
                {loyaltyPrograms.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {loyaltyPrograms.map(p => (
                      <div key={p.program_id} className="flex items-center justify-between p-4 pm-card transition-colors hover:border-pm-accent-border group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-pm-surface-soft flex items-center justify-center border border-pm-border shadow-sm text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                            {getProgramIcon(p.type)}
                          </div>
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-sm pm-heading truncate max-w-[130px] sm:max-w-[180px]">{p.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9px] uppercase font-bold tracking-widest ${p.source === 'connector' ? 'text-pm-accent' : 'text-pm-ink-500'}`}>
                                {p.source === 'connector' ? '● Synced' : '○ Manual'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="font-bold text-pm-ink-900 tracking-tight flex-shrink-0">{p.balance.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pm-card-soft p-5 text-sm text-pm-ink-500 text-center border-dashed">No airline or hotel loyalty accounts found.</div>
                )}
              </div>

            </div>
          )}
        </section>

        {/* ACCOUNT AND SETTINGS */}

        {!isGuest && (
          <div className="pm-card p-6">
            <h2 className="pm-heading text-base mb-4">Account</h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-pm-accent text-pm-bg flex items-center justify-center text-2xl font-bold flex-shrink-0">
                {avatarLetter}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-pm-ink-900 font-medium truncate">{activeUser.email}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  {userRecord?.tier === 'premium' ? (
                    <span className="inline-flex items-center text-xs font-semibold bg-pm-accent text-pm-bg px-2.5 py-0.5 rounded-full">
                      Pro
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-semibold bg-pm-surface-soft text-pm-ink-500 px-2.5 py-0.5 rounded-full border border-pm-border">
                      Free
                    </span>
                  )}
                  <span className="text-xs text-pm-ink-500">
                    {userRecord?.tier === 'premium' ? 'Pro plan active' : 'Free plan'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {userRecord?.tier === 'premium' ? (
                  <Button
                    onClick={openBillingPortal}
                    disabled={billingLoading !== null}
                    variant="outline"
                    size="sm"
                  >
                    {billingLoading === 'portal' ? 'Opening...' : 'Manage Subscription'}
                  </Button>
                ) : (
                  <Button
                    onClick={startCheckout}
                    disabled={billingLoading !== null}
                    size="sm"
                  >
                    {billingLoading === 'checkout' ? 'Loading...' : 'Upgrade to Pro'}
                  </Button>
                )}
                <button
                  onClick={signOut}
                  className="text-sm text-pm-danger hover:text-pm-danger font-medium border border-pm-danger-border hover:border-pm-danger px-4 py-2 rounded-xl transition-colors flex-shrink-0"
                >
                  Sign out
                </button>
              </div>
            </div>
            {billingError && (
              <p className="text-xs text-pm-danger mt-3">{billingError}</p>
            )}
          </div>
        )}

        <section className="space-y-3">
          <div>
            <p className="pm-section-title mb-2">Wallet sources</p>
            <h2 className="pm-heading text-lg mb-1">Balances and connected accounts</h2>
            <p className="text-xs text-pm-ink-500">
              Keep your sources current here. Planner and Card Strategy should use this as the source of truth for what you actually have.
            </p>
          </div>

          {showManualEntry && (
            <div className="pm-card-soft p-5 border border-pm-accent-border mb-4 animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="pm-heading text-sm text-pm-accent">Enter Balance Manually</h3>
                <button 
                  onClick={() => setShowManualEntry(false)}
                  className="text-pm-ink-500 hover:text-pm-ink-900"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Select value={manualProgramId} onValueChange={setManualProgramId}>
                    <SelectTrigger className="w-full bg-pm-surface">
                      <SelectValue placeholder="Select Program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Input 
                    type="number" 
                    placeholder="Point Balance (e.g. 50000)" 
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    min="0"
                  />
                </div>
                <Button 
                  onClick={handleManualAdd} 
                  disabled={savingManual || !manualProgramId || !manualAmount}
                >
                  {savingManual ? 'Saving...' : 'Add Balance'}
                </Button>
              </div>
            </div>
          )}

          <ConnectedWallets onManualEntry={() => setShowManualEntry(true)} isGuest={isGuest} />
        </section>

        {!isGuest && (
          <section className="space-y-3">
            <div>
              <p className="pm-section-title mb-2">Alerts</p>
              <h2 className="pm-heading text-lg mb-1">Transfer bonus watches</h2>
              <p className="text-xs text-pm-ink-500">
                Pick the transferable programs you care about so Wallet can notify you when timing matters.
              </p>
            </div>
            <AlertSubscriptionsCard userEmail={activeUser.email ?? ''} region={region} />
          </section>
        )}

        <div className="pm-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="pm-section-title mb-2">Preferences</p>
              <h2 className="pm-heading text-base">Travel preferences</h2>
              <p className="text-xs text-pm-ink-500 mt-0.5">Used by Planner and the AI booking flow for better recommendations.</p>
            </div>
            {toast && (
              <span className="text-xs text-pm-success bg-pm-success-soft border border-pm-success-border px-3 py-1 rounded-full font-medium">
                ✓ Saved
              </span>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label className="pm-label block mb-1.5">
                Home Airport
              </label>
              <input
                type="text"
                placeholder="e.g. JFK, LAX, ORD"
                value={prefForm.home_airport ?? ''}
                onChange={e => setPrefForm(f => ({ ...f, home_airport: e.target.value.toUpperCase() }))}
                className="pm-input"
              />
            </div>

            <div>
              <label className="pm-label block mb-1.5">
                Preferred Cabin
              </label>
              <select
                value={prefForm.preferred_cabin}
                onChange={e => setPrefForm(f => ({ ...f, preferred_cabin: e.target.value }))}
                className="pm-input"
              >
                <option value="any">Any cabin</option>
                <option value="economy">Economy</option>
                <option value="business">Business class</option>
                <option value="first">First class</option>
              </select>
            </div>

            <div>
              <label className="pm-label block mb-1.5">
                Preferred Airlines
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {prefForm.preferred_airlines.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-pm-accent-soft text-pm-accent-strong text-xs px-2.5 py-1 rounded-full border border-pm-accent-border">
                    {a}
                    <button onClick={() => removeTag('preferred_airlines', i)} className="hover:text-pm-danger font-bold">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  list="airlines-list-preferred"
                  placeholder="e.g. United Airlines, Delta Air Lines"
                  value={prefInput.preferred}
                  onChange={e => setPrefInput(p => ({ ...p, preferred: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addTag('preferred_airlines', 'preferred')}
                  className="pm-input flex-1"
                  autoComplete="off"
                />
                <datalist id="airlines-list-preferred">
                  {AIRLINE_OPTIONS.map(a => <option key={a} value={a} />)}
                </datalist>
                <button
                  onClick={() => addTag('preferred_airlines', 'preferred')}
                  className="pm-button-secondary px-4 py-2 text-sm"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <label className="pm-label block mb-1.5">
                Airlines to Avoid
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {prefForm.avoided_airlines.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-pm-danger-soft text-pm-danger text-xs px-2.5 py-1 rounded-full border border-pm-danger-border">
                    {a}
                    <button onClick={() => removeTag('avoided_airlines', i)} className="hover:text-pm-danger font-bold">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  list="airlines-list-avoided"
                  placeholder="e.g. Spirit Airlines, Frontier Airlines"
                  value={prefInput.avoided}
                  onChange={e => setPrefInput(p => ({ ...p, avoided: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addTag('avoided_airlines', 'avoided')}
                  className="pm-input flex-1"
                  autoComplete="off"
                />
                <datalist id="airlines-list-avoided">
                  {AIRLINE_OPTIONS.map(a => <option key={a} value={a} />)}
                </datalist>
                <button
                  onClick={() => addTag('avoided_airlines', 'avoided')}
                  className="pm-button-secondary px-4 py-2 text-sm"
                >
                  Add
                </button>
              </div>
            </div>

            <button
              onClick={savePreferences}
              disabled={saving}
              className="pm-button"
            >
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>

        {!isGuest && (
          <div className="pm-card p-6 border border-pm-danger-border">
            <h2 className="pm-heading text-base text-pm-danger">Delete Account</h2>
            <p className="text-sm text-pm-danger mt-2">
              Permanently delete your account and associated data. This cannot be undone.
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-4">
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is permanent. Type DELETE to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Input
                    value={deleteConfirm}
                    onChange={(event) => setDeleteConfirm(event.target.value)}
                    placeholder="Type DELETE"
                  />
                  {deleteError && <p className="text-sm text-pm-danger">{deleteError}</p>}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => { setDeleteConfirm(''); setDeleteError(null) }}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault()
                      void deleteAccount()
                    }}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? 'Deleting...' : 'Delete Account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function ProfilePage() {
  return <ProfilePageContent />
}
