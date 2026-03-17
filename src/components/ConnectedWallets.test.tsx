import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { ConnectedWallets } from './ConnectedWallets'

describe('ConnectedWallets', () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch
  global.alert = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('renders loading spinner initially', () => {
      // Never resolve the fetch to keep loading state
      mockFetch.mockImplementation(() => new Promise(() => {}))
      
      render(<ConnectedWallets />)
      
      expect(screen.getByTestId('connected-wallets-loading')).toBeInTheDocument()
      expect(screen.getByText('Wallet Sources')).toBeInTheDocument()
      expect(screen.getByText('Manage imported and synced balance sources.')).toBeInTheDocument()
    })

    it('shows loading animation while fetching accounts', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))
      
      render(<ConnectedWallets />)
      
      const loadingContainer = screen.getByTestId('connected-wallets-loading')
      expect(loadingContainer.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders empty state when no accounts exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: [] }),
      })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-empty')).toBeInTheDocument()
      })
      
      expect(screen.getByText('No balance sources added yet')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Manual balance entry is available now. Existing linked sources will still sync here, but new provider onboarding is not exposed in the UI yet.',
        ),
      ).toBeInTheDocument()
    })

    it('shows connect wallet button in empty state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: [] }),
      })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connect-wallet-btn')).toBeInTheDocument()
      })
      
      expect(screen.getByTestId('connect-wallet-btn')).toHaveTextContent('Add Manual Balance')
    })

    it('shows manual entry button in empty state when onManualEntry provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: [] }),
      })
      
      const onManualEntry = vi.fn()
      render(<ConnectedWallets onManualEntry={onManualEntry} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('manual-entry-btn')).toBeInTheDocument()
      })
      
      expect(screen.getByTestId('manual-entry-btn')).toHaveTextContent('Enter Balance Manually')
    })

    it('calls onManualEntry when manual entry button clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: [] }),
      })
      
      const onManualEntry = vi.fn()
      render(<ConnectedWallets onManualEntry={onManualEntry} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('manual-entry-btn')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId('manual-entry-btn'))
      expect(onManualEntry).toHaveBeenCalledTimes(1)
    })
  })

  describe('error state', () => {
    it('renders error state when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-error')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Failed to load connected wallets. Please try again.')).toBeInTheDocument()
    })

    it('shows specific error for 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-error')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Please sign in to manage connected wallets.')).toBeInTheDocument()
    })

    it('shows retry button in error state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-error')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('retries fetch when retry button clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [] }),
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-error')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Retry'))
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-empty')).toBeInTheDocument()
      })
      
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('shows manual entry button in error state when onManualEntry provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
      
      const onManualEntry = vi.fn()
      render(<ConnectedWallets onManualEntry={onManualEntry} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-error')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Enter Balance Manually')).toBeInTheDocument()
    })
  })

  describe('connected state', () => {
    const mockAccount = {
      id: 'acc-1',
      user_id: 'user-1',
      provider: 'amex' as const,
      display_name: 'My Amex Card',
      status: 'active' as const,
      token_vault_ref: 'vault-ref-1',
      token_expires_at: null,
      scopes: null,
      last_synced_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      last_error: null,
      sync_status: 'ok' as const,
      error_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const mockBalances = {
      balances: [{
        id: 'snap-1',
        balance: 50000,
        source: 'connector',
        fetched_at: new Date().toISOString(),
      }],
    }

    it('renders connected state with accounts', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      expect(screen.getByTestId(`wallet-item-${mockAccount.id}`)).toBeInTheDocument()
      expect(screen.getByText('My Amex Card')).toBeInTheDocument()
    })

    it('renders multiple accounts', async () => {
      const accounts = [
        mockAccount,
        { ...mockAccount, id: 'acc-2', provider: 'chase' as const, display_name: 'Chase Sapphire' },
      ]
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      expect(screen.getByTestId('wallet-item-acc-1')).toBeInTheDocument()
      expect(screen.getByTestId('wallet-item-acc-2')).toBeInTheDocument()
    })

    it('shows account status badge', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      expect(screen.getByText('active')).toBeInTheDocument()
    })

    it('shows sync status and last synced time', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      expect(screen.getByText(/Synced/)).toBeInTheDocument()
    })

    it('shows sync, disconnect and delete buttons for active account', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      expect(screen.getByTestId(`sync-btn-${mockAccount.id}`)).toBeInTheDocument()
      expect(screen.getByTestId(`disconnect-btn-${mockAccount.id}`)).toBeInTheDocument()
      expect(screen.getByTestId(`delete-btn-${mockAccount.id}`)).toBeInTheDocument()
    })

    it('shows add button in connected state', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      expect(screen.getByTestId('connect-wallet-btn')).toHaveTextContent('Add Manual Balance')
    })

    it('shows manual entry button in connected state when onManualEntry provided', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      const onManualEntry = vi.fn()
      render(<ConnectedWallets onManualEntry={onManualEntry} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      expect(screen.getByTestId('manual-entry-btn')).toHaveTextContent('Manual Entry')
    })
  })

  describe('account actions', () => {
    const mockAccount = {
      id: 'acc-1',
      user_id: 'user-1',
      provider: 'amex' as const,
      display_name: 'My Amex Card',
      status: 'active' as const,
      token_vault_ref: 'vault-ref-1',
      token_expires_at: null,
      scopes: null,
      last_synced_at: new Date().toISOString(),
      last_error: null,
      sync_status: 'ok' as const,
      error_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const mockBalances = {
      balances: [{
        id: 'snap-1',
        balance: 50000,
        source: 'connector',
        fetched_at: new Date().toISOString(),
      }],
    }

    it('calls sync API when sync button clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok', result: { balances: {} } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId(`sync-btn-${mockAccount.id}`))
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/connectors/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: mockAccount.id }),
        })
      })
    })

    it('calls disconnect API when disconnect button clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [] }),
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId(`disconnect-btn-${mockAccount.id}`))
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/connectors/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: mockAccount.id }),
        })
      })
    })

    it('shows delete confirmation when delete button clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId(`delete-btn-${mockAccount.id}`))
      
      expect(screen.getByTestId(`confirm-delete-btn-${mockAccount.id}`)).toBeInTheDocument()
      expect(screen.getByTestId(`cancel-delete-btn-${mockAccount.id}`)).toBeInTheDocument()
    })

    it('calls delete API when delete confirmed', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [] }),
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId(`delete-btn-${mockAccount.id}`))
      
      await waitFor(() => {
        expect(screen.getByTestId(`confirm-delete-btn-${mockAccount.id}`)).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId(`confirm-delete-btn-${mockAccount.id}`))
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(`/api/connectors/${mockAccount.id}`, {
          method: 'DELETE',
        })
      })
    })

    it('cancels delete when cancel button clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId(`delete-btn-${mockAccount.id}`))
      
      await waitFor(() => {
        expect(screen.getByTestId(`cancel-delete-btn-${mockAccount.id}`)).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId(`cancel-delete-btn-${mockAccount.id}`))
      
      expect(screen.queryByTestId(`confirm-delete-btn-${mockAccount.id}`)).not.toBeInTheDocument()
    })
  })

  describe('error handling in actions', () => {
    const mockAccount = {
      id: 'acc-1',
      user_id: 'user-1',
      provider: 'amex' as const,
      display_name: 'My Amex Card',
      status: 'active' as const,
      token_vault_ref: 'vault-ref-1',
      token_expires_at: null,
      scopes: null,
      last_synced_at: new Date().toISOString(),
      last_error: null,
      sync_status: 'ok' as const,
      error_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const mockBalances = {
      balances: [{
        id: 'snap-1',
        balance: 50000,
        source: 'connector',
        fetched_at: new Date().toISOString(),
      }],
    }

    it('handles sync error gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Sync failed due to rate limit' }),
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId(`sync-btn-${mockAccount.id}`))
      
      // Component updates local state to show error instead of calling alert
      await waitFor(() => {
        expect(screen.getByText('• Sync failed due to rate limit')).toBeInTheDocument()
      })
    })

    it('shows syncing state during sync operation', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [mockAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
        .mockImplementationOnce(() => new Promise(() => {})) // Never resolve to keep loading
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId(`sync-btn-${mockAccount.id}`))
      
      await waitFor(() => {
        const syncBtn = screen.getByTestId(`sync-btn-${mockAccount.id}`)
        expect(syncBtn.querySelector('.animate-spin')).toBeInTheDocument()
      })
    })
  })

  describe('account status variations', () => {
    const mockBalances = {
      balances: [{
        id: 'snap-1',
        balance: 50000,
        source: 'connector',
        fetched_at: new Date().toISOString(),
      }],
    }

    it('shows different status badges for different account statuses', async () => {
      const accounts = [
        {
          id: 'acc-1',
          user_id: 'user-1',
          provider: 'amex' as const,
          display_name: 'Active Account',
          status: 'active' as const,
          token_vault_ref: 'vault-ref-1',
          token_expires_at: null,
          scopes: null,
          last_synced_at: new Date().toISOString(),
          last_error: null,
          sync_status: 'ok' as const,
          error_code: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'acc-2',
          user_id: 'user-1',
          provider: 'chase' as const,
          display_name: 'Expired Account',
          status: 'expired' as const,
          token_vault_ref: 'vault-ref-2',
          token_expires_at: null,
          scopes: null,
          last_synced_at: new Date().toISOString(),
          last_error: 'Token expired',
          sync_status: 'error' as const,
          error_code: 'auth_error' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      // Use within to scope queries to specific wallet items
      const wallet1 = screen.getByTestId('wallet-item-acc-1')
      const wallet2 = screen.getByTestId('wallet-item-acc-2')
      
      expect(within(wallet1).getByText('active')).toBeInTheDocument()
      expect(within(wallet2).getByText('expired')).toBeInTheDocument()
      expect(within(wallet2).getByText('• Token expired')).toBeInTheDocument()
    })

    it('disables sync button for non-active accounts', async () => {
      const expiredAccount = {
        id: 'acc-1',
        user_id: 'user-1',
        provider: 'amex' as const,
        display_name: 'Expired Account',
        status: 'expired' as const,
        token_vault_ref: 'vault-ref-1',
        token_expires_at: null,
        scopes: null,
        last_synced_at: new Date().toISOString(),
        last_error: 'Token expired',
        sync_status: 'error' as const,
        error_code: 'auth_error' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [expiredAccount] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBalances,
        })
      
      render(<ConnectedWallets />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-connected')).toBeInTheDocument()
      })
      
      const syncBtn = screen.getByTestId(`sync-btn-${expiredAccount.id}`)
      expect(syncBtn).toBeDisabled()
    })
  })

  describe('custom className', () => {
    it('applies custom className to container', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: [] }),
      })
      
      render(<ConnectedWallets className="custom-class" />)
      
      await waitFor(() => {
        expect(screen.getByTestId('connected-wallets-empty')).toBeInTheDocument()
      })
      
      const container = screen.getByTestId('connected-wallets-empty')
      expect(container.classList.contains('custom-class')).toBe(true)
    })
  })
})
