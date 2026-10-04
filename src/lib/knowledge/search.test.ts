// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { setDbForTesting } from '@/lib/db/client'
import { knowledgeDocs } from '@/lib/db/schema'
import { createTestDb, type TestDb } from '@/test/utils/test-db'
import { searchKnowledgeDocs } from './search'

const DIM = 768
const unit = (axis: number) => Array.from({ length: DIM }, (_, i) => (i === axis ? 1 : 0))
const blend = (a: number, b: number, wa: number) =>
  Array.from({ length: DIM }, (_, i) => (i === a ? wa : i === b ? Math.sqrt(1 - wa * wa) : 0))

let db: TestDb

beforeAll(async () => {
  db = await createTestDb()
  setDbForTesting(db)
  await db.insert(knowledgeDocs).values([
    { sourceId: 'v1', sourceUrl: 'https://youtu.be/1', title: 'Hyatt sweet spots', content: 'Use Chase to Hyatt', embedding: unit(0), contentHash: 'h1' },
    { sourceId: 'v2', sourceUrl: 'https://youtu.be/2', title: 'Close match', content: 'Mostly about Hyatt', embedding: blend(0, 1, 0.8), contentHash: 'h2' },
    { sourceId: 'v3', sourceUrl: 'https://youtu.be/3', title: 'Unrelated', content: 'Air India status', embedding: unit(2), contentHash: 'h3' },
    { sourceId: 'v4', sourceUrl: 'https://youtu.be/4', title: 'No vector', content: 'Not embedded yet', contentHash: 'h4' },
  ])
}, 60_000)

afterAll(() => setDbForTesting(null))

describe('searchKnowledgeDocs', () => {
  it('returns chunks above the similarity threshold, most similar first', async () => {
    const chunks = await searchKnowledgeDocs(unit(0), 'req-1')
    expect(chunks.map((c) => c.title)).toEqual(['Hyatt sweet spots', 'Close match'])
    expect(chunks[0].similarity).toBeCloseTo(1, 5)
    expect(chunks[1].similarity).toBeCloseTo(0.8, 5)
  })

  it('returns an empty list when the search fails', async () => {
    await db.execute(sql`alter table knowledge_docs rename to knowledge_docs_gone`)
    expect(await searchKnowledgeDocs(unit(0), 'req-2')).toEqual([])
    await db.execute(sql`alter table knowledge_docs_gone rename to knowledge_docs`)
  })
})
