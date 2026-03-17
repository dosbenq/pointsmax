import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadUnifiedBalancesByUser } from './user-balances'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

type QueryResult = {
  data: unknown[] | null
  error: { message: string } | null
}

function makeBuilder(result: QueryResult) {
  const builder = {
    select() {
      return builder
    },
    in() {
      return builder
    },
    order() {
      return Promise.resolve(result)
    },
    then(onfulfilled?: (value: QueryResult) => unknown) {
      return Promise.resolve(result).then(onfulfilled)
    },
  }

  return builder
}

const mockClient = {
  from: mockFrom,
}

describe('loadUnifiedBalancesByUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefers manual balances over connector snapshots for the same program', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_balances') {
        return makeBuilder({
          data: [
            {
              user_id: 'user-1',
              program_id: 'prog-1',
              balance: 111000,
              updated_at: '2026-03-13T10:00:00Z',
            },
          ],
          error: null,
        })
      }

      if (table === 'connected_accounts') {
        return makeBuilder({
          data: [
            {
              id: 'acct-1',
              user_id: 'user-1',
              status: 'active',
              sync_status: 'ok',
              last_synced_at: '2026-03-13T09:00:00Z',
            },
          ],
          error: null,
        })
      }

      if (table === 'balance_snapshots') {
        return makeBuilder({
          data: [
            {
              user_id: 'user-1',
              connected_account_id: 'acct-1',
              program_id: 'prog-1',
              balance: 99000,
              source: 'connector',
              fetched_at: '2026-03-13T09:00:00Z',
            },
            {
              user_id: 'user-1',
              connected_account_id: 'acct-1',
              program_id: 'prog-2',
              balance: 50000,
              source: 'connector',
              fetched_at: '2026-03-13T09:00:00Z',
            },
          ],
          error: null,
        })
      }

      if (table === 'programs') {
        return makeBuilder({ data: [], error: null })
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const result = await loadUnifiedBalancesByUser(mockClient, ['user-1'])
    const balances = result.get('user-1') ?? []

    expect(balances).toEqual([
      expect.objectContaining({
        program_id: 'prog-1',
        balance: 111000,
        source: 'manual',
        connected_account_id: null,
      }),
      expect.objectContaining({
        program_id: 'prog-2',
        balance: 50000,
        source: 'connector',
        connected_account_id: 'acct-1',
        sync_status: 'ok',
      }),
    ])
  })

  it('filters balances by region when requested', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_balances') {
        return makeBuilder({
          data: [
            { user_id: 'user-1', program_id: 'prog-us', balance: 1000, updated_at: '2026-03-13T10:00:00Z' },
            { user_id: 'user-1', program_id: 'prog-in', balance: 2000, updated_at: '2026-03-13T10:00:00Z' },
          ],
          error: null,
        })
      }

      if (table === 'connected_accounts') {
        return makeBuilder({ data: [], error: null })
      }

      if (table === 'balance_snapshots') {
        return makeBuilder({ data: [], error: null })
      }

      if (table === 'programs') {
        return makeBuilder({
          data: [
            { id: 'prog-us', geography: 'US' },
            { id: 'prog-global', geography: 'global' },
          ],
          error: null,
        })
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const result = await loadUnifiedBalancesByUser(mockClient, ['user-1'], 'US')
    const balances = result.get('user-1') ?? []

    expect(balances).toHaveLength(1)
    expect(balances[0]).toEqual(
      expect.objectContaining({
        program_id: 'prog-us',
        balance: 1000,
      }),
    )
  })
})
