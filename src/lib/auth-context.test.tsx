import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createBrowserClient } from '@supabase/ssr'
import { AuthProvider, useAuth } from './auth-context'

const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    from: fromMock,
  })),
}))

function Probe() {
  const { loading, user } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.id ?? 'none'}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    })
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: { message: 'RLS blocked' } }),
        }),
      }),
    })
  })

  it("uses Supabase's default cookie names, which the sign-in callback reads", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(createBrowserClient).toHaveBeenCalled())

    // A custom storageKey / cookie name here broke every Google sign-in: the
    // server could not find the PKCE handshake cookie the browser had set.
    const options = vi.mocked(createBrowserClient).mock.calls[0][2] as
      | { auth?: { storageKey?: string }; cookieOptions?: { name?: string } }
      | undefined
    expect(options?.auth?.storageKey).toBeUndefined()
    expect(options?.cookieOptions?.name).toBeUndefined()
  })

  it('does not leave loading stuck when preferences fetch fails during boot', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-123', email: 'test@example.com' },
        },
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    expect(screen.getByTestId('user').textContent).toBe('user-123')
  })

  it('does not leave loading stuck when session bootstrap throws', async () => {
    getSessionMock.mockRejectedValue(new Error('session failed'))
    vi.stubGlobal('fetch', vi.fn())

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    expect(screen.getByTestId('user').textContent).toBe('none')
  })
})
