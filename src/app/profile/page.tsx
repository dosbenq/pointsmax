'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
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

type Program = { id: string; name: string; type: string }

// Alert Subscriptions Card
function AlertSubscriptionsCard({ userEmail }: { userEmail: string }) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState(userEmail)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<'saved' | 'error' | null>(null)

  useEffect(() => {
    fetch('/api/programs')
      .then(r => r.json())
      .then((data: Program[]) => {
        const transferable = data.filter((p: Program) => p.type === 'transferable_points')
        setPrograms(transferable)
      })
  }, [])

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
          <label className="pm-label block mb-2">
            Programs to Watch
          </label>
          <div className="flex flex-wrap gap-2">
            {programs.map(p => {
              const checked = selectedIds.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    checked
                      ? 'bg-pm-accent text-pm-bg border-pm-accent'
                      : 'bg-white text-pm-ink-700 border-pm-border hover:border-pm-accent-border'
                  }`}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
          {selectedIds.size === 0 && (
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

export default function ProfilePage() {
  const { user, userRecord, loading, signOut, refreshPreferences } = useAuth()
  const router = useRouter()

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

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
    }
  }, [loading, user, router])

  // Load preferences
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
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-pm-accent border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  const avatarLetter = user.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 pm-shell max-w-3xl py-12 w-full space-y-6">
        <div>
          <h1 className="pm-heading text-3xl tracking-tight">Profile &amp; Settings</h1>
          <p className="pm-subtle text-sm mt-1">Manage your account and travel preferences.</p>
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

        <AlertSubscriptionsCard userEmail={user.email ?? ''} />

        <div className="pm-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="pm-heading text-base">Travel Preferences</h2>
              <p className="text-xs text-pm-ink-500 mt-0.5">Used by the AI advisor for personalized recommendations.</p>
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
                {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
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
