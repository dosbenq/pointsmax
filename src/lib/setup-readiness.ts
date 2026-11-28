import { hasDatabaseUrl } from '@/lib/db/url'

/** Which deployment settings for the database and sign-in move are present. Never values. */
export function getSetupReadiness() {
  const present = (key: string) => Boolean(process.env[key]?.trim())
  return {
    database_url: hasDatabaseUrl(),
    google_oauth: present('GOOGLE_CLIENT_ID') && present('GOOGLE_CLIENT_SECRET'),
    auth_secret: (process.env.BETTER_AUTH_SECRET?.trim().length ?? 0) >= 32,
  }
}
