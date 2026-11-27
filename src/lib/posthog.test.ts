import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  get_property: vi.fn(),
}))

vi.mock('posthog-js', () => ({ default: posthogMock }))
vi.mock('@/config/analytics', () => ({
  POSTHOG_KEY: 'phc_test',
  POSTHOG_PROXY_PATH: '/ingest',
  POSTHOG_UI_HOST: 'https://us.posthog.com',
  isPosthogConfigured: () => true,
}))

const posthog = await import('./posthog')

describe('posthog browser client', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ignores events until initialised, then starts once with pageviews on navigation', () => {
    posthog.capturePosthogEvent('calculator_calculate_clicked')
    expect(posthogMock.capture).not.toHaveBeenCalled()

    posthog.initPosthogClient()
    posthog.initPosthogClient()

    expect(posthogMock.init).toHaveBeenCalledTimes(1)
    expect(posthogMock.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      capture_pageview: 'history_change',
      person_profiles: 'identified_only',
    }))

    posthog.capturePosthogEvent('calculator_calculate_clicked', { region: 'us' })
    expect(posthogMock.capture).toHaveBeenCalledWith('calculator_calculate_clicked', { region: 'us' })
  })

  it('identifies the signed-in user by their app user id', () => {
    posthog.identifyPosthogUser('user-1', { email: 'pat@example.com', tier: 'free' })
    expect(posthogMock.identify).toHaveBeenCalledWith('user-1', { email: 'pat@example.com', tier: 'free' })
  })

  it('resets only when a user was identified', () => {
    posthogMock.get_property.mockReturnValueOnce('anonymous')
    posthog.resetPosthogUser()
    expect(posthogMock.reset).not.toHaveBeenCalled()

    posthogMock.get_property.mockReturnValueOnce('identified')
    posthog.resetPosthogUser()
    expect(posthogMock.reset).toHaveBeenCalledTimes(1)
  })
})
