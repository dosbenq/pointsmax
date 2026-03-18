import { matchProgramByName, type ProgramAliasRow } from '@/lib/connectors/program-matcher'

type ProgramRow = {
  id: string
  name: string
  slug: string
}

export type TextParseCandidate = {
  raw_line: string
  balance: number
  program_hint: string
  program_id: string | null
  program_matched_name: string | null
  confidence: 'exact' | 'alias' | 'fuzzy' | null
}

const MAX_TEXT_LENGTH = 10_000
const KEYWORD_RE =
  /\b(balance|points?|miles?|reward|rewards|membership rewards|thankyou|thank you|skymiles|mileageplus|aadvantage|aeroplan|krisflyer|hyatt|bonvoy|hilton|hdfc|axis|icici|amex|chase|united|delta|air india|indigo)\b/i
const AMOUNT_RE = /\b(?:\d{1,2}(?:,\d{2})+,\d{3}|\d{1,3}(?:,\d{3})+|\d+)\b/g
const BALANCE_CONTEXT_RE =
  /\b(balance|available|ending|current|closing|points?|miles?|rewards?|membership rewards|thankyou|skymiles|mileageplus|aadvantage|aeroplan|krisflyer|bluchip)\b/i
const SPEND_CONTEXT_RE =
  /\b(spend|spent|purchase|purchases|annual fee|fee|statement|paid|payment|credit limit|available credit|limit|year to date|ytd)\b/i
const CURRENCY_PREFIX_RE = /[$₹£€]\s*$/

function parseBalanceToken(value: string): number | null {
  if (!value.trim()) return null
  const normalized = value.includes(',') ? value.replace(/,/g, '') : value
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function chooseBalanceToken(line: string): string | null {
  const matches = [...line.matchAll(AMOUNT_RE)]
    .map((match) => ({
      value: match[0],
      index: match.index ?? line.indexOf(match[0]),
    }))
    .filter((entry) => {
      const before = line.slice(Math.max(0, entry.index - 2), entry.index)
      return !CURRENCY_PREFIX_RE.test(before)
    })

  if (matches.length === 0) return null

  const parsed = matches
    .map((entry) => {
      const amount = parseBalanceToken(entry.value)
      if (amount === null) return null

      const before = line.slice(Math.max(0, entry.index - 32), entry.index)
      const after = line.slice(entry.index + entry.value.length, Math.min(line.length, entry.index + entry.value.length + 32))
      const context = `${before} ${after}`

      let score = 0
      if (BALANCE_CONTEXT_RE.test(context)) score += 6
      if (SPEND_CONTEXT_RE.test(context)) score -= 8
      if (CURRENCY_PREFIX_RE.test(before)) score -= 10
      if (/^[\s:()-]*[$₹£€]/.test(after)) score -= 10

      return { value: entry.value, amount, score, index: entry.index }
    })
    .filter((entry): entry is { value: string; amount: number; score: number; index: number } => entry !== null)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      if (left.amount !== right.amount) return right.amount - left.amount
      return left.index - right.index
    })

  return parsed[0]?.value ?? null
}

function buildProgramHint(rawLine: string, amountToken: string): string {
  return rawLine
    .replace(amountToken, ' ')
    .replace(/®/g, ' ')
    .replace(/\([^)]*\b(spend|spent|purchase|payment|fee|credit limit|year to date|ytd)\b[^)]*\)/gi, ' ')
    .replace(/[$₹£€]\s*[\d,]+/g, ' ')
    .replace(/\b(points?|miles?|balance|available)\b/gi, ' ')
    .replace(/[:()\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupeCandidates(candidates: TextParseCandidate[]): TextParseCandidate[] {
  const byKey = new Map<string, TextParseCandidate>()

  for (const candidate of candidates) {
    const key = candidate.program_id ?? candidate.program_hint.toLowerCase()
    const existing = byKey.get(key)
    if (!existing || candidate.balance > existing.balance) {
      byKey.set(key, candidate)
    }
  }

  return [...byKey.values()]
}

export function parseStatementText(
  text: string,
  programs: ProgramRow[],
  aliasRows: ProgramAliasRow[] = [],
): TextParseCandidate[] {
  const truncated = text.slice(0, MAX_TEXT_LENGTH)
  const candidates: TextParseCandidate[] = []

  for (const rawLine of truncated.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0) continue
    if (!KEYWORD_RE.test(line)) continue
    if (/\$\s*\d/.test(line)) continue

    const amountToken = chooseBalanceToken(line)
    if (!amountToken) continue

    const balance = parseBalanceToken(amountToken)
    if (balance === null) continue

    const programHint = buildProgramHint(line, amountToken)
    if (!programHint) continue

    const match = matchProgramByName(programHint, programs, aliasRows)
    candidates.push({
      raw_line: line,
      balance,
      program_hint: programHint,
      program_id: match?.program_id ?? null,
      program_matched_name: match?.program_name ?? null,
      confidence: match?.confidence ?? null,
    })
  }

  return dedupeCandidates(candidates)
}
