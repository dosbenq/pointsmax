import fs from 'node:fs'
import path from 'node:path'

function loadDotEnv(filepath) {
  if (!fs.existsSync(filepath)) return
  for (const line of fs.readFileSync(filepath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

/** Resolve a direct Postgres connection string (Neon or Supabase). */
export function getDatabaseUrl() {
  loadDotEnv(path.join(process.cwd(), '.env.local'))
  loadDotEnv(path.join(process.cwd(), '.env'))
  const url = process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim()
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    console.error('Set DATABASE_URL (or SUPABASE_DB_URL) to a postgres:// connection string.')
    process.exit(1)
  }
  return url
}
