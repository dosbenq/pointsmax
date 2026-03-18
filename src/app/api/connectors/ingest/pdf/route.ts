import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/api-security'
import { badRequest, internalError } from '@/lib/error-utils'
import { logError, logInfo } from '@/lib/logger'
import type { ProgramAliasRow } from '@/lib/connectors/program-matcher'
import { extractFromPdf } from '@/lib/connectors/statement-parser/pdf-extractor'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const MAX_PDF_BYTES = 5 * 1024 * 1024

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

  return {
    programs: ((programs ?? []) as ProgramRow[]),
    aliases: aliasesError?.code === '42P01' ? [] : ((aliases ?? []) as ProgramAliasRow[]),
  }
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'pdf_ingest_ip',
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return badRequest('file is required')
    }
    if (!isPdfFile(file)) {
      return badRequest('file must be a PDF')
    }
    if (file.size > MAX_PDF_BYTES) {
      return badRequest('file must be 5MB or smaller')
    }

    const { programs, aliases } = await loadProgramsAndAliases(supabase)
    const buffer = Buffer.from(await file.arrayBuffer())
    const extracted = await extractFromPdf(buffer, programs, aliases)

    if (!extracted.ok) {
      return NextResponse.json(
        { error: extracted.error, code: 'PDF_PARSE_FAILED' },
        { status: 422 },
      )
    }

    logInfo('pdf_ingest_parsed', {
      requestId,
      userId: user.id,
      candidates: extracted.candidates.length,
      pages: extracted.page_count,
    })

    return NextResponse.json({
      candidates: extracted.candidates,
      matched_count: extracted.candidates.filter((candidate) => candidate.program_id !== null).length,
      unmatched_count: extracted.candidates.filter((candidate) => candidate.program_id === null).length,
      page_count: extracted.page_count,
    })
  } catch (error) {
    logError('pdf_ingest_failed', {
      requestId,
      userId: user.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return internalError('Failed to parse PDF statement')
  }
}
