import { createHash } from 'node:crypto'
import { POSTHOG_HOST, POSTHOG_KEY, isPosthogConfigured } from '@/config/analytics'
import { logWarn } from '@/lib/logger'

type Props = Record<string, unknown>

const CAPTURE_TIMEOUT_MS = 2_000

/** Stable UUID for a key, so PostHog drops repeats of the same real-world event. */
export function eventUuidFromKey(key: string): string {
  const hex = createHash('sha256').update(key).digest('hex')
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/**
 * Send one event to PostHog from the server (webhooks, API routes).
 * Never throws: analytics must not break the request that triggered it.
 * `distinctId` is the app's users.id, the same id the browser identifies with.
 */
export async function captureServerEvent(input: {
  distinctId: string | null | undefined
  event: string
  properties?: Props
  setPersonProperties?: Props
  /** Same key → same event in PostHog (e.g. a Stripe event id), so retries are not double counted. */
  dedupeKey?: string
  /** When the event happened; defaults to now. */
  timestamp?: string
}): Promise<void> {
  if (!isPosthogConfigured() || !input.distinctId) return

  const properties: Props = { ...input.properties, $lib: 'pointsmax-server' }
  if (input.setPersonProperties) properties.$set = input.setPersonProperties

  try {
    const res = await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: input.event,
        distinct_id: input.distinctId,
        properties,
        timestamp: input.timestamp ?? new Date().toISOString(),
        ...(input.dedupeKey ? { uuid: eventUuidFromKey(input.dedupeKey) } : {}),
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    })
    if (!res.ok) {
      logWarn('posthog_server_capture_failed', { event: input.event, status: res.status })
    }
  } catch (error) {
    logWarn('posthog_server_capture_failed', {
      event: input.event,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
