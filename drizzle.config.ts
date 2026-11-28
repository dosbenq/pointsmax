import { defineConfig } from 'drizzle-kit'

// Schema changes: edit src/lib/db/schema.ts, then run `npm run db:generate`.
// That writes a SQL migration into db/migrations and re-embeds the migrations
// in src/lib/db/migrations.generated.ts; the app applies pending ones itself.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './db/migrations',
})
