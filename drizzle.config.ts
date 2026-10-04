import { defineConfig } from 'drizzle-kit'

// Schema changes: edit src/lib/db/schema.ts, then `npm run db:generate` to write
// a migration into db/migrations and `npm run db:migrate` to apply it.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
