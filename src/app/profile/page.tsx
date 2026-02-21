'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'

type Preferences = {
  home_airport: string | null
  preferred_cabin: string
  preferred_airlines: string[]
  avoided_airlines: string[]
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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  const avatarLetter = user.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <NavBar />

      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Profile &amp; Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your account and travel preferences.</p>
        </div>

        {/* Account card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Account</h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-900 font-medium truncate">{user.email}</p>
              <div className="mt-1.5">
                {userRecord?.tier === 'pro' ? (
                  <span className="inline-flex items-center text-xs font-semibold bg-slate-900 text-white px-2.5 py-0.5 rounded-full">
                    Pro
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                    Free
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={signOut}
              className="text-sm text-red-600 hover:text-red-700 font-medium border border-red-200 hover:border-red-300 px-4 py-2 rounded-xl transition-colors flex-shrink-0"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Travel preferences card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-900">Travel Preferences</h2>
              <p className="text-xs text-slate-400 mt-0.5">Used by the AI advisor for personalized recommendations</p>
            </div>
            {toast && (
              <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full font-medium">
                ✓ Saved
              </span>
            )}
          </div>

          <div className="space-y-5">
            {/* Home airport */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Home Airport
              </label>
              <input
                type="text"
                placeholder="e.g. JFK, LAX, ORD"
                value={prefForm.home_airport ?? ''}
                onChange={e => setPrefForm(f => ({ ...f, home_airport: e.target.value.toUpperCase() }))}
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
                  <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full border border-indigo-100">
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
                >
                  Add
                </button>
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
                >
                  Add
                </button>
              </div>
            </div>

            <button
              onClick={savePreferences}
              disabled={saving}
              className="bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors"
            >
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
