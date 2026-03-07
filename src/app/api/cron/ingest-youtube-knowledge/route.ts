import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import {
  fetchLatestVideoUrls,
  getConfiguredKnowledgeChannelUrl,
  getDefaultKnowledgeMaxVideos,
  resolveChannelId,
} from '@/lib/knowledge/channel-ingest'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  const url = new URL(req.url)
  return url.searchParams.get('secret') === secret
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)

  if (!isAuthorized(req)) {
    logWarn('cron_ingest_youtube_knowledge_unauthorized', { requestId })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    logWarn('cron_ingest_youtube_knowledge_missing_gemini_key', { requestId })
    return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 503 })
  }

  if (!process.env.INNGEST_EVENT_KEY?.trim() && process.env.NODE_ENV === 'production') {
    logWarn('cron_ingest_youtube_knowledge_missing_inngest_key', { requestId })
    return NextResponse.json({ error: 'INNGEST_EVENT_KEY is missing' }, { status: 503 })
  }

  const channelUrl = getConfiguredKnowledgeChannelUrl()
  const maxVideos = getDefaultKnowledgeMaxVideos()

  if (!channelUrl) {
    logWarn('cron_ingest_youtube_knowledge_missing_channel_url', { requestId })
    return NextResponse.json({ error: 'YOUTUBE_KNOWLEDGE_CHANNEL_URL is missing' }, { status: 503 })
  }

  try {
    const channelId = await resolveChannelId(channelUrl)
    if (!channelId) {
      logWarn('cron_ingest_youtube_knowledge_channel_not_resolved', { requestId, channelUrl })
      return NextResponse.json({ ok: false, error: 'Unable to resolve channel id' }, { status: 200 })
    }

    const videoUrls = await fetchLatestVideoUrls(channelId, maxVideos)
    if (videoUrls.length === 0) {
      logWarn('cron_ingest_youtube_knowledge_no_videos', { requestId, channelId, channelUrl })
      return NextResponse.json({ ok: false, error: 'No videos found in channel feed' }, { status: 200 })
    }

    const sendResult = await inngest.send({
      name: 'knowledge.ingest_youtube',
      data: {
        channel: channelUrl,
        channel_id: channelId,
        max_videos: maxVideos,
        video_urls: videoUrls,
        triggered_by: 'cron',
        triggered_at: new Date().toISOString(),
      },
    })

    const eventIds = Array.isArray(sendResult)
      ? sendResult
        .map((item) => (item && typeof item === 'object' && 'id' in item ? (item as { id?: unknown }).id : null))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []

    logInfo('cron_ingest_youtube_knowledge_enqueued', {
      requestId,
      channelUrl,
      channelId,
      videos: videoUrls.length,
      events: eventIds.length,
    })

    return NextResponse.json({
      ok: true,
      channel_url: channelUrl,
      channel_id: channelId,
      enqueued_videos: videoUrls.length,
      event_ids: eventIds,
    })
  } catch (error) {
    logError('cron_ingest_youtube_knowledge_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to enqueue YouTube ingestion' }, { status: 500 })
  }
}
