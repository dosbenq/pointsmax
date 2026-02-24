const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
])

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/

export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  if (YOUTUBE_ID_RE.test(raw)) return raw

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null

  const v = parsed.searchParams.get('v')
  if (v && YOUTUBE_ID_RE.test(v)) return v

  const path = parsed.pathname.replace(/^\/+/, '')
  const segments = path.split('/').filter(Boolean)

  if (parsed.hostname.includes('youtu.be') && segments[0] && YOUTUBE_ID_RE.test(segments[0])) {
    return segments[0]
  }

  const shortsIdx = segments.indexOf('shorts')
  if (shortsIdx >= 0 && segments[shortsIdx + 1] && YOUTUBE_ID_RE.test(segments[shortsIdx + 1])) {
    return segments[shortsIdx + 1]
  }

  const liveIdx = segments.indexOf('live')
  if (liveIdx >= 0 && segments[liveIdx + 1] && YOUTUBE_ID_RE.test(segments[liveIdx + 1])) {
    return segments[liveIdx + 1]
  }

  return null
}

export function canonicalYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function chunkText(input: string, maxChars = 1200): string[] {
  const text = input.replace(/\s+/g, ' ').trim()
  if (!text) return []
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let cursor = 0

  while (cursor < text.length) {
    const remaining = text.length - cursor
    if (remaining <= maxChars) {
      chunks.push(text.slice(cursor).trim())
      break
    }

    let end = cursor + maxChars
    const windowStart = Math.max(cursor + Math.floor(maxChars * 0.6), cursor + 1)
    const preferredBreak = text.lastIndexOf('. ', end)
    if (preferredBreak >= windowStart) {
      end = preferredBreak + 1
    } else {
      const whitespaceBreak = text.lastIndexOf(' ', end)
      if (whitespaceBreak >= windowStart) end = whitespaceBreak
    }

    chunks.push(text.slice(cursor, end).trim())
    cursor = end
  }

  return chunks.filter(Boolean)
}

export function parseYouTubeFeedVideoUrls(xml: string): string[] {
  const urls: string[] = []
  const re = /<link\s+rel="alternate"\s+href="([^"]+)"\s*\/>/g
  let match: RegExpExecArray | null = re.exec(xml)
  while (match) {
    const url = match[1]
    const id = parseYouTubeVideoId(url)
    if (id) urls.push(canonicalYouTubeWatchUrl(id))
    match = re.exec(xml)
  }
  return [...new Set(urls)]
}

export function extractYouTubeChannelId(html: string): string | null {
  const re = /"channelId":"(UC[\w-]{20,})"/
  const match = html.match(re)
  return match?.[1] ?? null
}
