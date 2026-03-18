import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireAdminMock = vi.fn()
const logAdminActionMock = vi.fn()
const sendMock = vi.fn()
const resolveChannelIdMock = vi.fn()
const fetchLatestVideoUrlsMock = vi.fn()
const getConfiguredKnowledgeChannelUrlMock = vi.fn()
const normalizeMaxVideosMock = vi.fn((value: unknown) => Number(value) || 15)

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: requireAdminMock,
  logAdminAction: logAdminActionMock,
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: sendMock,
  },
}))

vi.mock('@/lib/knowledge/channel-ingest', () => ({
  fetchLatestVideoUrls: fetchLatestVideoUrlsMock,
  getConfiguredKnowledgeChannelUrl: getConfiguredKnowledgeChannelUrlMock,
  normalizeMaxVideos: normalizeMaxVideosMock,
  resolveChannelId: resolveChannelIdMock,
}))

vi.mock('@/lib/logger', () => ({
  getRequestId: () => 'req-test',
  logError: vi.fn(),
}))

const { POST } = await import('./route')

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest('https://pointsmax.com/api/admin/knowledge/ingest-channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  })
}

describe('POST /api/admin/knowledge/ingest-channel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(null)
    process.env.GEMINI_API_KEY = 'gemini-key'
    process.env.INNGEST_EVENT_KEY = 'event-key'
    process.env.NODE_ENV = 'test'
    getConfiguredKnowledgeChannelUrlMock.mockReturnValue('https://www.youtube.com/@GreatIndianMiles')
    resolveChannelIdMock.mockResolvedValue('UCabc123abc123abc123ab')
    fetchLatestVideoUrlsMock.mockResolvedValue(['https://www.youtube.com/watch?v=abcDEF12345'])
    sendMock.mockResolvedValue([{ id: 'evt_1' }])
  })

  it('rejects non-youtube channel URLs before any fetch occurs', async () => {
    const res = await POST(makeRequest({ channel_url: 'https://example.com/@not-youtube' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('youtube.com')
    expect(resolveChannelIdMock).not.toHaveBeenCalled()
  })

  it('enqueues ingestion for valid youtube channel URLs', async () => {
    const res = await POST(makeRequest({ channel_url: 'https://www.youtube.com/@GreatIndianMiles', max_videos: 10 }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.channel_id).toBe('UCabc123abc123abc123ab')
    expect(body.enqueued_videos).toBe(1)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(logAdminActionMock).toHaveBeenCalledTimes(1)
  })
})
