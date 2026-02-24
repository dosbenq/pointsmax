const DEFAULT_CPP_BY_TYPE: Record<string, number> = {
  transferable_points: 1.6,
  airline_miles: 1.2,
  hotel_points: 0.8,
  cashback: 1.0,
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

export function resolveCppCents(cppCents: number | string | null | undefined, programType?: string): number {
  const parsedCppCents = parsePositiveNumber(cppCents)
  if (parsedCppCents != null) {
    return parsedCppCents
  }

  return getTypeFallback(programType)
}
