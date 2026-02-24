import crypto from 'node:crypto'
import { inngest } from '../client'
import { YoutubeTranscript } from 'youtube-transcript'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createAdminClient } from '@/lib/supabase'
import { getGeminiModelCandidatesForApiKey, markGeminiModelUnavailable } from '@/lib/gemini-models'
import { chunkText, parseYouTubeVideoId } from '@/lib/knowledge/youtube'

/**
 * The YouTube Learner Agent
 * 
 * Capability:
 * 1. Fetches transcripts from a list of video URLs.
 * 2. Uses Gemini to "learn" concepts (summarize & extraction).
 * 3. Generates embeddings and stores them in the Knowledge Base.
 */
export const youtubeLearner = inngest.createFunction(
  { id: 'youtube-learner', name: 'Agent: YouTube Learner' },
  { event: 'knowledge.ingest_youtube' },
  async ({ event, step }) => {
    const { video_urls, channel } = event.data as {
      video_urls?: string[]
      channel?: string
    }
    if (!video_urls || !Array.isArray(video_urls)) {
      return { message: 'No video_urls provided' }
    }

    const db = createAdminClient()
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY missing')
    const genAI = new GoogleGenerativeAI(apiKey)
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })

    const results = []
    const uniqueUrls = [...new Set(video_urls)]

    for (const url of uniqueUrls) {
      const videoId = parseYouTubeVideoId(url)
      if (!videoId) {
        results.push({ url, status: 'invalid_url' })
        continue
      }

      // 1. Fetch Transcript
      const fullText = await step.run(`fetch-transcript-${videoId}`, async () => {
        try {
          const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)
          return transcriptItems.map(item => item.text).join(' ')
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e)
          console.error(`Failed to fetch transcript for ${videoId}:`, err)
          return null
        }
      })

      if (!fullText) {
        results.push({ url, status: 'no_transcript' })
        continue
      }

      // 2. Process & Chunk with Gemini (Conceptual Learning)
      // We ask Gemini to break the video into "Knowledge Chunks" that are self-contained.
      const chunks = await step.run(`process-concepts-${videoId}`, async () => {
        const models = await getGeminiModelCandidatesForApiKey(apiKey)

        for (const modelName of models) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName })
            const prompt = `
You are an expert credit card analyst.
Extract atomic knowledge concepts from this transcript.
Return JSON only: an array of 3-12 self-contained factual strings.

Transcript:
${fullText.slice(0, 30000)}
            `.trim()
            const result = await model.generateContent(prompt)
            const responseText = result.response.text()
            const jsonMatch = responseText.match(/\[[\s\S]*\]/)?.[0] ?? '[]'
            const parsed = JSON.parse(jsonMatch)
            if (Array.isArray(parsed)) {
              const cleaned = parsed
                .map((item) => (typeof item === 'string' ? item.replace(/\s+/g, ' ').trim() : ''))
                .filter(Boolean)
              if (cleaned.length > 0) return cleaned
            }
          } catch (err) {
            markGeminiModelUnavailable(modelName, err)
          }
        }

        // Deterministic fallback if generation fails: chunk transcript directly.
        return chunkText(fullText, 1000).slice(0, 12)
      })

      // 3. Embed & Store
      await step.run(`embed-store-${videoId}`, async () => {
        for (const chunk of chunks) {
          // Generate embedding
          const normalized = chunk.replace(/\s+/g, ' ').trim()
          if (!normalized) continue
          const embeddingResult = await embeddingModel.embedContent(normalized)
          const vector = embeddingResult.embedding.values
          const contentHash = crypto.createHash('sha256').update(normalized).digest('hex')

          // Store in Postgres
          await db.from('knowledge_docs').upsert({
            source_id: `youtube:${videoId}`,
            source_url: url,
            title: `Learning from Video ${videoId}`,
            content: normalized,
            embedding: vector,
            content_hash: contentHash,
            metadata: {
              ingested_at: new Date().toISOString(),
              type: 'youtube_transcript',
              channel: channel ?? '@GreatIndianMiles',
            },
          }, {
            onConflict: 'source_id,content_hash',
            ignoreDuplicates: false,
          })
        }
      })

      results.push({ url, status: 'success', concepts: chunks.length })
    }

    return {
      message: 'Ingestion complete',
      channel: channel ?? '@GreatIndianMiles',
      processed: uniqueUrls.length,
      results,
    }
  }
)
