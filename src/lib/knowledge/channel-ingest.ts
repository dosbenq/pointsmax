import {
  extractYouTubeChannelId,
  parseYouTubeFeedVideoUrls,
} from '@/lib/knowledge/youtube'

const DEFAULT_MAX_VIDEOS = 15
const MAX_ALLOWED_VIDEOS = 40

export function normalizeMaxVideos(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_VIDEOS
  return Math.min(Math.floor(parsed), MAX_ALLOWED_VIDEOS)
}

export function getDefaultKnowledgeChannelUrl(): string {
  return process.env.YOUTUBE_KNOWLEDGE_CHANNEL_URL?.trim()
    || 'https://www.youtube.com/@GreatIndianMiles'
}

export function getDefaultKnowledgeMaxVideos(): number {
  return normalizeMaxVideos(process.env.YOUTUBE_KNOWLEDGE_MAX_VIDEOS)
}

function channelFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
}

export async function resolveChannelId(channelUrl: string): Promise<string | null> {
  const response = await fetch(channelUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'PointsMaxKnowledgeAgent/1.0 (+https://pointsmax.com)',
    },
    cache: 'no-store',
  })
  if (!response.ok) return null
  const html = await response.text()
  return extractYouTubeChannelId(html)
}

export async function fetchLatestVideoUrls(channelId: string, maxVideos: number): Promise<string[]> {
  const response = await fetch(channelFeedUrl(channelId), {
    method: 'GET',
    headers: {
      'User-Agent': 'PointsMaxKnowledgeAgent/1.0 (+https://pointsmax.com)',
      Accept: 'application/atom+xml,text/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
  })
  if (!response.ok) return []
  const xml = await response.text()
  return parseYouTubeFeedVideoUrls(xml).slice(0, maxVideos)
}
