import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { creators } from '@/lib/db/schema'
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

  try {
    const rows = await getDb().select(columnsOf(creators)).from(creators).orderBy(desc(creators.createdAt))
    return NextResponse.json({ creators: rows })
  } catch (error) {
    logError('admin_creators_list_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
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

  const db = getDb()

  // Check slug uniqueness before creating
  const [existing] = await db.select({ id: creators.id }).from(creators).where(eq(creators.slug, slug)).limit(1)

  if (existing) {
    return NextResponse.json(
      { error: `Creator with slug "${slug}" already exists` },
      { status: 409 }
    )
  }

  try {
    await db.insert(creators).values({ name, slug, platform, profileUrl })
  } catch (error) {
    logError('admin_creator_create_failed', { error: error instanceof Error ? error.message : String(error), slug })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  await logAdminAction('creator.create', slug, {
    name,
    platform,
    profile_url: profileUrl,
  }, adminEmail!)

  return NextResponse.json({ ok: true })
}
