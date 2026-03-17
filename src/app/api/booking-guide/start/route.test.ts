import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'
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

describe('/api/booking-guide/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INNGEST_EVENT_KEY = 'event-key'
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
    )
  })

  it('creates a booking guide session and starts the workflow', async () => {
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
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'session-1',
                  user_id: 'user-1',
                  redemption_label: 'Transfer Chase to Hyatt',
                  status: 'pending',
                  current_step_index: 0,
                  total_steps: 0,
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
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })
    vi.mocked(inngest.send).mockResolvedValue([{ id: 'evt-1' }] as never)

    const res = await POST(new NextRequest('http://localhost/api/booking-guide/start', {
      method: 'POST',
      body: JSON.stringify({ redemption_label: 'Transfer Chase to Hyatt' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(
      expect.objectContaining({
        ok: true,
        event_ids: ['evt-1'],
        session: expect.objectContaining({
          id: 'session-1',
          status: 'pending',
          redemption_label: 'Transfer Chase to Hyatt',
        }),
      }),
    )
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'booking.started',
        data: expect.objectContaining({
          session_id: 'session-1',
          user_id: 'user-1',
          booking_context: null,
        }),
      }),
    )
  })

  it('sanitizes and forwards structured booking context to the workflow event', async () => {
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
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'session-1',
                  user_id: 'user-1',
                  redemption_label: 'Transfer Chase to Hyatt',
                  status: 'pending',
                  current_step_index: 0,
                  total_steps: 0,
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
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })
    vi.mocked(inngest.send).mockResolvedValue([{ id: 'evt-1' }] as never)

    const res = await POST(new NextRequest('http://localhost/api/booking-guide/start', {
      method: 'POST',
      body: JSON.stringify({
        redemption_label: 'Transfer Chase to Hyatt',
        booking_context: {
          origin: 'jfk',
          destination: 'cdg',
          cabin: 'business',
          passengers: 2,
          start_date: '2026-06-01',
          end_date: '2026-06-10',
          program_name: 'World of Hyatt',
          estimated_miles: 60000,
          points_needed_from_wallet: 60000,
          transfer_chain: 'Chase Ultimate Rewards → World of Hyatt',
          transfer_is_instant: true,
          has_real_availability: true,
          availability_date: '2026-06-02',
          deep_link_label: 'Hyatt',
          deep_link_url: 'https://www.hyatt.com/',
          balances: [
            { program_name: 'Chase Ultimate Rewards', balance: 80000 },
            { program_name: 'Invalid', balance: -1 },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(res.status).toBe(200)
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          booking_context: {
            origin: 'JFK',
            destination: 'CDG',
            cabin: 'business',
            passengers: 2,
            start_date: '2026-06-01',
            end_date: '2026-06-10',
            program_name: 'World of Hyatt',
            estimated_miles: 60000,
            points_needed_from_wallet: 60000,
            transfer_chain: 'Chase Ultimate Rewards → World of Hyatt',
            transfer_is_instant: true,
            has_real_availability: true,
            availability_date: '2026-06-02',
            deep_link_label: 'Hyatt',
            deep_link_url: 'https://www.hyatt.com/',
            balances: [{ program_name: 'Chase Ultimate Rewards', balance: 80000 }],
          },
        }),
      }),
    )
  })

  it('returns a session with steps and current step', async () => {
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
                    id: 'session-1',
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
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: 'step-0', session_id: 'session-1', step_index: 0, title: 'Find saver space', status: 'completed', completion_note: null, completed_at: null, created_at: '', updated_at: '' },
                  { id: 'step-1', session_id: 'session-1', step_index: 1, title: 'Transfer points', status: 'current', completion_note: null, completed_at: null, created_at: '', updated_at: '' },
                ],
                error: null,
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await GET(new NextRequest('http://localhost/api/booking-guide/start?session_id=11111111-1111-1111-1111-111111111111'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(
      expect.objectContaining({
        session: expect.objectContaining({ id: 'session-1', status: 'active' }),
        current_step: expect.objectContaining({ step_index: 1, title: 'Transfer points' }),
      }),
    )
  })
})
