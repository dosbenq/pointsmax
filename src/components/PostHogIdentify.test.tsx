import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const { useAuthMock, identifyMock, resetMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  identifyMock: vi.fn(),
  resetMock: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({ useAuth: useAuthMock }))
vi.mock('@/lib/posthog', () => ({
  identifyPosthogUser: identifyMock,
  resetPosthogUser: resetMock,
}))

const { default: PostHogIdentify } = await import('./PostHogIdentify')

describe('PostHogIdentify', () => {
  beforeEach(() => vi.clearAllMocks())

  it('identifies the user once their profile has loaded', () => {
    useAuthMock.mockReturnValue({
      user: { id: 'auth-1' },
      userRecord: { id: 'user-1', email: 'pat@example.com', tier: 'premium' },
      loading: false,
    })
    render(<PostHogIdentify />)
    expect(identifyMock).toHaveBeenCalledWith('user-1', { email: 'pat@example.com', tier: 'premium' })
    expect(resetMock).not.toHaveBeenCalled()
  })

  it('does nothing while auth is still loading', () => {
    useAuthMock.mockReturnValue({ user: null, userRecord: null, loading: true })
    render(<PostHogIdentify />)
    expect(identifyMock).not.toHaveBeenCalled()
    expect(resetMock).not.toHaveBeenCalled()
  })

  it('resets after sign-out', () => {
    useAuthMock.mockReturnValue({ user: null, userRecord: null, loading: false })
    render(<PostHogIdentify />)
    expect(resetMock).toHaveBeenCalledTimes(1)
  })
})
