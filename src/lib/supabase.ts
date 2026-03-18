import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const pooledUrl = process.env.SUPABASE_DB_URL_POOLED?.trim()
const dbUrl = pooledUrl && pooledUrl.startsWith('https://') ? pooledUrl : supabaseUrl

type GenericTableShape = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
}

type GenericRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type GenericViewShape = {
  Row: Record<string, unknown>
  Insert?: Record<string, unknown>
  Update?: Record<string, unknown>
  Relationships: GenericRelationship[]
}

type GenericFunctionShape = {
  Args: Record<string, unknown> | never
  Returns: unknown
  SetofOptions?: {
    isSetofReturn?: boolean
    isOneToOne?: boolean
    isNotNullable?: boolean
    to: string
    from: string
  }
}

type GenericDatabase = {
  public: {
    Tables: Record<string, GenericTableShape>
    Views: Record<string, GenericViewShape>
    Functions: Record<string, GenericFunctionShape>
  }
}

export type { GenericDatabase }

type GenericSupabaseClient = ReturnType<typeof createClient<GenericDatabase>>

// Warn but don't throw - allows build to complete even without env vars
// Runtime checks will handle missing client gracefully
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Check .env.local - some features will be disabled')
}

export function hasConfiguredPublicSupabaseEnv(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

let publicClientSingleton: GenericSupabaseClient | null = null
let adminClientSingleton: GenericSupabaseClient | null = null

// Server-side public client (anon key, respects RLS)
export function createPublicClient(): GenericSupabaseClient {
  if (!hasConfiguredPublicSupabaseEnv()) {
    throw new Error('Public Supabase client unavailable: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }
  if (!publicClientSingleton) {
    publicClientSingleton = createClient<GenericDatabase>(dbUrl, supabaseAnonKey, {
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
    adminClientSingleton = createClient<GenericDatabase>(dbUrl, serviceRoleKey, {
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
