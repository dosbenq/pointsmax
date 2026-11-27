import posthog from 'posthog-js'
import {
  POSTHOG_KEY,
  POSTHOG_PROXY_PATH,
  POSTHOG_UI_HOST,
  isPosthogConfigured,
} from '@/config/analytics'

type EventProps = Record<string, string | number | boolean | null | undefined>

export type PosthogPersonTraits = {
  email?: string | null
  tier?: string | null
}

let initialized = false

/** Start PostHog in the browser. Safe to call more than once; a no-op without a key. */
export function initPosthogClient() {
  if (typeof window === 'undefined' || initialized || !isPosthogConfigured()) return

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_PROXY_PATH,
    ui_host: POSTHOG_UI_HOST,
    // App Router navigations are client-side, so record a pageview on every URL change.
    capture_pageview: 'history_change',
    capture_pageleave: true,
    // Anonymous visitors do not create person profiles until they sign in.
    person_profiles: 'identified_only',
  })
  initialized = true
}

export function capturePosthogEvent(event: string, properties: EventProps = {}) {
  if (!initialized) return
  posthog.capture(event, properties)
}

/**
 * Tie this browser's activity to the signed-in user. The id is the app's
 * users.id, which server-side events (Stripe, onboarding) also use.
 */
export function identifyPosthogUser(userId: string, traits: PosthogPersonTraits = {}) {
  if (!initialized || !userId) return
  const props: Record<string, string> = {}
  if (traits.email) props.email = traits.email
  if (traits.tier) props.tier = traits.tier
  posthog.identify(userId, props)
}

/** After sign-out, start a fresh anonymous visitor so events stop counting for the old user. */
export function resetPosthogUser() {
  if (!initialized) return
  if (posthog.get_property('$user_state') === 'identified') {
    posthog.reset()
  }
}
