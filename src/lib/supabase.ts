import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const pooledUrl = process.env.SUPABASE_DB_URL_POOLED?.trim()
const dbUrl = pooledUrl && pooledUrl.startsWith('https://') ? pooledUrl : supabaseUrl
type GenericSupabaseClient = ReturnType<typeof createClient<any>>

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local')
}

let publicClientSingleton: GenericSupabaseClient | null = null
let adminClientSingleton: GenericSupabaseClient | null = null

// Server-side public client (anon key, respects RLS)
export function createPublicClient(): GenericSupabaseClient {
  if (!publicClientSingleton) {
    publicClientSingleton = createClient<any>(dbUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return publicClientSingleton
}

// Server-side client (uses service role key, bypasses RLS — admin only)
export function createAdminClient(): GenericSupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not set — admin client unavailable')
  }
  if (!adminClientSingleton) {
    adminClientSingleton = createClient<any>(dbUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return adminClientSingleton
}

// Best-effort server DB client:
// prefer service-role for internal APIs, fallback to anon for environments
// where SUPABASE_SERVICE_ROLE_KEY is intentionally not configured.
export function createServerDbClient(): GenericSupabaseClient {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : createPublicClient()
}
