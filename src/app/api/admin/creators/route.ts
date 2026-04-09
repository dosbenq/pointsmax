import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

type CreateCreatorBody = {
  name?: unknown
  slug?: unknown
  platform?: unknown
  profile_url?: unknown
}

function normalizeSlug(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()
  const { data, error } = await db
    .from('creators')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    logError('admin_creators_list_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ creators: data ?? [] })
}

export async function POST(req: Request) {
  const { error: authError, adminEmail } = await requireAdmin(req)
  if (authError) return authError

  let body: CreateCreatorBody
  try {
    body = (await req.json()) as CreateCreatorBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const slug = normalizeSlug(body.slug)
  const platform = typeof body.platform === 'string' ? body.platform.trim() : null
  const profileUrl = typeof body.profile_url === 'string' ? body.profile_url.trim() : null

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!slug) return NextResponse.json({ error: 'slug is required (letters, numbers, hyphen)' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('creators').insert({
    name,
    slug,
    platform,
    profile_url: profileUrl,
  } as never)

  if (error) {
    logError('admin_creator_create_failed', { error: error.message, slug })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  await logAdminAction('creator.create', slug, {
    name,
    platform,
    profile_url: profileUrl,
  }, adminEmail!)

  return NextResponse.json({ ok: true })
}
