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

function parseBalanceToken(value: string): number | null {
  if (!value.trim()) return null
  const normalized = value.includes(',') ? value.replace(/,/g, '') : value
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function chooseBalanceToken(line: string): string | null {
  const matches = [...line.matchAll(AMOUNT_RE)]
    .map((match) => match[0])
    .filter((value) => !line.slice(0, line.indexOf(value)).trim().endsWith('$'))

  if (matches.length === 0) return null

  const parsed = matches
    .map((value) => ({ value, amount: parseBalanceToken(value) }))
    .filter((entry): entry is { value: string; amount: number } => entry.amount !== null)
    .sort((left, right) => right.amount - left.amount)

  return parsed[0]?.value ?? null
}

function buildProgramHint(rawLine: string, amountToken: string): string {
  return rawLine
    .replace(amountToken, ' ')
    .replace(/®/g, ' ')
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
