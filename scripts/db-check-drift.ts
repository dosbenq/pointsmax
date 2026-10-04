// Compare the Drizzle schema (src/lib/db/schema.ts) with a live database and
// list tables/columns the app expects but the database lacks (or vice versa).
//   DATABASE_URL=postgres://... npm run db:check-drift
import { getTableConfig, getViewConfig, PgTable, PgView } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import * as schema from '../src/lib/db/schema'
import { getDatabaseUrl } from './lib/database-url.mjs'

async function main() {
  const sql = postgres(getDatabaseUrl(), { max: 1, prepare: false, onnotice: () => {} })
  try {
    const rows = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns where table_schema = 'public'`
    const live = new Map<string, Set<string>>()
    for (const r of rows) live.set(r.table_name, (live.get(r.table_name) ?? new Set()).add(r.column_name))

    const problems: string[] = []
    const expected = new Set<string>()
    for (const value of Object.values(schema)) {
      let name: string | undefined
      let columns: string[] = []
      if (value instanceof PgTable) {
        const cfg = getTableConfig(value)
        name = cfg.name
        columns = cfg.columns.map((c) => c.name)
      } else if (value instanceof PgView) {
        const cfg = getViewConfig(value)
        name = cfg.name
        columns = Object.values(cfg.selectedFields).map((f) => (f as { name: string }).name)
      }
      if (!name) continue
      expected.add(name)
      const have = live.get(name)
      if (!have) { problems.push(`missing table/view: ${name}`); continue }
      for (const col of columns) if (!have.has(col)) problems.push(`missing column: ${name}.${col}`)
    }
    const extra = [...live.keys()].filter((t) => !expected.has(t)).sort()

    if (problems.length === 0) console.log('✓ Every table and column in the schema exists in the database.')
    else console.log(problems.map((p) => `✗ ${p}`).join('\n'))
    if (extra.length > 0) console.log(`\nIn the database but not in the schema (ignored by the app): ${extra.join(', ')}`)
    process.exitCode = problems.length > 0 ? 1 : 0
  } finally {
    await sql.end()
  }
}

void main()
