'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { trackEvent } from '@/lib/analytics'

interface PricingActionsProps {
  region?: string
}

export default function PricingActions({ region = 'us' }: PricingActionsProps) {
  const { loading, user, userRecord, signInWithGoogle } = useAuth()
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkoutStatus = useMemo(() => {
    const value = searchParams.get('checkout')
    if (value === 'success') return 'success'
    if (value === 'cancelled') return 'cancelled'
    return null
  }, [searchParams])

  const isPremium = userRecord?.tier === 'premium'

  const startCheckout = async () => {
    setError(null)

    if (!user) {
      trackEvent('pricing_signin_for_checkout_clicked', { source: 'pricing_page', region })
      await signInWithGoogle()
      return
    }

    try {
      setBusy('checkout')
      trackEvent('upgrade_clicked', { source: 'pricing_page', region })
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string }

      if (!res.ok || !payload.url) {
        throw new Error(payload.error ?? 'Unable to start checkout.')
      }

      trackEvent('pricing_checkout_redirected', { source: 'pricing_page', region })
      window.location.assign(payload.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.')
    } finally {
      setBusy(null)
    }
  }

  const openBillingPortal = async () => {
    setError(null)
    try {
      setBusy('portal')
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string }

      if (!res.ok || !payload.url) {
        throw new Error(payload.error ?? 'Unable to open billing portal.')
      }

      trackEvent('pricing_billing_portal_opened', { source: 'pricing_page', region })
      window.location.assign(payload.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open billing portal.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      {checkoutStatus === 'success' && (
        <p className="text-xs text-pm-success bg-pm-success-soft border border-pm-success-border rounded-lg px-3 py-2">
          Payment received. Your Pro access will be enabled shortly.
        </p>
      )}

      {checkoutStatus === 'cancelled' && (
        <p className="text-xs text-pm-warning bg-pm-warning-soft border border-pm-warning-border rounded-lg px-3 py-2">
          Checkout canceled. You can resume anytime.
        </p>
      )}

      {loading ? (
        <button className="pm-button w-full opacity-70 cursor-wait" disabled>
          Loading…
        </button>
      ) : isPremium ? (
        <button
          onClick={openBillingPortal}
          disabled={busy !== null}
          className="pm-button w-full"
        >
          {busy === 'portal' ? 'Opening…' : 'Manage subscription'}
        </button>
      ) : (
        <button
          onClick={startCheckout}
          disabled={busy !== null}
          className="pm-button w-full"
        >
          {busy === 'checkout' ? 'Redirecting…' : user ? 'Upgrade to Pro' : 'Sign in to upgrade'}
        </button>
      )}

      {!isPremium && (
        <p className="text-xs text-pm-ink-500 text-center">
          {user ? 'Secure checkout via Stripe.' : 'Sign in first to attach Pro to your account.'}
        </p>
      )}

      {error && (
        <p className="text-xs text-pm-danger bg-pm-danger-soft border border-pm-danger-border rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
