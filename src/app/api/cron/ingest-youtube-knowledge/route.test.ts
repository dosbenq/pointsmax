import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: sendMock,
  },
}))

const resolveChannelIdMock = vi.fn()
const fetchLatestVideoUrlsMock = vi.fn()
const getConfiguredKnowledgeChannelUrlMock = vi.fn()
const getDefaultKnowledgeMaxVideosMock = vi.fn()

vi.mock('@/lib/knowledge/channel-ingest', () => ({
  resolveChannelId: resolveChannelIdMock,
  fetchLatestVideoUrls: fetchLatestVideoUrlsMock,
  getConfiguredKnowledgeChannelUrl: getConfiguredKnowledgeChannelUrlMock,
  getDefaultKnowledgeMaxVideos: getDefaultKnowledgeMaxVideosMock,
}))

const { GET } = await import('./route')

function makeRequest(opts?: { authHeader?: string; secretParam?: string }) {
  const url = opts?.secretParam
    ? `https://pointsmax.com/api/cron/ingest-youtube-knowledge?secret=${encodeURIComponent(opts.secretParam)}`
    : 'https://pointsmax.com/api/cron/ingest-youtube-knowledge'
  return new Request(url, {
    headers: opts?.authHeader ? { authorization: opts.authHeader } : undefined,
  })
}

describe('GET /api/cron/ingest-youtube-knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.GEMINI_API_KEY = 'gemini-key'
    process.env.INNGEST_EVENT_KEY = 'event-key'
    process.env.NODE_ENV = 'test'

    getConfiguredKnowledgeChannelUrlMock.mockReturnValue('https://www.youtube.com/@GreatIndianMiles')
    getDefaultKnowledgeMaxVideosMock.mockReturnValue(15)
    resolveChannelIdMock.mockResolvedValue('UCabc123abc123abc123ab')
    fetchLatestVideoUrlsMock.mockResolvedValue([
      'https://www.youtube.com/watch?v=abcDEF12345',
      'https://www.youtube.com/watch?v=defABC67890',
    ])
    sendMock.mockResolvedValue([{ id: 'evt_1' }])
  })

  it('returns 401 when unauthorized', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('rejects query-param auth even when the secret matches', async () => {
    const res = await GET(makeRequest({ secretParam: 'cron-secret' }))
    expect(res.status).toBe(401)
  })

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY
    const res = await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.error).toContain('GEMINI_API_KEY')
  })

  it('returns 503 when no knowledge channel is configured', async () => {
    getConfiguredKnowledgeChannelUrlMock.mockReturnValue(null)

    const res = await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toContain('YOUTUBE_KNOWLEDGE_CHANNEL_URL')
  })

  it('enqueues ingestion when authorized and configured', async () => {
    const res = await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.channel_id).toBe('UCabc123abc123abc123ab')
    expect(body.enqueued_videos).toBe(2)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'knowledge.ingest_youtube',
        data: expect.objectContaining({
          channel: 'https://www.youtube.com/@GreatIndianMiles',
          channel_id: 'UCabc123abc123abc123ab',
        }),
      }),
    )
  })
})
