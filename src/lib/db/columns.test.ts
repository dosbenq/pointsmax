// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { columnsOf } from './columns'
import { latestValuations, programs } from './schema'
import { createTestDb, seedPrograms } from '@/test/utils/test-db'

describe('columnsOf', () => {
  it('selects tables and views with snake_case keys', async () => {
    const db = await createTestDb()
    await seedPrograms(db, [{ key: 'chase-ur', cpp: 2.05 }])

    const [program] = await db.select(columnsOf(programs)).from(programs)
    expect(program).toMatchObject({ slug: 'chase-ur', short_name: 'chase-ur', is_active: true, display_order: 0 })
    expect(program).not.toHaveProperty('shortName')

    const [valuation] = await db.select(columnsOf(latestValuations)).from(latestValuations)
    expect(valuation).toMatchObject({ program_slug: 'chase-ur', cpp_cents: 2.05, effective_date: '2026-04-09' })
  }, 30_000)
})
