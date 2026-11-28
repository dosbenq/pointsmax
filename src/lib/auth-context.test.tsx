import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './auth-context'

type SessionState = {
  data: { user: { id: string; email: string; name?: string; createdAt: string } } | null
  isPending: boolean
}

const sessionState: { current: SessionState } = { current: { data: null, isPending: true } }
const signInSocial = vi.fn()
const signOutMock = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => sessionState.current,
    signIn: { social: (...args: unknown[]) => signInSocial(...args) },
    signOut: () => signOutMock(),
  },
}))

function Probe() {
  const { loading, user, userRecord, signInWithGoogle } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.id ?? 'none'}</span>
      <span data-testid="tier">{userRecord?.tier ?? 'none'}</span>
      <button onClick={() => signInWithGoogle('/in/calculator')}>sign in</button>
    </div>
  )
}

const signedIn: SessionState = {
  data: { user: { id: 'user-123', email: 'test@example.com', createdAt: '2026-01-01T00:00:00.000Z' } },
  isPending: false,
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionState.current = { data: null, isPending: true }
  })

  it('does not leave loading stuck when preferences fetch fails during boot', async () => {
    sessionState.current = signedIn
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('user').textContent).toBe('user-123')
  })

  it('loads the profile record for a signed-in user', async () => {
    sessionState.current = signedIn
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/user/me') return new Response(JSON.stringify({ user: { id: 'p1', email: 'test@example.com', tier: 'premium' } }))
      return new Response(JSON.stringify({ preferences: null }))
    }))

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('tier').textContent).toBe('premium')
    })
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('reports signed-out users once the session check finishes', async () => {
    sessionState.current = { data: null, isPending: false }
    vi.stubGlobal('fetch', vi.fn())

    render(<AuthProvider><Probe /></AuthProvider>)

    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('starts Google sign-in with a callback to the post-login landing', async () => {
    sessionState.current = { data: null, isPending: false }
    vi.stubGlobal('fetch', vi.fn())
    render(<AuthProvider><Probe /></AuthProvider>)

    await act(async () => {
      screen.getByText('sign in').click()
    })

    expect(signInSocial).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      callbackURL: '/auth/callback?next=%2Fin%2Fcalculator',
    }))
  })
})
