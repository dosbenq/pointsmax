// The one place that decides which Postgres the app talks to. Vercel's Neon
// integration sets DATABASE_URL (pooled) and POSTGRES_URL; either works.
export function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || null
}

export function hasDatabaseUrl(): boolean {
  return getDatabaseUrl() !== null
}
