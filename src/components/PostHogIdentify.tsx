'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { identifyPosthogUser, resetPosthogUser } from '@/lib/posthog'

/** Keeps PostHog's notion of "who is this" in sync with sign-in and sign-out. */
export default function PostHogIdentify() {
  const { user, userRecord, loading } = useAuth()

  useEffect(() => {
    if (userRecord) {
      identifyPosthogUser(userRecord.id, { email: userRecord.email, tier: userRecord.tier })
      return
    }
    if (!loading && !user) {
      resetPosthogUser()
    }
  }, [user, userRecord, loading])

  return null
}
