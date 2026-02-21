'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

type Preferences = {
  home_airport: string | null
  preferred_cabin: string
  preferred_airlines: string[]
  avoided_airlines: string[]
}

type UserRecord = {
  id: string
  email: string
  tier: string
}

type AuthContextValue = {
  user: User | null
  userRecord: UserRecord | null
  preferences: Preferences | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshPreferences: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userRecord: null,
  preferences: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshPreferences: async () => {},
})

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const loadUserData = useCallback(async (authUser: User) => {
    // Load preferences via API (respects RLS via session cookie)
    const prefsRes = await fetch('/api/user/preferences')
    if (prefsRes.ok) {
      const { preferences: prefs } = await prefsRes.json()
      setPreferences(prefs)
    }

    // Load user record directly from DB
    const { data } = await supabase
      .from('users')
      .select('id, email, tier')
      .eq('auth_id', authUser.id)
      .single()
    setUserRecord(data)
  }, [supabase])

  const refreshPreferences = useCallback(async () => {
    const res = await fetch('/api/user/preferences')
    if (res.ok) {
      const { preferences: prefs } = await res.json()
      setPreferences(prefs)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) await loadUserData(authUser)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        await loadUserData(authUser)
      } else {
        setUserRecord(null)
        setPreferences(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRecord(null)
    setPreferences(null)
  }

  return (
    <AuthContext.Provider value={{ user, userRecord, preferences, loading, signInWithGoogle, signOut, refreshPreferences }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
