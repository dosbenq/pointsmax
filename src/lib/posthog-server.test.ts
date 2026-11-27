// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/analytics', () => ({
  POSTHOG_KEY: 'phc_test',
  POSTHOG_HOST: 'https://us.i.posthog.com',
  isPosthogConfigured: () => true,
}))

vi.mock('@/lib/logger', () => ({ logWarn: vi.fn() }))

const { captureServerEvent, eventUuidFromKey } = await import('./posthog-server')
const { logWarn } = await import('@/lib/logger')

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response('{"status":"Ok"}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

function sentBody() {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return JSON.parse(String(init.body))
}

describe('captureServerEvent', () => {
  it('posts the event to PostHog with person properties and a stable id', async () => {
    await captureServerEvent({
      distinctId: 'user-1',
      event: 'subscription_started',
      properties: { amount: 9.99 },
      setPersonProperties: { tier: 'premium' },
      dedupeKey: 'stripe:evt_1',
      timestamp: '2026-11-01T00:00:00.000Z',
    })

    expect(fetchMock).toHaveBeenCalledWith('https://us.i.posthog.com/i/v0/e/', expect.objectContaining({ method: 'POST' }))
    expect(sentBody()).toEqual({
      api_key: 'phc_test',
      event: 'subscription_started',
      distinct_id: 'user-1',
      properties: { amount: 9.99, $lib: 'pointsmax-server', $set: { tier: 'premium' } },
      timestamp: '2026-11-01T00:00:00.000Z',
      uuid: eventUuidFromKey('stripe:evt_1'),
    })
  })

  it('skips events without a user id', async () => {
    await captureServerEvent({ distinctId: null, event: 'payment_failed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never throws when PostHog is down', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(captureServerEvent({ distinctId: 'user-1', event: 'x' })).resolves.toBeUndefined()

    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 500 }))
    await expect(captureServerEvent({ distinctId: 'user-1', event: 'x' })).resolves.toBeUndefined()
    expect(logWarn).toHaveBeenCalledTimes(2)
  })
})

describe('eventUuidFromKey', () => {
  it('returns the same valid UUID for the same key', () => {
    const id = eventUuidFromKey('signup:abc')
    expect(id).toBe(eventUuidFromKey('signup:abc'))
    expect(id).not.toBe(eventUuidFromKey('signup:abd'))
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
