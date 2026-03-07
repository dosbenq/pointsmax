'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
import { ConnectedWallets } from '@/components/ConnectedWallets'
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

type Preferences = {
  home_airport: string | null
  preferred_cabin: string
  preferred_airlines: string[]
  avoided_airlines: string[]
}

type Program = { id: string; name: string; type: string; geography?: string | null }

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
  
  // Region state - prefers explicit query parameter, then falls back to persisted selection.
  const [region, setRegion] = useState<Region>(initialRegion ?? 'us')
  
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
    setPrefForm(f => ({ ...f, [field]: [...f[field], val] }))
    setPrefInput(p => ({ ...p, [inputKey]: '' }))
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

  if (loading || !user) {
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
            <p className="pm-section-title mb-3">Sign in required</p>
            <h2 className="pm-heading text-2xl">Your wallet only works when it knows who you are.</h2>
            <p className="mt-4 text-sm leading-7 text-pm-ink-700">
              Sign in to manage balances, connected accounts, alerts, and travel preferences. If you just want to explore the product first, use Planner or Card Strategy.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={() => void signInWithGoogle()} className="pm-button" type="button">
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

  const avatarLetter = user.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <h1 className="pm-heading text-4xl sm:text-5xl mb-2">Wallet</h1>
          <p className="pm-subtle text-base">Manage balances, connected accounts, alerts, billing, and travel preferences.</p>
        </div>
      </section>

      <main className="flex-1 pm-shell max-w-3xl py-8 w-full space-y-6">
        <div className="pm-card p-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['1. Keep balances current', 'Connected accounts and manual balances should be updated here first.'],
              ['2. Set timing alerts', 'Only watch programs you would actually act on when a bonus appears.'],
              ['3. Refine preferences', 'Planner and booking flows should use this page as your travel context.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[22px] border border-pm-border bg-pm-surface-soft p-4">
                <p className="text-sm font-semibold text-pm-ink-900">{title}</p>
                <p className="mt-2 text-xs leading-6 text-pm-ink-700">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="pm-card p-5">
            <p className="pm-section-title mb-2">Plan</p>
            <p className="text-2xl font-semibold tracking-[-0.04em] text-pm-ink-900">{userRecord?.tier === 'premium' ? 'Pro' : 'Free'}</p>
            <p className="mt-2 text-sm leading-7 text-pm-ink-700">
              {userRecord?.tier === 'premium' ? 'Your premium features are active.' : 'Upgrade when you want billing-backed premium features.'}
            </p>
          </div>
          <div className="pm-card p-5">
            <p className="pm-section-title mb-2">Region</p>
            <p className="text-2xl font-semibold tracking-[-0.04em] text-pm-ink-900">{region === 'in' ? 'India' : 'US'}</p>
            <p className="mt-2 text-sm leading-7 text-pm-ink-700">
              Wallet alerts and supported programs are scoped to the region you are currently using.
            </p>
          </div>
          <div className="pm-card p-5">
            <p className="pm-section-title mb-2">What lives here</p>
            <p className="text-2xl font-semibold tracking-[-0.04em] text-pm-ink-900">Balances + alerts</p>
            <p className="mt-2 text-sm leading-7 text-pm-ink-700">
              Keep this page current so Planner and Card Strategy can make better decisions for you.
            </p>
          </div>
        </div>

        <div className="pm-card p-6">
          <h2 className="pm-heading text-base mb-4">Account</h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-pm-accent text-pm-bg flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-pm-ink-900 font-medium truncate">{user.email}</p>
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

        <section className="space-y-3">
          <div>
            <p className="pm-section-title mb-2">Wallet sources</p>
            <h2 className="pm-heading text-lg mb-1">Balances and connected accounts</h2>
            <p className="text-xs text-pm-ink-500">
              Keep your sources current here. Planner and Card Strategy should use this as the source of truth for what you actually have.
            </p>
          </div>
          <ConnectedWallets onManualEntry={() => router.push(`/${region}/calculator`)} />
        </section>

        <section className="space-y-3">
          <div>
            <p className="pm-section-title mb-2">Alerts</p>
            <h2 className="pm-heading text-lg mb-1">Transfer bonus watches</h2>
            <p className="text-xs text-pm-ink-500">
              Pick the transferable programs you care about so Wallet can notify you when timing matters.
            </p>
          </div>
          <AlertSubscriptionsCard userEmail={user.email ?? ''} region={region} />
        </section>

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
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. United, Delta"
                  value={prefInput.preferred}
                  onChange={e => setPrefInput(p => ({ ...p, preferred: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addTag('preferred_airlines', 'preferred')}
                  className="pm-input flex-1"
                />
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
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Spirit, Frontier"
                  value={prefInput.avoided}
                  onChange={e => setPrefInput(p => ({ ...p, avoided: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addTag('avoided_airlines', 'avoided')}
                  className="pm-input flex-1"
                />
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
      </main>

      <Footer />
    </div>
  )
}

export default function ProfilePage() {
  return <ProfilePageContent />
}
