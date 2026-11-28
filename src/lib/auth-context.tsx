'use client'

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type { SubscriptionTier } from '@/types/database'
import type { AppUser } from '@/lib/auth-types'
import { authClient } from '@/lib/auth-client'
import { logWarn } from '@/lib/logger'

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

type AuthContextValue = {
  user: AppUser | null
  userRecord: UserRecord | null
  preferences: Preferences | null
  loading: boolean
  signInWithGoogle: (next?: string) => Promise<void>
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

function toAppUser(raw: {
  id: string
  email: string
  name?: string | null
  image?: string | null
  emailVerified?: boolean
  createdAt: Date | string
} | null | undefined): AppUser | null {
  if (!raw) return null
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name ?? null,
    image: raw.image ?? null,
    emailVerified: Boolean(raw.emailVerified),
    createdAt: new Date(raw.createdAt).toISOString(),
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession()
  const sessionUser = session.data?.user
  const user = useMemo(() => toAppUser(sessionUser), [sessionUser])
  const userId = user?.id ?? null

  const [userRecord, setUserRecord] = useState<UserRecord | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const loadUserData = useCallback(async () => {
    try {
      const prefsRes = await fetch('/api/user/preferences')
      if (prefsRes.ok) {
        const { preferences: prefs } = await prefsRes.json()
        setPreferences(prefs)
      }
    } catch (error) {
      logWarn('auth_preferences_load_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
    }

    try {
      const res = await fetch('/api/user/me')
      if (res.ok) {
        const { user: record } = await res.json()
        setUserRecord(record ?? null)
      }
    } catch (error) {
      logWarn('auth_user_record_load_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  const refreshPreferences = useCallback(async () => {
    const res = await fetch('/api/user/preferences')
    if (res.ok) {
      const { preferences: prefs } = await res.json()
      setPreferences(prefs)
    }
  }, [])

  // Load (or clear) profile data whenever the signed-in user changes.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (loadedFor !== userId) {
    setLoadedFor(userId)
    if (!userId) {
      setUserRecord(null)
      setPreferences(null)
    }
    setProfileLoading(Boolean(userId))
  }

  useEffect(() => {
    if (!userId) return
    let active = true
    void loadUserData().finally(() => {
      if (active) setProfileLoading(false)
    })
    return () => {
      active = false
    }
  }, [userId, loadUserData])

  useEffect(() => {
    if (!userId) return
    void fetch('/api/user/ping', {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
    }).catch(() => {})
  }, [userId])

  const signInWithGoogle = async (next?: string) => {
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      callbackUrl.searchParams.set('next', next)
    }
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${callbackUrl.pathname}${callbackUrl.search}`,
      errorCallbackURL: '/us/calculator?auth_error=1',
    })
  }

  const signOut = async () => {
    try {
      await authClient.signOut()
    } finally {
      setUserRecord(null)
      setPreferences(null)
    }
  }

  const loading = session.isPending || profileLoading

  return (
    <AuthContext.Provider value={{ user, userRecord, preferences, loading, signInWithGoogle, signOut, refreshPreferences }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
