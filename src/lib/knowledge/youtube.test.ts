import { describe, expect, it } from 'vitest'
import {
  chunkText,
  extractYouTubeChannelId,
  isAllowedYouTubeChannelUrl,
  parseYouTubeFeedVideoUrls,
  parseYouTubeVideoId,
} from './youtube'

describe('youtube knowledge helpers', () => {
  it('parses youtube ids across url formats', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=abcDEF12345')).toBe('abcDEF12345')
    expect(parseYouTubeVideoId('https://youtu.be/abcDEF12345')).toBe('abcDEF12345')
    expect(parseYouTubeVideoId('https://www.youtube.com/shorts/abcDEF12345')).toBe('abcDEF12345')
    expect(parseYouTubeVideoId('abcDEF12345')).toBe('abcDEF12345')
    expect(parseYouTubeVideoId('https://example.com/watch?v=abcDEF12345')).toBeNull()
  })

  it('parses video urls from atom feed', () => {
    const xml = `
      <feed>
        <entry>
          <link rel="alternate" href="https://www.youtube.com/watch?v=abcDEF12345" />
        </entry>
        <entry>
          <link rel="alternate" href="https://youtu.be/abcDEF12345" />
        </entry>
      </feed>
    `

    expect(parseYouTubeFeedVideoUrls(xml)).toEqual([
      'https://www.youtube.com/watch?v=abcDEF12345',
    ])
  })

  it('extracts channel id and chunks long text', () => {
    const html = '<script>var ytData = {"channelId":"UCabcd1234abcd1234abcd12"};</script>'
    expect(extractYouTubeChannelId(html)).toBe('UCabcd1234abcd1234abcd12')

    const input = 'A '.repeat(900)
    const chunks = chunkText(input, 300)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.length <= 300)).toBe(true)
  })

  it('only allows youtube channel URLs for channel ingestion', () => {
    expect(isAllowedYouTubeChannelUrl('https://www.youtube.com/@GreatIndianMiles')).toBe(true)
    expect(isAllowedYouTubeChannelUrl('https://www.youtube.com/channel/UCabcd1234abcd1234abcd12')).toBe(true)
    expect(isAllowedYouTubeChannelUrl('https://example.com/@GreatIndianMiles')).toBe(false)
    expect(isAllowedYouTubeChannelUrl('http://www.youtube.com/@GreatIndianMiles')).toBe(false)
    expect(isAllowedYouTubeChannelUrl('https://www.youtube.com/watch?v=abcDEF12345')).toBe(false)
  })
})
