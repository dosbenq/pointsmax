import { getTableColumns, type Column } from 'drizzle-orm'
import { getViewConfig, PgView, type PgTable } from 'drizzle-orm/pg-core'

type SnakeCase<S extends string> = S extends `${infer H}${infer T}`
  ? `${H extends Lowercase<H> ? H : `_${Lowercase<H>}`}${SnakeCase<T>}`
  : S

type ColumnsOf<T> = T extends PgTable ? T['_']['columns'] : T extends PgView ? T['_']['selectedFields'] : never

export type SnakeColumns<T> = { [K in keyof ColumnsOf<T> as SnakeCase<K & string>]: ColumnsOf<T>[K] }

/**
 * Select every column of a table or view keyed by its database (snake_case)
 * name, matching the row shape the app used with Supabase's select('*').
 *   db.select(columnsOf(programs)).from(programs)
 */
export function columnsOf<T extends PgTable | PgView>(source: T): SnakeColumns<T> {
  const fields = source instanceof PgView
    ? (getViewConfig(source).selectedFields as Record<string, Column>)
    : (getTableColumns(source as PgTable) as Record<string, Column>)
  const out: Record<string, Column> = {}
  for (const column of Object.values(fields)) out[column.name] = column
  return out as SnakeColumns<T>
}
