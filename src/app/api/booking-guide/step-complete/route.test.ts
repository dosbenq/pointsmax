import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

vi.mock('@/lib/supabase-server')
vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}))
vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))
vi.mock('@/lib/logger', () => ({
  getRequestId: vi.fn(() => 'req-1'),
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

describe('/api/booking-guide/step-complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INNGEST_EVENT_KEY = 'event-key'
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
    )
  })

  it('requires a valid session id', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } } })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await POST(new NextRequest('http://localhost/api/booking-guide/step-complete', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'bad-id' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'session_id is required and must be a valid UUID' })
  })

  it('sends a session-scoped completion event for the current step', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } } })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
            }),
          }),
        }
      }

      if (table === 'booking_guide_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: '11111111-1111-1111-1111-111111111111',
                    user_id: 'user-1',
                    redemption_label: 'Transfer Chase to Hyatt',
                    status: 'active',
                    current_step_index: 1,
                    total_steps: 3,
                    started_at: '2026-03-13T12:00:00.000Z',
                    completed_at: null,
                    last_error: null,
                    created_at: '2026-03-13T12:00:00.000Z',
                    updated_at: '2026-03-13T12:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'booking_guide_steps') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'step-1', step_index: 1 },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })
    vi.mocked(inngest.send).mockResolvedValue([{ id: 'evt-2' }] as never)

    const res = await POST(new NextRequest('http://localhost/api/booking-guide/step-complete', {
      method: 'POST',
      body: JSON.stringify({
        session_id: '11111111-1111-1111-1111-111111111111',
        note: 'Done',
      }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      session_id: '11111111-1111-1111-1111-111111111111',
      event_ids: ['evt-2'],
    })
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'booking.step_completed',
        data: expect.objectContaining({
          session_id: '11111111-1111-1111-1111-111111111111',
          step_index: 1,
          note: 'Done',
        }),
      }),
    )
  })
})
