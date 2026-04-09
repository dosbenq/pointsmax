import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

type CreateValuationBody = {
  program_slug?: unknown
  cpp_cents?: unknown
  notes?: unknown
}

type ProgramLookupRow = {
  id: string
  slug: string
}

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()
  const { data, error } = await db
    .from('latest_valuations')
    .select('*')
    .order('program_name')

  if (error) {
    logError('admin_valuations_get_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ valuations: data ?? [] })
}

export async function POST(request: Request) {
  const { error: authError, adminEmail } = await requireAdmin(request)
  if (authError) return authError

  let body: CreateValuationBody
  try {
    body = (await request.json()) as CreateValuationBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const programSlug = typeof body.program_slug === 'string' ? body.program_slug.trim() : ''
  const cppCents = Number(body.cpp_cents)
  const notes = typeof body.notes === 'string' ? body.notes.trim() : null

  if (!programSlug) {
    return NextResponse.json({ error: 'program_slug is required' }, { status: 400 })
  }
  if (!Number.isFinite(cppCents) || cppCents <= 0 || cppCents > 100) {
    return NextResponse.json({ error: 'cpp_cents must be a number between 0 and 100' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: programData, error: programErr } = await db
    .from('programs')
    .select('id, slug')
    .eq('slug', programSlug)
    .eq('is_active', true)
    .single()

  const program = (programData ?? null) as ProgramLookupRow | null
  if (programErr || !program) {
    return NextResponse.json({ error: 'Unknown program_slug' }, { status: 400 })
  }

  const effectiveDate = new Date().toISOString().slice(0, 10)
  const { error: insertErr } = await db.from('valuations').insert({
    program_id: program.id,
    cpp_cents: cppCents,
    source: 'manual',
    effective_date: effectiveDate,
    notes: notes || null,
  } as never)

  if (insertErr) {
    logError('admin_valuations_insert_failed', {
      program_slug: programSlug,
      error: insertErr.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  await logAdminAction('valuation.manual_insert', program.id, {
    program_slug: programSlug,
    cpp_cents: cppCents,
    notes,
  }, adminEmail!)

  return NextResponse.json({ ok: true })
}
