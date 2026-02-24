'use client'

import { useEffect } from 'react'
import { initPosthogClient } from '@/lib/posthog'

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPosthogClient()
  }, [])

  return <>{children}</>
}
