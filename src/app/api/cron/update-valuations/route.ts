import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'

const TPG_VALUATIONS_URL = 'https://thepointsguy.com/points-miles-valuations/'

type ProgramMapping = {
  key: string
  candidateSlugs: string[]
  aliases: string[]
}

type ProgramRow = {
  id: string
  slug: string
}

function isProgramRow(value: unknown): value is ProgramRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && typeof row.slug === 'string'
}

const PROGRAM_MAPPINGS: ProgramMapping[] = [
  {
    key: 'chase',
    candidateSlugs: ['chase-ur', 'chase-ultimate-rewards'],
    aliases: ['chase ultimate rewards', 'chase ultimate reward points', 'chase ur'],
  },
  {
    key: 'amex',
    candidateSlugs: ['amex-mr', 'amex-membership-rewards'],
    aliases: ['american express membership rewards', 'amex membership rewards', 'amex mr'],
  },
  {
    key: 'capital_one',
    candidateSlugs: ['capital-one-miles', 'capital-one'],
    aliases: ['capital one miles', 'capital one rewards', 'capital one'],
  },
  {
    key: 'citi',
    candidateSlugs: ['citi-thankyou', 'citi-thankyou-points'],
    aliases: ['citi thankyou points', 'citi thankyou'],
  },
  {
    key: 'bilt',
    candidateSlugs: ['bilt', 'bilt-rewards'],
    aliases: ['bilt rewards', 'bilt points'],
  },
  {
    key: 'united',
    candidateSlugs: ['united-miles', 'united', 'united-mileageplus'],
    aliases: ['united mileageplus', 'united miles', 'united airlines miles'],
  },
  {
    key: 'delta',
    candidateSlugs: ['delta-skymiles', 'delta', 'delta-skymiles-program'],
    aliases: ['delta skymiles', 'delta miles'],
  },
  {
    key: 'american',
    candidateSlugs: ['aa-miles', 'american', 'american-aadvantage'],
    aliases: ['american airlines aadvantage', 'aadvantage miles', 'american aadvantage'],
  },
  {
    key: 'southwest',
    candidateSlugs: ['southwest-points', 'southwest', 'southwest-rapid-rewards'],
    aliases: ['southwest rapid rewards', 'southwest points'],
  },
  {
    key: 'hyatt',
    candidateSlugs: ['hyatt-points', 'hyatt', 'world-of-hyatt'],
    aliases: ['world of hyatt', 'hyatt points'],
  },
  {
    key: 'hilton',
    candidateSlugs: ['hilton-honors', 'hilton', 'hilton-honors-program'],
    aliases: ['hilton honors', 'hilton points'],
  },
  {
    key: 'marriott',
    candidateSlugs: ['marriott-bonvoy', 'marriott'],
    aliases: ['marriott bonvoy', 'marriott points'],
  },
  {
    key: 'alaska',
    candidateSlugs: ['alaska-miles', 'alaska', 'alaska-mileage-plan'],
    aliases: ['alaska mileage plan', 'alaska miles'],
  },
  {
    key: 'jetblue',
    candidateSlugs: ['jetblue-points', 'jetblue', 'jetblue-trueblue'],
    aliases: ['jetblue trueblue', 'jetblue points'],
  },
]

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  return req.nextUrl.searchParams.get('secret') === secret
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCells(rowHtml: string): string[] {
  const cells: string[] = []
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
  let match: RegExpExecArray | null
  while ((match = cellRe.exec(rowHtml)) !== null) {
    cells.push(normalizeText(match[1]))
  }
  return cells
}

function parseCppCents(raw: string): number | null {
  const withUnit = raw.match(/(\d+(?:\.\d+)?)\s*(?:¢|cents?|cpp)\b/i)
  if (withUnit) {
    const value = Number.parseFloat(withUnit[1])
    if (Number.isFinite(value) && value > 0 && value < 100) return value
  }

  const decimalMatches = [...raw.matchAll(/\b(\d{1,2}\.\d{1,3})\b/g)]
  for (const match of decimalMatches) {
    const value = Number.parseFloat(match[1])
    if (Number.isFinite(value) && value >= 0.1 && value <= 20) return value
  }

  return null
}

function detectProgramKey(normalizedRow: string): string | null {
  for (const entry of PROGRAM_MAPPINGS) {
    if (entry.aliases.some(alias => normalizedRow.includes(alias))) {
      return entry.key
    }
  }
  return null
}

function parseValuationsFromHtml(html: string): {
  mapped: Map<string, number>
  unmapped: string[]
} {
  const mapped = new Map<string, number>()
  const unmapped = new Set<string>()
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []

  for (const rowHtml of rows) {
    const cells = extractCells(rowHtml)
    if (cells.length === 0) continue
    const rowText = cells.join(' | ')
    const programKey = detectProgramKey(rowText)
    const valueText = [...cells].reverse().join(' | ')
    const cpp = parseCppCents(valueText) ?? parseCppCents(rowText)

    if (!cpp) continue
    if (!programKey) {
      unmapped.add(rowText.slice(0, 90))
      continue
    }
    if (!mapped.has(programKey)) {
      mapped.set(programKey, cpp)
    }
  }

  return {
    mapped,
    unmapped: [...unmapped].slice(0, 20),
  }
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const startedAt = Date.now()

  if (!isAuthorized(req)) {
    logWarn('cron_update_valuations_unauthorized', { requestId })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let html = ''
  try {
    const response = await fetch(TPG_VALUATIONS_URL, { cache: 'no-store' })
    if (!response.ok) {
      logError('cron_update_valuations_fetch_failed', {
        requestId,
        status: response.status,
      })
      return NextResponse.json(
        { ok: false, error: 'parse failed', reason: 'tpg_fetch_failed' },
        { status: 200 },
      )
    }
    html = await response.text()
  } catch (error) {
    logError('cron_update_valuations_fetch_threw', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { ok: false, error: 'parse failed', reason: 'tpg_fetch_failed' },
      { status: 200 },
    )
  }

  const parsed = parseValuationsFromHtml(html)
  if (parsed.mapped.size === 0) {
    logWarn('cron_update_valuations_parse_failed', { requestId })
    return NextResponse.json(
      { ok: false, error: 'parse failed', updated: 0, skipped: 0, unmapped: [] },
      { status: 200 },
    )
  }

  const db = createAdminClient()
  const mappedProgramKeys = [...parsed.mapped.keys()]
  const today = new Date().toISOString().slice(0, 10)
  const candidateSlugs = [
    ...new Set(
      PROGRAM_MAPPINGS
        .filter((mapping) => mappedProgramKeys.includes(mapping.key))
        .flatMap((mapping) => mapping.candidateSlugs),
    ),
  ]

  // Skip India programs - they are handled by a separate scraper
  const indiaSlugs = ['hdfc-millennia', 'axis-edge', 'amex-india-mr', 'air-india', 'indigo-6e', 'taj-innercircle']

  const { data: programRows, error: programErr } = await db
    .from('programs')
    .select('id, slug')
    .in('slug', candidateSlugs)
    .eq('is_active', true)
    .not('slug', 'in', `(${indiaSlugs.join(',')})`)

  if (programErr) {
    logError('cron_update_valuations_program_lookup_failed', {
      requestId,
      error: programErr.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const normalizedProgramRows = ((programRows ?? []) as unknown[]).filter(isProgramRow)
  const programIdBySlug = new Map<string, string>(normalizedProgramRows.map((row) => [row.slug, row.id]))
  const programIdByKey = new Map<string, string>()
  const missingProgramKeys: string[] = []

  for (const mapping of PROGRAM_MAPPINGS) {
    if (!mappedProgramKeys.includes(mapping.key)) continue
    const matchedSlug = mapping.candidateSlugs.find((slug) => programIdBySlug.has(slug))
    if (!matchedSlug) {
      missingProgramKeys.push(mapping.key)
      continue
    }
    programIdByKey.set(mapping.key, programIdBySlug.get(matchedSlug)!)
  }

  const matchedProgramIds = [...programIdByKey.values()]

  let existingToday = new Set<string>()
  if (matchedProgramIds.length > 0) {
    const { data: existingRows, error: existingErr } = await db
      .from('valuations')
      .select('program_id')
      .eq('source', 'tpg')
      .eq('effective_date', today)
      .in('program_id', matchedProgramIds)

    if (existingErr) {
      logError('cron_update_valuations_existing_lookup_failed', {
        requestId,
        error: existingErr.message,
      })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const existingProgramIds = ((existingRows ?? []) as Array<{ program_id?: unknown }>)
      .map((row) => row.program_id)
      .filter((value): value is string => typeof value === 'string')
    existingToday = new Set(existingProgramIds)
  }

  const inserts = mappedProgramKeys
    .map((programKey) => {
      const programId = programIdByKey.get(programKey)
      if (!programId || existingToday.has(programId)) return null
      const cppCents = parsed.mapped.get(programKey)
      if (typeof cppCents !== 'number') return null
      return {
        program_id: programId,
        cpp_cents: cppCents,
        source: 'tpg' as const,
        source_url: TPG_VALUATIONS_URL,
        effective_date: today,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (inserts.length > 0) {
    const { error: insertErr } = await db.from('valuations').insert(inserts)
    if (insertErr) {
      logError('cron_update_valuations_insert_failed', {
        requestId,
        error: insertErr.message,
      })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    revalidateTag('valuations', 'max')
    revalidateTag('programmatic-cards', 'max')
    revalidateTag('programmatic-programs', 'max')
    revalidatePath('/us/cards')
    revalidatePath('/in/cards')
    revalidatePath('/us/programs')
    revalidatePath('/in/programs')
  }

  const skipped = mappedProgramKeys.length - inserts.length
  const unmapped = [
    ...missingProgramKeys.map((key) => `missing_program:${key}`),
    ...parsed.unmapped,
  ]

  // Log skipped India programs
  const skippedIndiaCount = candidateSlugs.filter(slug => indiaSlugs.includes(slug)).length
  if (skippedIndiaCount > 0) {
    logInfo('cron_update_valuations_skipped_india_programs', {
      requestId,
      count: skippedIndiaCount,
    })
  }

  logInfo('cron_update_valuations_complete', {
    requestId,
    parsed_rows: mappedProgramKeys.length,
    inserted_rows: inserts.length,
    skipped_rows: skipped,
    latency_ms: Date.now() - startedAt,
  })

  return NextResponse.json({
    ok: true,
    updated: inserts.length,
    skipped,
    unmapped,
    skipped_india_programs: skippedIndiaCount,
  })
}
