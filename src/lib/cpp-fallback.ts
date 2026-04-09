// TPG April 2026 per-program fallbacks (cents per point)
const TPG_APRIL_2026_CPP: Record<string, number> = {
  'chase-ultimate-rewards': 2.05,
  'amex-membership-rewards': 2.00,
  'capital-one-miles': 1.85,
  'citi-thankyou': 1.90,
  'bilt-rewards': 2.20,
  'united-mileageplus': 1.35,
  'delta-skymiles': 1.20,
  'american-airlines-aadvantage': 1.60,
  'world-of-hyatt': 1.70,
  'marriott-bonvoy': 0.75,
  'hilton-honors': 0.40,
}

const DEFAULT_CPP_BY_TYPE: Record<string, number> = {
  transferable_points: 2.00,
  airline_miles: 1.35,
  hotel_points: 0.75,
  cashback: 1.0,
}

// Program-specific fallback CPP values (TPG April 2026).
// Keyed by program slug so the calculator returns a reasonable number
// even before the first DB refresh completes.
export const FALLBACK_CPP_BY_SLUG: Record<string, number> = {
  // Transferable currencies
  'chase-ultimate-rewards': 2.05,
  'amex-membership-rewards': 2.00,
  'capital-one-miles': 1.85,
  'citi-thankyou': 1.90,
  'bilt-rewards': 2.20,
  // Airlines
  'united': 1.35,
  'delta': 1.20,
  'american': 1.60,
  'southwest': 1.25,
  // Hotels
  'hyatt': 1.70,
  'marriott': 0.75,
  'hilton': 0.40,
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value > 0) return value
    return null
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed) && parsed > 0) return parsed
    return null
  }

  return null
}

const DEFAULT_GLOBAL_CPP = 1.0

function parseEnvNumber(key: string): number | null {
  const raw = process.env[key]
  if (!raw) return null
  const num = Number(raw)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

function getTypeFallback(programType: string | undefined): number {
  const type = (programType ?? '').toLowerCase()

  const envKey = {
    transferable_points: 'DEFAULT_CPP_TRANSFERABLE_POINTS',
    airline_miles: 'DEFAULT_CPP_AIRLINE_MILES',
    hotel_points: 'DEFAULT_CPP_HOTEL_POINTS',
    cashback: 'DEFAULT_CPP_CASHBACK',
  }[type]

  const envTypeValue = envKey ? parseEnvNumber(envKey) : null
  if (envTypeValue != null) return envTypeValue

  const staticTypeValue = DEFAULT_CPP_BY_TYPE[type]
  if (staticTypeValue != null) return staticTypeValue

  return parseEnvNumber('DEFAULT_CPP_CENTS') ?? DEFAULT_GLOBAL_CPP
}

export function resolveCppCents(cppCents: number | string | null | undefined, programType?: string, programSlug?: string): number {
  const parsedCppCents = parsePositiveNumber(cppCents)
  if (parsedCppCents != null) {
    return parsedCppCents
  }

  if (programSlug) {
    const slug = programSlug.toLowerCase()
    const tpgValue = TPG_APRIL_2026_CPP[slug]
    if (tpgValue != null) return tpgValue
  }

  return getTypeFallback(programType)
}
