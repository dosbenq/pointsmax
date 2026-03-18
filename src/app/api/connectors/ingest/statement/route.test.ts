import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

const { POST } = await import('./route')

function makeProgramsSelect() {
  return {
    eq: async () => ({
      data: [
        { id: 'prog-chase', name: 'Chase Ultimate Rewards', slug: 'chase-ultimate-rewards' },
        { id: 'prog-amex', name: 'Amex Membership Rewards', slug: 'amex-membership-rewards' },
      ],
      error: null,
    }),
  }
}

function installDefaultDbMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'programs') return { select: () => makeProgramsSelect() }
    if (table === 'program_name_aliases') {
      return {
        select: async () => ({
          data: [{ alias: 'chase ur', program_slug: 'chase-ultimate-rewards' }],
          error: null,
        }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })
}

describe('POST /api/connectors/ingest/statement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installDefaultDbMocks()
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(new NextRequest('http://localhost/api/connectors/ingest/statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Chase UR Points Balance: 45,234' }),
    }))

    expect(response.status).toBe(401)
  })

  it('returns candidates without saving them', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } } })

    const response = await POST(new NextRequest('http://localhost/api/connectors/ingest/statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Membership Rewards® Points: 87,400' }),
    }))

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.matched_count).toBe(1)
    expect(body.unmatched_count).toBe(0)
    expect(body.candidates[0].program_id).toBe('prog-amex')
  })

  it('returns validation errors for malformed payloads', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } } })

    const response = await POST(new NextRequest('http://localhost/api/connectors/ingest/statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    }))

    expect(response.status).toBe(400)
  })
})
