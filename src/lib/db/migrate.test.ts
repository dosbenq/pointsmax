// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema'
import type { Database } from './client'
import { applyMigrations } from './migrate'
import { MIGRATIONS } from './migrations.generated'
// @ts-expect-error -- plain ESM script without type declarations
import { readMigrations, renderModule } from '../../../scripts/db-embed-migrations.mjs'

function freshDb(): Database {
  return drizzle(new PGlite(), { schema }) as unknown as Database
}

describe('embedded migrations', () => {
  it('match the SQL files in db/migrations (run `npm run db:generate`)', () => {
    const dir = path.resolve(__dirname, '../../../db/migrations')
    const generated = fs.readFileSync(path.resolve(__dirname, 'migrations.generated.ts'), 'utf8')
    expect(generated).toBe(renderModule(readMigrations(dir)))
  })
})

describe('applyMigrations', () => {
  it('creates the schema once and is a no-op afterwards', async () => {
    const db = freshDb()

    const first = await applyMigrations(db)
    expect(first.applied).toEqual(MIGRATIONS.map((m) => m.tag))

    const second = await applyMigrations(db)
    expect(second.applied).toEqual([])

    const tables = await db.execute(sql`select table_name from information_schema.tables where table_schema = 'public'`)
    const names = (tables as unknown as { rows: { table_name: string }[] }).rows.map((r) => r.table_name)
    expect(names).toEqual(expect.arrayContaining(['users', 'user_balances', 'auth_user', 'data_imports', 'app_schema_migrations']))
  })

  it('refuses to run when an applied migration was edited', async () => {
    const db = freshDb()
    await applyMigrations(db)
    const edited = MIGRATIONS.map((m, i) => (i === 0 ? { ...m, hash: 'changed' } : m))
    await expect(applyMigrations(db, edited)).rejects.toThrow(/edited after it was applied/)
  })

  it('stores emails lowercase only', async () => {
    const db = freshDb()
    await applyMigrations(db)
    await expect(db.insert(schema.users).values({ email: 'Mixed@Example.com' })).rejects.toThrow()
    await db.insert(schema.users).values({ email: 'mixed@example.com' })
  })
})
