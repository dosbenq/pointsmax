import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { GenericDatabase } from './supabase'

// Auth operations always use the Supabase REST API URL, never a DB pooler URL.
// SUPABASE_DB_URL_POOLED is a postgres:// connection string for direct DB access only.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<GenericDatabase>(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll called from a Server Component — cookies can't be set
            // from SC, but the middleware will refresh the session
          }
        },
      },
    }
  )
}
