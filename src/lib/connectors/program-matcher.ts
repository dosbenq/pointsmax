import { PROGRAM_ALIAS_TARGETS, normalizeAliasValue } from '@/lib/program-aliases'

type ProgramRow = {
  id: string
  name: string
  slug: string
}

export type ProgramAliasRow = {
  alias: string
  program_slug: string
}

export type ProgramMatchResult = {
  program_id: string
  program_name: string
  confidence: 'exact' | 'alias' | 'fuzzy'
}

const STOP_TOKENS = new Set([
  'bank',
  'card',
  'club',
  'miles',
  'points',
  'program',
  'rewards',
  'the',
])

const PROGRAM_SPECIFIC_ALIAS_TOKENS = new Set([
  'aadvantage',
  'aeroplan',
  'avios',
  'bluchip',
  'bonvoy',
  'edge',
  'flying',
  'hilton',
  'honors',
  'hyatt',
  'krisflyer',
  'maharaja',
  'mileageplus',
  'miles',
  'points',
  'rapid',
  'regalia',
  'rewards',
  'skymiles',
  'smartbuy',
  'thankyou',
  'trueblue',
])

const aliasMapCache = new WeakMap<ProgramRow[], Map<ProgramAliasRow[] | '__default__', Map<string, ProgramRow>>>()

function normalizeValue(value: string): string {
  return normalizeAliasValue(value)
}

function stripDecorativeQualifiers(value: string): string {
  return value.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
}

function slugifyValue(value: string): string {
  return normalizeValue(value).replace(/\s+/g, '-')
}

function tokenize(value: string): string[] {
  return normalizeValue(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_TOKENS.has(token))
}

function buildProgramBySlug(programs: ProgramRow[]): Map<string, ProgramRow> {
  return new Map(programs.map((program) => [slugifyValue(program.slug), program]))
}

function findProgramByTargetSlugs(targetSlugs: string[], programsBySlug: Map<string, ProgramRow>): ProgramRow | null {
  for (const slug of targetSlugs) {
    const match = programsBySlug.get(slugifyValue(slug))
    if (match) return match
  }
  return null
}

function buildAliasMap(
  programs: ProgramRow[],
  programsBySlug: Map<string, ProgramRow>,
  aliasRows: ProgramAliasRow[],
): Map<string, ProgramRow> {
  const aliasRowsKey = aliasRows.length === 0 ? '__default__' : aliasRows
  const cachedByPrograms = aliasMapCache.get(programs)
  const cached = cachedByPrograms?.get(aliasRowsKey)
  if (cached) return cached

  const aliasMap = new Map<string, ProgramRow>()

  for (const target of PROGRAM_ALIAS_TARGETS) {
    const program = findProgramByTargetSlugs(target.slugs, programsBySlug)
    if (!program) continue
    for (const alias of target.aliases) {
      aliasMap.set(normalizeValue(alias), program)
    }
  }

  for (const row of aliasRows) {
    const program = programsBySlug.get(slugifyValue(row.program_slug))
    if (!program) continue
    if (aliasMap.has(normalizeValue(row.alias))) continue
    aliasMap.set(normalizeValue(row.alias), program)
  }

  const nextCachedByPrograms =
    cachedByPrograms ?? new Map<ProgramAliasRow[] | '__default__', Map<string, ProgramRow>>()
  nextCachedByPrograms.set(aliasRowsKey, aliasMap)
  aliasMapCache.set(programs, nextCachedByPrograms)

  return aliasMap
}

function buildProgramSearchStrings(program: ProgramRow): string[] {
  return [program.name, program.slug]
}

function aliasHasProgramSpecificToken(alias: string): boolean {
  return alias
    .split(' ')
    .some((token) => PROGRAM_SPECIFIC_ALIAS_TOKENS.has(token))
}

function scoreProgramFuzzyMatch(inputTokens: string[], program: ProgramRow): number {
  const programTokens = new Set(
    buildProgramSearchStrings(program)
      .flatMap((value) => tokenize(value)),
  )
  if (inputTokens.length === 0 || programTokens.size === 0) return 0

  const overlapCount = inputTokens.filter((token) => programTokens.has(token)).length
  if (overlapCount === 0) return 0

  const precision = overlapCount / inputTokens.length
  const recall = overlapCount / programTokens.size
  if (precision + recall === 0) return 0

  return (2 * precision * recall) / (precision + recall)
}

export function matchProgramByName(
  input: string,
  programs: ProgramRow[],
  aliasRows: ProgramAliasRow[] = [],
): ProgramMatchResult | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const cleaned = stripDecorativeQualifiers(trimmed)
  const normalized = normalizeValue(cleaned)
  const slugified = slugifyValue(cleaned)
  const programsBySlug = buildProgramBySlug(programs)

  const exactBySlug = programsBySlug.get(slugified)
  if (exactBySlug) {
    return {
      program_id: exactBySlug.id,
      program_name: exactBySlug.name,
      confidence: 'exact',
    }
  }

  const exactByName = programs.find((program) => normalizeValue(program.name) === normalized)
  if (exactByName) {
    return {
      program_id: exactByName.id,
      program_name: exactByName.name,
      confidence: 'exact',
    }
  }

  const aliasMap = buildAliasMap(programs, programsBySlug, aliasRows)
  const aliasMatch = aliasMap.get(normalized)
  if (aliasMatch) {
    return {
      program_id: aliasMatch.id,
      program_name: aliasMatch.name,
      confidence: 'alias',
    }
  }

  const inputTokens = tokenize(cleaned)
  if (inputTokens.length < 2) return null

  const normalizedTokenCount = inputTokens.length
  const partialAliasMatch = [...aliasMap.entries()]
    .filter(([alias]) => {
      const aliasTokenCount = alias.split(' ').filter(Boolean).length
      if (aliasTokenCount < 2 && normalizedTokenCount > 2) return false
      if (normalizedTokenCount > aliasTokenCount + 1 && !aliasHasProgramSpecificToken(alias)) return false
      return normalized.includes(alias) || alias.includes(normalized)
    })
    .sort((left, right) => right[0].length - left[0].length)[0]?.[1]

  if (partialAliasMatch) {
    return {
      program_id: partialAliasMatch.id,
      program_name: partialAliasMatch.name,
      confidence: 'alias',
    }
  }

  let bestMatch: ProgramRow | null = null
  let bestScore = 0

  for (const program of programs) {
    const score = scoreProgramFuzzyMatch(inputTokens, program)
    if (score > bestScore) {
      bestScore = score
      bestMatch = program
    }
  }

  if (!bestMatch || bestScore < 0.6) return null

  return {
    program_id: bestMatch.id,
    program_name: bestMatch.name,
    confidence: 'fuzzy',
  }
}
