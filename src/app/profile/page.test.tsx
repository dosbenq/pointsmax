import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockAuthState = {
  user: { email: 'test@example.com', id: 'user-123' },
  userRecord: { id: 'user-123', email: 'test@example.com', tier: 'free' },
  preferences: null,
  loading: false,
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  refreshPreferences: vi.fn(),
}

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}))

// Mock auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthState,
}))

// Mock UI components
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/NavBar', () => ({
  default: () => <nav data-testid="navbar">NavBar</nav>,
}))

vi.mock('@/components/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}))

vi.mock('@/components/ConnectedWallets', () => ({
  ConnectedWallets: () => <div data-testid="connected-wallets">Connected Wallets</div>,
}))

// Import the component after mocks
import ProfilePage from './page'

describe('Profile Page - Region-aware Alert Program Scoping', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useRealTimers()
    mockAuthState.user = { email: 'test@example.com', id: 'user-123' }
    mockAuthState.userRecord = { id: 'user-123', email: 'test@example.com', tier: 'free' }
    mockAuthState.preferences = null
    mockAuthState.loading = false
    mockAuthState.signInWithGoogle = vi.fn()
    mockAuthState.signOut = vi.fn()
    mockAuthState.refreshPreferences = vi.fn()

    fetchMock = vi.fn()
    global.fetch = fetchMock
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
    
    // Default successful preferences response
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/user/preferences') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ preferences: null }),
        })
      }
      if (url.includes('/api/programs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Region detection and program loading', () => {
    it('fetches programs with US region when localStorage has pm_region=us', async () => {
      // Mock localStorage to return US region
      const localStorage = window.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      localStorage.getItem.mockReturnValue('us')

      render(<ProfilePage />)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/programs?region=US')
      })
    })

    it('fetches programs with India region when localStorage has pm_region=in', async () => {
      // Mock localStorage to return India region
      const localStorage = window.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      localStorage.getItem.mockReturnValue('in')

      render(<ProfilePage />)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/programs?region=IN')
      })
    })

    it('defaults to US region when localStorage has no region', async () => {
      // Mock localStorage to return null
      const localStorage = window.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      localStorage.getItem.mockReturnValue(null)

      render(<ProfilePage />)

      await waitFor(() => {
        // Should default to US
        expect(fetchMock).toHaveBeenCalledWith('/api/programs?region=US')
      })
    })

    it('displays US region indicator for US region', async () => {
      const localStorage = window.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      localStorage.getItem.mockReturnValue('us')

      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/user/preferences') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: null }),
          })
        }
        if (url.includes('/api/programs')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: 'chase-ur', name: 'Chase UR', type: 'transferable_points', geography: 'US' },
            ]),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<ProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('🇺🇸 US programs')).toBeInTheDocument()
      })
    })

    it('displays India region indicator for India region', async () => {
      const localStorage = window.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      localStorage.getItem.mockReturnValue('in')

      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/user/preferences') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: null }),
          })
        }
        if (url.includes('/api/programs')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: 'hdfc-millennia', name: 'HDFC Millennia', type: 'transferable_points', geography: 'IN' },
            ]),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<ProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('🇮🇳 India programs')).toBeInTheDocument()
      })
    })
  })

  describe('authentication states', () => {
    it('shows a sign-in state instead of redirecting when no user is present', async () => {
      mockAuthState.user = null
      mockAuthState.userRecord = null

      render(<ProfilePage />)

      expect(screen.getByText('Sign in required')).toBeInTheDocument()
      expect(screen.getByText('Your wallet only works when it knows who you are.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
    })

    it('shows a recovery state when wallet loading takes too long', async () => {
      vi.useFakeTimers()
      mockAuthState.loading = true
      mockAuthState.user = null
      mockAuthState.userRecord = null

      render(<ProfilePage />)

      await act(async () => {
        vi.advanceTimersByTime(4500)
      })

      expect(screen.getByText('Still loading')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry wallet' })).toBeInTheDocument()
    })
  })

  describe('Program filtering by region', () => {
    it('displays US transferable programs when region is US', async () => {
      const localStorage = window.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      localStorage.getItem.mockReturnValue('us')

      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/user/preferences') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: null }),
          })
        }
        if (url.includes('/api/programs')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: 'chase-ur', name: 'Chase UR', type: 'transferable_points', geography: 'US' },
              { id: 'amex-mr', name: 'Amex MR', type: 'transferable_points', geography: 'US' },
              { id: 'united', name: 'United MileagePlus', type: 'airline', geography: 'US' },
              { id: 'hdfc-millennia', name: 'HDFC Millennia', type: 'transferable_points', geography: 'IN' },
            ]),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<ProfilePage />)

      await waitFor(() => {
        // Should show US transferable programs
        expect(screen.getByText('Chase UR')).toBeInTheDocument()
        expect(screen.getByText('Amex MR')).toBeInTheDocument()
        // Should not show airline programs (filtered by type)
        expect(screen.queryByText('United MileagePlus')).not.toBeInTheDocument()
      })
    })

    it('displays India transferable programs when region is India', async () => {
      const localStorage = window.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      localStorage.getItem.mockReturnValue('in')

      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/user/preferences') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: null }),
          })
        }
        if (url.includes('/api/programs')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: 'hdfc-millennia', name: 'HDFC Millennia', type: 'transferable_points', geography: 'IN' },
              { id: 'amex-india-mr', name: 'Amex India MR', type: 'transferable_points', geography: 'IN' },
              { id: 'air-india', name: 'Air India Maharaja Club', type: 'airline', geography: 'IN' },
              { id: 'chase-ur', name: 'Chase UR', type: 'transferable_points', geography: 'US' },
            ]),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<ProfilePage />)

      await waitFor(() => {
        // Should show India transferable programs
        expect(screen.getByText('HDFC Millennia')).toBeInTheDocument()
        expect(screen.getByText('Amex India MR')).toBeInTheDocument()
        // Should not show airline programs (filtered by type)
        expect(screen.queryByText('Air India Maharaja Club')).not.toBeInTheDocument()
      })
    })

    it('shows loading state while fetching programs', async () => {
      const localStorage = window.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      localStorage.getItem.mockReturnValue('us')

      // Delay the fetch response
      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/user/preferences') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: null }),
          })
        }
        if (url.includes('/api/programs')) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () => Promise.resolve([]),
              })
            }, 100)
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<ProfilePage />)

      // Should show loading state
      expect(screen.getByText('Loading programs…')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByText('Loading programs…')).not.toBeInTheDocument()
      })
    })

    it('shows empty state when no transferable programs available', async () => {
      const localStorage = window.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      localStorage.getItem.mockReturnValue('us')

      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/user/preferences') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: null }),
          })
        }
        if (url.includes('/api/programs')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: 'united', name: 'United MileagePlus', type: 'airline', geography: 'US' },
            ]),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<ProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('No transferable programs available for your region.')).toBeInTheDocument()
      })
    })
  })
})
