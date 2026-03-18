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

type AliasTarget = {
  slugs: string[]
  aliases: string[]
}

const ALIAS_TARGETS: AliasTarget[] = [
  {
    slugs: ['chase-ultimate-rewards'],
    aliases: ['chase ur', 'chase ultimate rewards', 'chase sapphire', 'chase points', 'chase'],
  },
  {
    slugs: ['amex-membership-rewards'],
    aliases: ['amex mr', 'amex membership rewards', 'american express membership rewards', 'american express', 'amex'],
  },
  {
    slugs: ['citi-thankyou-rewards', 'citi-thankyou'],
    aliases: ['citi thankyou', 'citi thank you', 'thankyou points', 'citi ty', 'citi'],
  },
  {
    slugs: ['capital-one-miles'],
    aliases: ['capital one', 'capital one miles', 'venture miles', 'venture'],
  },
  {
    slugs: ['bilt-rewards'],
    aliases: ['bilt', 'bilt rewards'],
  },
  {
    slugs: ['wells-fargo-rewards'],
    aliases: ['wells fargo', 'wells fargo rewards', 'autograph rewards'],
  },
  {
    slugs: ['united-mileageplus', 'united-mileage-plus'],
    aliases: ['united', 'mileageplus', 'united mileage plus'],
  },
  {
    slugs: ['delta-skymiles', 'delta'],
    aliases: ['delta', 'delta skymiles', 'skymiles'],
  },
  {
    slugs: ['american-airlines-aadvantage', 'aadvantage'],
    aliases: ['american airlines', 'aadvantage', 'aa miles', 'american aadvantage'],
  },
  {
    slugs: ['southwest-rapid-rewards'],
    aliases: ['southwest', 'rapid rewards'],
  },
  {
    slugs: ['alaska-mileage-plan'],
    aliases: ['alaska', 'alaska airlines', 'mileage plan'],
  },
  {
    slugs: ['jetblue-trueblue'],
    aliases: ['jetblue', 'trueblue'],
  },
  {
    slugs: ['british-airways-avios'],
    aliases: ['avios', 'british airways', 'ba avios', 'british airways avios'],
  },
  {
    slugs: ['aeroplan', 'air-canada-aeroplan'],
    aliases: ['aeroplan', 'air canada aeroplan', 'air canada'],
  },
  {
    slugs: ['krisflyer', 'singapore-krisflyer'],
    aliases: ['krisflyer', 'singapore airlines', 'singapore krisflyer', 'singapore'],
  },
  {
    slugs: ['flying-blue'],
    aliases: ['flying blue', 'air france klm', 'air france', 'klm'],
  },
  {
    slugs: ['world-of-hyatt'],
    aliases: ['hyatt', 'world of hyatt'],
  },
  {
    slugs: ['marriott-bonvoy'],
    aliases: ['marriott', 'bonvoy', 'marriott bonvoy'],
  },
  {
    slugs: ['hilton-honors'],
    aliases: ['hilton', 'hilton honors'],
  },
  {
    slugs: ['hdfc-reward-points', 'hdfc-rewards', 'hdfc-smartbuy-rewards', 'hdfc-diners-club-rewards', 'hdfc-regalia-rewards'],
    aliases: ['hdfc', 'hdfc rewards', 'hdfc bank', 'hdfc smartbuy', 'hdfc diners', 'hdfc regalia'],
  },
  {
    slugs: ['axis-edge-rewards', 'axis-edge-miles', 'axis-edge'],
    aliases: ['axis', 'axis bank', 'axis edge', 'axis edge rewards', 'axis miles'],
  },
  {
    slugs: ['icici-rewards', 'icici-payback'],
    aliases: ['icici', 'icici bank', 'payback', 'icici rewards', 'icici payback'],
  },
  {
    slugs: ['air-india-maharaja-club', 'air-india'],
    aliases: ['air india', 'maharaja club', 'flying returns', 'air india maharaja club'],
  },
  {
    slugs: ['indigo-bluchip', 'indigo-6e-rewards', 'indigo-6e'],
    aliases: ['indigo', '6e rewards', 'indigo bluchip', 'bluchip'],
  },
  {
    slugs: ['amex-membership-rewards-india', 'amex-india-mr'],
    aliases: ['amex india', 'amex india mr', 'american express india'],
  },
]

const STOP_TOKENS = new Set([
  'bank',
  'card',
  'club',
  'express',
  'india',
  'miles',
  'points',
  'program',
  'rewards',
  'the',
])

function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/®/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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
  programsBySlug: Map<string, ProgramRow>,
  aliasRows: ProgramAliasRow[],
): Map<string, ProgramRow> {
  const aliasMap = new Map<string, ProgramRow>()

  for (const target of ALIAS_TARGETS) {
    const program = findProgramByTargetSlugs(target.slugs, programsBySlug)
    if (!program) continue
    for (const alias of target.aliases) {
      aliasMap.set(normalizeValue(alias), program)
    }
  }

  for (const row of aliasRows) {
    const program = programsBySlug.get(slugifyValue(row.program_slug))
    if (!program) continue
    aliasMap.set(normalizeValue(row.alias), program)
  }

  return aliasMap
}

function buildProgramSearchStrings(program: ProgramRow): string[] {
  return [program.name, program.slug]
}

function scoreProgramFuzzyMatch(inputTokens: string[], program: ProgramRow): number {
  const programTokens = new Set(
    buildProgramSearchStrings(program)
      .flatMap((value) => tokenize(value)),
  )
  if (inputTokens.length === 0 || programTokens.size === 0) return 0

  const overlap = inputTokens.filter((token) => programTokens.has(token))
  return overlap.length / inputTokens.length
}

export function matchProgramByName(
  input: string,
  programs: ProgramRow[],
  aliasRows: ProgramAliasRow[] = [],
): ProgramMatchResult | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const normalized = normalizeValue(trimmed)
  const slugified = slugifyValue(trimmed)
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

  const aliasMap = buildAliasMap(programsBySlug, aliasRows)
  const aliasMatch = aliasMap.get(normalized)
  if (aliasMatch) {
    return {
      program_id: aliasMatch.id,
      program_name: aliasMatch.name,
      confidence: 'alias',
    }
  }

  const normalizedTokenCount = tokenize(trimmed).length
  const partialAliasMatch = [...aliasMap.entries()]
    .filter(([alias]) => {
      const aliasTokenCount = alias.split(' ').filter(Boolean).length
      if (aliasTokenCount < 2 && normalizedTokenCount > 2) return false
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

  const inputTokens = tokenize(trimmed)
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
