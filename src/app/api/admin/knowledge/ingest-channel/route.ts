import { NextRequest, NextResponse } from 'next/server'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'
import { inngest } from '@/lib/inngest/client'
import {
  fetchLatestVideoUrls,
  getConfiguredKnowledgeChannelUrl,
  normalizeMaxVideos,
  resolveChannelId,
} from '@/lib/knowledge/channel-ingest'
import { isAllowedYouTubeChannelUrl } from '@/lib/knowledge/youtube'
import { getRequestId, logError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const authError = await requireAdmin(req)
  if (authError) return authError

  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    // empty body is fine
  }

  const bodyRecord = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const configuredChannelUrl = getConfiguredKnowledgeChannelUrl()
  const channelUrl = typeof bodyRecord.channel_url === 'string' && bodyRecord.channel_url.trim().length > 0
    ? bodyRecord.channel_url.trim()
    : configuredChannelUrl
  const maxVideos = normalizeMaxVideos(bodyRecord.max_videos)

  if (!channelUrl) {
    return NextResponse.json(
      { error: 'YOUTUBE_KNOWLEDGE_CHANNEL_URL is missing. Configure a default channel or provide channel_url.' },
      { status: 503 },
    )
  }

  if (!isAllowedYouTubeChannelUrl(channelUrl)) {
    return NextResponse.json(
      { error: 'channel_url must be a valid YouTube channel URL on youtube.com' },
      { status: 400 },
    )
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 503 })
  }

  if (!process.env.INNGEST_EVENT_KEY?.trim() && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'INNGEST_EVENT_KEY is missing' }, { status: 503 })
  }

  try {
    const channelId = await resolveChannelId(channelUrl)
    if (!channelId) {
      return NextResponse.json({ error: 'Unable to resolve YouTube channel id from URL' }, { status: 400 })
    }

    const videoUrls = await fetchLatestVideoUrls(channelId, maxVideos)
    if (videoUrls.length === 0) {
      return NextResponse.json({ error: 'No videos found in channel feed' }, { status: 404 })
    }

    const sendResult = await inngest.send({
      name: 'knowledge.ingest_youtube',
      data: {
        channel: channelUrl,
        channel_id: channelId,
        max_videos: maxVideos,
        video_urls: videoUrls,
        triggered_at: new Date().toISOString(),
      },
    })

    await logAdminAction('knowledge.ingest_channel', channelId, {
      channel_url: channelUrl,
      videos_enqueued: videoUrls.length,
    })

    return NextResponse.json({
      ok: true,
      channel_url: channelUrl,
      channel_id: channelId,
      enqueued_videos: videoUrls.length,
      videos: videoUrls,
      event_ids: Array.isArray(sendResult)
        ? sendResult
          .map((item) => (item && typeof item === 'object' && 'id' in item ? (item as { id?: unknown }).id : null))
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [],
    })
  } catch (error) {
    logError('admin_knowledge_ingest_channel_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to enqueue YouTube ingestion' }, { status: 500 })
  }
}
