'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Root page at pointsmax.com/
 * Middleware should ideally handle the redirect based on IP,
 * but this client-side fallback ensures users land on a regional edition.
 */
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    // Default to /us if middleware didn't catch it
    router.replace('/us')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-pm-bg">
      <div className="w-6 h-6 rounded-full border-2 border-pm-border border-t-pm-accent animate-spin" />
    </div>
  )
}
