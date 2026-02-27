'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import type { SubscriptionTier } from '@/types/database'

type Preferences = {
  home_airport: string | null
  preferred_cabin: string
  preferred_airlines: string[]
  avoided_airlines: string[]
}

type UserRecord = {
  id: string
  email: string
  tier: SubscriptionTier
}

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

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

// Guard against missing env vars - return null if not configured
function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    console.warn('Supabase client not initialized: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return null
  }
  
  return createBrowserClient(url, key)
}

let browserSupabaseClient: BrowserSupabaseClient | null = null

function getBrowserSupabaseClient(): BrowserSupabaseClient | null {
  if (!browserSupabaseClient) {
    browserSupabaseClient = createClient()
  }
  return browserSupabaseClient
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getBrowserSupabaseClient()
  
  // Guard: if Supabase is not configured, skip auth and render children
  const isSupabaseConfigured = supabase !== null
  const [user, setUser] = useState<User | null>(null)
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const loadUserData = useCallback(async (authUser: User) => {
    if (!supabase) return
    
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
    if (!isSupabaseConfigured) {
      return
    }
    
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: { user: User | null } | null } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) await loadUserData(authUser)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: { user: User | null } | null) => {
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
  }, [loadUserData, supabase, isSupabaseConfigured])

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      console.error('Supabase not configured - cannot sign in')
      return
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setUser(null)
      setUserRecord(null)
      setPreferences(null)
      return
    }
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
