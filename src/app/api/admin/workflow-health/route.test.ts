// @vitest-environment node
import { afterAll, describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { setDbForTesting } from '@/lib/db/client'
import { adminAuditLog, flightWatches, knowledgeDocs } from '@/lib/db/schema'
import { createTestDb, seedUser, type TestDb } from '@/test/utils/test-db'

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(),
  logAdminAction: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getRequestId: vi.fn(() => 'test-request-id'),
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue([{ id: 'test-event-id' }]),
  },
}))

describe('Workflow Health API', () => {
  let db: TestDb

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({ error: null, adminEmail: 'admin@test.com' })
    db = await createTestDb()
    setDbForTesting(db)
  })

  afterAll(() => setDbForTesting(null))

  it('GET returns new health fields', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project-ref.supabase.co'

    const pat = await seedUser(db, 'pat')
    await db.insert(flightWatches).values([
      { userId: pat.userId, origin: 'JFK', destination: 'CDG', startDate: '2026-11-01', endDate: '2026-11-30' },
      { userId: pat.userId, origin: 'JFK', destination: 'LHR', startDate: '2026-11-01', endDate: '2026-11-30', isActive: false },
    ])
    await db.insert(knowledgeDocs).values({ sourceId: 's', sourceUrl: 'https://x', title: 't', content: 'c', contentHash: 'h' })
    await db.insert(adminAuditLog).values([
      { adminEmail: 'admin@test.com', action: 'workflow.healthcheck_trigger' },
      { adminEmail: 'admin@test.com', action: 'workflow.error' },
    ])

    const req = new NextRequest('http://localhost/api/admin/workflow-health')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.workflow).toHaveProperty('failed_runs_24h')
    expect(data.workflow.failed_runs_24h).toBe(1) // workflow.error
    expect(data.db).toMatchObject({ total_watches: 2, active_watches: 1, knowledge_docs_count: 1, errors: [] })
    expect(data.workflow).toHaveProperty('last_success_at')
    expect(data.auth_branding).toEqual(expect.objectContaining({
      configured: true,
      using_supabase_domain: true,
    }))
    expect(data.knowledge_channel).toEqual(expect.objectContaining({
      configured: false,
      url: null,
    }))
  })

  it('POST sends a healthcheck event', async () => {
    const req = new NextRequest('http://localhost/api/admin/workflow-health', { method: 'POST' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.message).toContain('Healthcheck event sent')
  })
})
