import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

vi.mock('@/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

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
  const makeCountQuery = (count: number) => {
    const result = Promise.resolve({ count, data: [], error: null })
    return {
      eq: vi.fn().mockResolvedValue({ count, data: [], error: null }),
      then: result.then.bind(result),
      catch: result.catch.bind(result),
      finally: result.finally.bind(result),
    }
  }

  const mockDb = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue(null)
    vi.mocked(createAdminClient).mockReturnValue(mockDb as never)
  })

  it('GET returns new health fields', async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'admin_audit_log') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              { action: 'workflow.healthcheck_trigger', created_at: new Date().toISOString() },
              { action: 'workflow.error', created_at: new Date().toISOString() },
            ],
            error: null,
          }),
        }
      }
      if (table === 'flight_watches') {
        return {
          select: vi.fn().mockImplementation(() => makeCountQuery(10)),
        }
      }
      if (table === 'knowledge_docs') {
        return {
          select: vi.fn().mockImplementation(() => makeCountQuery(4)),
        }
      }
      return {
        select: vi.fn().mockResolvedValue({ count: 0, data: [], error: null }),
        eq: vi.fn().mockReturnThis(),
      }
    })

    const req = new NextRequest('http://localhost/api/admin/workflow-health')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.workflow).toHaveProperty('queue_depth')
    expect(data.workflow).toHaveProperty('failed_runs_24h')
    expect(data.workflow).toHaveProperty('last_success_at')
    expect(data.workflow.failed_runs_24h).toBeGreaterThanOrEqual(0)
  })

  it('POST with retry action returns correct response', async () => {
    const req = new NextRequest('http://localhost/api/admin/workflow-health', {
      method: 'POST',
      body: JSON.stringify({ action: 'retry' }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.message).toContain('Retry action logged')
  })
})
