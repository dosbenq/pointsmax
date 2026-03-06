import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockUpsert = vi.fn()
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }))
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
}))

const { POST, GET } = await import('./route')

function createPostRequest(body: unknown, userId = 'test-user'): NextRequest {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })
  
  return new NextRequest('http://localhost/api/connectors/ingest/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createGetRequest(url: string, userId = 'test-user'): NextRequest {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })
  return new NextRequest(url)
}

describe('POST /api/connectors/ingest/email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsert.mockResolvedValue({ error: null })
    delete process.env.ENABLE_EMAIL_INGESTION
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    
    const req = new NextRequest('http://localhost/api/connectors/ingest/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_status' }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toContain('Authentication required')
  })

  it('rejects invalid JSON', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'test' } } })
    
    const req = new NextRequest('http://localhost/api/connectors/ingest/email', {
      method: 'POST',
      body: 'not valid json',
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid JSON')
  })

  it('returns placeholder status when feature is disabled', async () => {
    const req = createPostRequest({ action: 'check_status' })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status.status).toBe('pending')
    expect(body.status.message).toContain('not live yet')
    expect(body.feature.status).toBe('planned')
    expect(body.feature.estimatedRelease).toBeDefined()
    expect(body.alternative.method).toBe('csv_import')
  })

  it('registers user interest when action is register_interest', async () => {
    const req = createPostRequest({
      action: 'register_interest',
      emailDomain: 'gmail.com',
      provider: 'chase',
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status.status).toBe('pending')
    expect(body.status.message).toContain('Thanks for your interest')
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('handles database errors gracefully when registering interest', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } })
    
    const req = createPostRequest({
      action: 'register_interest',
    })

    const res = await POST(req)
    const body = await res.json()

    // Should still return success to user, just log the error
    expect(res.status).toBe(200)
    expect(body.status.message).toContain('Thanks for your interest')
  })

  it('includes supported providers in feature info', async () => {
    const req = createPostRequest({ action: 'check_status' })

    const res = await POST(req)
    const body = await res.json()

    expect(body.feature.supportedProviders).toBeDefined()
    expect(body.feature.supportedProviders).toContain('amex')
    expect(body.feature.supportedProviders).toContain('chase')
  })

  it('returns appropriate status (feature flag controlled)', async () => {
    // Note: Feature flag is evaluated at module load time, so we test the behavior
    // without depending on the specific flag state
    const req = createPostRequest({ action: 'check_status' })

    const res = await POST(req)
    const body = await res.json()

    // Should return valid response regardless of feature flag state
    expect(body.status).toBeDefined()
    expect(body.status.status).toMatch(/pending|processing/)
    expect(body.feature).toBeDefined()
  })
})

describe('GET /api/connectors/ingest/email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ENABLE_EMAIL_INGESTION
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    
    const req = new NextRequest('http://localhost/api/connectors/ingest/email')

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toContain('Authentication required')
  })

  it('returns basic status when feature is disabled', async () => {
    const req = createGetRequest('http://localhost/api/connectors/ingest/email')

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.enabled).toBe(false)
    expect(body.status.status).toBe('pending')
    expect(body.feature.status).toBe('planned')
    expect(body.guide).toBeUndefined()
    expect(body.status.message).toContain('waitlist-only')
  })

  it('returns guide when guide=true parameter is provided', async () => {
    const req = createGetRequest('http://localhost/api/connectors/ingest/email?guide=true')

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.guide).toBeDefined()
    expect(body.guide.title).toContain('export')
    expect(body.guide.steps).toBeDefined()
    expect(body.guide.csvFormat).toBeDefined()
    expect(body.alternative).toBeDefined()
  })

  it('includes provider-specific export instructions in guide', async () => {
    const req = createGetRequest('http://localhost/api/connectors/ingest/email?guide=true')

    const res = await GET(req)
    const body = await res.json()

    const steps = body.guide.steps
    expect(steps.some((s: { provider: string }) => s.provider === 'Chase')).toBe(true)
    expect(steps.some((s: { provider: string }) => s.provider === 'American Express')).toBe(true)
    expect(steps.some((s: { provider: string }) => s.provider === 'Citi')).toBe(true)
  })

  it('returns feature status information', async () => {
    const req = createGetRequest('http://localhost/api/connectors/ingest/email')

    const res = await GET(req)
    const body = await res.json()

    // Should return valid response structure regardless of feature flag state
    expect(typeof body.enabled).toBe('boolean')
    expect(body.status).toBeDefined()
    expect(body.status.status).toMatch(/pending|processing/)
    expect(body.feature).toBeDefined()
    expect(body.feature.status).toMatch(/planned|beta/)
  })

  it('includes CSV format example in guide', async () => {
    const req = createGetRequest('http://localhost/api/connectors/ingest/email?guide=true')

    const res = await GET(req)
    const body = await res.json()

    expect(body.guide.csvFormat.requiredColumns).toContain('Program')
    expect(body.guide.csvFormat.requiredColumns).toContain('Balance')
    expect(body.guide.csvFormat.optionalColumns).toContain('Program ID')
    expect(body.guide.csvFormat.example).toContain('Chase UR')
  })
})

describe('Email ingestion edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ENABLE_EMAIL_INGESTION
  })

  it('handles unknown action gracefully', async () => {
    const req = createPostRequest({ action: 'unknown_action' })

    const res = await POST(req)
    const body = await res.json()

    // Should return helpful placeholder status
    expect(res.status).toBe(200)
    expect(body.status.status).toBe('pending')
    expect(body.alternative).toBeDefined()
  })

  it('includes feature description in all responses', async () => {
    const req = createPostRequest({ action: 'check_status' })

    const res = await POST(req)
    const body = await res.json()

    expect(body.feature.description).toBeDefined()
    expect(body.feature.description).toContain('statement')
  })

  it('provides alternative CSV endpoint information', async () => {
    const req = createPostRequest({ action: 'check_status' })

    const res = await POST(req)
    const body = await res.json()

    expect(body.alternative.method).toBe('csv_import')
    expect(body.alternative.endpoint).toBe('/api/connectors/ingest/csv')
    expect(body.alternative.description).toContain('CSV')
  })
})
