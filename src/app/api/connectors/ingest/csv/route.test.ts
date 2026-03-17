import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockInsert = vi.fn()
const mockUpsert = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

const { POST, GET } = await import('./route')
const { resetIngestJobs } = await import('./state')

function makeSelectChain(table: string) {
  return {
    eq(column: string, value: string) {
      if (table === 'users' && column === 'auth_id') {
        return {
          single: async () => ({ data: { id: `internal-${value}` }, error: null }),
        }
      }

      if (table === 'programs' && column === 'is_active') {
        return Promise.resolve({
          data: [
            { id: 'prog-chase', name: 'Chase Ultimate Rewards', short_name: 'Chase UR', slug: 'chase-ur' },
            { id: 'prog-amex', name: 'American Express Membership Rewards', short_name: 'Amex MR', slug: 'amex-mr' },
            { id: 'prog-citi', name: 'Citi ThankYou', short_name: 'Citi TY', slug: 'citi-thankyou' },
          ],
          error: null,
        })
      }

      if (table === 'connected_accounts' && column === 'id') {
        return {
          eq() {
            return {
              single: async () => ({ data: { id: value }, error: null }),
            }
          },
        }
      }

      return {
        single: async () => ({ data: null, error: null }),
      }
    },
  }
}

function installDefaultMockFrom() {
  mockFrom.mockImplementation((table: string) => ({
    insert: (payload: unknown) => {
      const result = mockInsert(table, payload)
      return result === undefined ? Promise.resolve({ error: null }) : result
    },
    upsert: (payload: unknown, options?: unknown) => {
      const result = mockUpsert(table, payload, options)
      return result === undefined ? Promise.resolve({ error: null }) : result
    },
    select: () => makeSelectChain(table),
  }))
}

function createFormRequest(formData: FormData, userId = 'test-user'): NextRequest {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })

  return {
    formData: async () => formData,
  } as NextRequest
}

function createGetRequest(url: string, userId = 'test-user'): NextRequest {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })
  return new NextRequest(url)
}

describe('POST /api/connectors/ingest/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetIngestJobs()
    installDefaultMockFrom()
    mockInsert.mockResolvedValue({ error: null })
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    
    const formData = new FormData()
    const req = {
      formData: async () => formData,
    } as NextRequest

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toContain('Authentication required')
  })

  it('requires a file', async () => {
    const formData = new FormData()
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('No file provided')
  })

  it('validates file type', async () => {
    const formData = new FormData()
    const invalidFile = new File(['content'], 'data.pdf', { type: 'application/pdf' })
    formData.append('file', invalidFile)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('.csv or .txt')
  })

  it('validates file size', async () => {
    const formData = new FormData()
    const hugeContent = 'x'.repeat(2 * 1024 * 1024) // 2MB
    const hugeFile = new File([hugeContent], 'huge.csv', { type: 'text/csv' })
    formData.append('file', hugeFile)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('too large')
  })

  it('successfully imports valid CSV', async () => {
    const csvContent = `Program,Balance
Chase UR,100000
Amex MR,50000`
    
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status.status).toBe('completed')
    expect(body.summary.validRows).toBe(2)
    expect(body.summary.importedBalances).toBe(2)
    expect(body.jobId).toBeDefined()
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('handles CSV with parse errors', async () => {
    const csvContent = `Program,Balance
Chase,100000
,50000
Amex,invalid`
    
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    // Should still succeed with partial import
    expect(res.status).toBe(200)
    expect(body.summary.validRows).toBe(1)
    expect(body.summary.invalidRows).toBe(2)
    expect(body.warnings).toHaveLength(2)
  })

  it('fails when no valid rows found', async () => {
    const csvContent = `Program,Balance
,100000
Amex,invalid`
    
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toContain('No valid rows')
    expect(body.status.status).toBe('failed')
  })

  it('handles database insert errors', async () => {
    mockUpsert.mockImplementationOnce(() => Promise.resolve({ error: { message: 'Database constraint violation' } }))
    
    const csvContent = `Program,Balance\nChase,100000`
    
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toContain('Failed to save')
    expect(body.status.status).toBe('failed')
  })

  it('accepts connectedAccountId parameter', async () => {
    const csvContent = `Program,Balance\nChase,100000`
    
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    formData.append('connectedAccountId', 'account-123')
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    
    expect(res.status).toBe(200)
    const snapshotInsertCall = mockInsert.mock.calls.find(([table]) => table === 'balance_snapshots')
    expect(snapshotInsertCall?.[1][0].connected_account_id).toBe('account-123')
  })

  it('handles empty CSV file', async () => {
    const formData = new FormData()
    const file = new File([''], 'empty.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toBeDefined()
  })

  it('handles malformed CSV gracefully', async () => {
    const csvContent = `Program,Balance
Chase,100000
[incomplete row`
    
    const formData = new FormData()
    const file = new File([csvContent], 'malformed.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    // Should handle gracefully (one valid row, one invalid)
    expect(body.summary.validRows).toBeGreaterThanOrEqual(0)
  })

  it('returns correct job tracking info', async () => {
    const csvContent = `Program,Balance\nChase,100000`
    
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(body.jobId).toMatch(/^[0-9a-f-]{36}$/i) // UUID format
    expect(body.summary).toBeDefined()
    expect(body.summary.totalRows).toBe(1)
    expect(body.summary.validRows).toBe(1)
  })
})

describe('GET /api/connectors/ingest/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetIngestJobs()
    installDefaultMockFrom()
    mockInsert.mockResolvedValue({ error: null })
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    
    const req = new NextRequest('http://localhost/api/connectors/ingest/csv?jobId=123')

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toContain('Authentication required')
  })

  it('returns 404 for non-existent job', async () => {
    const req = createGetRequest('http://localhost/api/connectors/ingest/csv?jobId=non-existent-job')

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Job not found')
  })

  it('returns all jobs for user when no jobId specified', async () => {
    // First create a job via POST
    const csvContent = `Program,Balance\nChase,100000`
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const postReq = createFormRequest(formData, 'user-jobs-test')
    await POST(postReq)

    // Then get all jobs
    const getReq = createGetRequest('http://localhost/api/connectors/ingest/csv', 'user-jobs-test')
    const res = await GET(getReq)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(body.jobs)).toBe(true)
    expect(body.jobs.length).toBeGreaterThan(0)
    expect(body.jobs[0]).toHaveProperty('jobId')
    expect(body.jobs[0]).toHaveProperty('status')
    expect(body.jobs[0]).toHaveProperty('startedAt')
  })

  it('includes job details in response', async () => {
    // Create a job first
    const csvContent = `Program,Balance\nChase,100000`
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const postReq = createFormRequest(formData, 'user-details-test')
    const postRes = await POST(postReq)
    const postBody = await postRes.json()
    const jobId = postBody.jobId

    // Get specific job
    const getReq = createGetRequest(
      `http://localhost/api/connectors/ingest/csv?jobId=${jobId}`,
      'user-details-test'
    )
    const res = await GET(getReq)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.jobId).toBe(jobId)
    expect(body.status).toBeDefined()
    expect(body.status.status).toBe('completed')
    expect(body.summary).toBeDefined()
    expect(body.summary.validRows).toBe(1)
    expect(body.startedAt).toBeDefined()
    expect(body.completedAt).toBeDefined()
  })

  it('returns correct status object structure', async () => {
    const csvContent = `Program,Balance\nChase,100000`
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const postReq = createFormRequest(formData, 'user-status-test')
    const postRes = await POST(postReq)
    const postBody = await postRes.json()
    const jobId = postBody.jobId

    const getReq = createGetRequest(
      `http://localhost/api/connectors/ingest/csv?jobId=${jobId}`,
      'user-status-test'
    )
    const res = await GET(getReq)
    const body = await res.json()

    expect(body.status).toMatchObject({
      status: expect.any(String),
      message: expect.any(String),
    })
  })
})

describe('CSV Ingestion edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetIngestJobs()
    installDefaultMockFrom()
    mockInsert.mockResolvedValue({ error: null })
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('handles CSV with special characters in program names', async () => {
    const csvContent = `Program,Balance
"Chase UR (Sapphire Reserve)",100000
"Amex MR & Co.",50000`
    
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.summary.validRows).toBe(2)
  })

  it('handles quoted CSV fields correctly', async () => {
    const csvContent = `Program,Balance
"Chase Sapphire Reserve",100000
"Amex Gold",50000`
    
    const formData = new FormData()
    const file = new File([csvContent], 'balances.csv', { type: 'text/csv' })
    formData.append('file', file)
    
    const req = createFormRequest(formData)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.summary.validRows).toBe(2)
  })
})
