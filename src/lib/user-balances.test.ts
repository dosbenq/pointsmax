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

  it('returns each user\'s saved balances, and an empty list for users with none', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_balances') {
        return makeBuilder({
          data: [
            { user_id: 'user-1', program_id: 'prog-1', balance: 111000, updated_at: '2026-03-13T10:00:00Z' },
            { user_id: 'user-1', program_id: 'prog-2', balance: 50000, updated_at: null },
          ],
          error: null,
        })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const result = await loadUnifiedBalancesByUser(mockClient, ['user-1', 'user-2'])

    expect(result.get('user-1')).toEqual([
      expect.objectContaining({ program_id: 'prog-1', balance: 111000, source: 'manual', connected_account_id: null }),
      expect.objectContaining({ program_id: 'prog-2', balance: 50000, confidence: 'low', is_stale: true }),
    ])
    expect(result.get('user-2')).toEqual([])
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
