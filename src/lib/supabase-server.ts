import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { GenericDatabase } from './supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const pooledUrl = process.env.SUPABASE_DB_URL_POOLED?.trim()
const serverClientUrl = pooledUrl && pooledUrl.startsWith('https://') ? pooledUrl : supabaseUrl

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<GenericDatabase>(
    serverClientUrl,
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
