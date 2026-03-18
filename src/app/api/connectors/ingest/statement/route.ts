import { NextRequest, NextResponse } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { badRequest, internalError } from '@/lib/error-utils'
import { logError, logInfo } from '@/lib/logger'
import { type ProgramAliasRow } from '@/lib/connectors/program-matcher'
import { parseStatementText } from '@/lib/connectors/statement-parser/text-parser'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const MAX_STATEMENT_BODY_BYTES = 20_000
const MAX_STATEMENT_TEXT_CHARS = 10_000

type ProgramRow = {
  id: string
  name: string
  slug: string
}

async function loadProgramsAndAliases(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<{ programs: ProgramRow[]; aliases: ProgramAliasRow[] }> {
  const [{ data: programs, error: programsError }, { data: aliases, error: aliasesError }] = await Promise.all([
    supabase.from('programs').select('id, name, slug').eq('is_active', true),
    supabase.from('program_name_aliases').select('alias, program_slug'),
  ])

  if (programsError) {
    throw new Error(`Failed to load programs: ${programsError.message}`)
  }

  const aliasRows = aliasesError?.code === '42P01'
    ? []
    : (((aliases ?? []) as ProgramAliasRow[]))

  return {
    programs: ((programs ?? []) as ProgramRow[]),
    aliases: aliasRows,
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()

  const sizeError = enforceJsonContentLength(req, MAX_STATEMENT_BODY_BYTES)
  if (sizeError) return sizeError

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'statement_ingest_ip',
    maxRequests: 20,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON')
  }

  const text = typeof (body as { text?: unknown } | null)?.text === 'string'
    ? (body as { text: string }).text
    : ''

  if (!text.trim()) {
    return badRequest('text is required')
  }
  if (text.length > MAX_STATEMENT_TEXT_CHARS) {
    return badRequest(`text must be ${MAX_STATEMENT_TEXT_CHARS} characters or fewer`)
  }

  try {
    const { programs, aliases } = await loadProgramsAndAliases(supabase)
    const candidates = parseStatementText(text, programs, aliases)

    logInfo('statement_ingest_parsed', {
      requestId,
      userId: user.id,
      candidates: candidates.length,
      matchedCount: candidates.filter((candidate) => candidate.program_id !== null).length,
    })

    return NextResponse.json({
      candidates,
      matched_count: candidates.filter((candidate) => candidate.program_id !== null).length,
      unmatched_count: candidates.filter((candidate) => candidate.program_id === null).length,
    })
  } catch (error) {
    logError('statement_ingest_failed', {
      requestId,
      userId: user.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return internalError('Failed to parse statement text')
  }
}
