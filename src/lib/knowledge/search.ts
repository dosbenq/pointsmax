import { and, cosineDistance, desc, gt, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { knowledgeDocs } from '@/lib/db/schema'
import { logWarn } from '@/lib/logger'

export type KnowledgeChunk = {
  id: string
  source_id?: string
  source_url?: string
  title?: string
  content: string
  similarity?: number
}

/**
 * Nearest knowledge chunks by cosine similarity (pgvector). Replaces the
 * search_knowledge_docs database function. Returns [] on any failure.
 */
export async function searchKnowledgeDocs(queryVector: number[], requestId: string): Promise<KnowledgeChunk[]> {
  try {
    const similarity = sql<number>`1 - (${cosineDistance(knowledgeDocs.embedding, queryVector)})`
    const rows = await getDb()
      .select({
        id: knowledgeDocs.id,
        source_id: knowledgeDocs.sourceId,
        source_url: knowledgeDocs.sourceUrl,
        title: knowledgeDocs.title,
        content: knowledgeDocs.content,
        similarity,
      })
      .from(knowledgeDocs)
      .where(and(isNotNull(knowledgeDocs.embedding), gt(similarity, 0.45)))
      .orderBy(desc(similarity))
      .limit(6)

    const chunks = rows
      .map((row) => ({
        id: row.id,
        source_id: row.source_id ?? undefined,
        source_url: row.source_url ?? undefined,
        title: row.title ?? undefined,
        content: row.content ?? '',
        similarity: Number(row.similarity),
      }))
      .filter((row) => row.id && row.content)
    if (chunks.length > 0) return chunks
    logWarn('expert_chat_knowledge_context_unavailable', { requestId, rpc_error: null, rpc_rows: 0 })
  } catch (error) {
    logWarn('expert_chat_knowledge_context_unavailable', {
      requestId,
      rpc_error: error instanceof Error ? error.message : String(error),
      rpc_rows: 0,
    })
  }
  return []
}
