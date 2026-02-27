export function fixedIsoDate(value = '2026-01-01T00:00:00.000Z'): string {
  return value
}

export function fixedUuid(value = '11111111-1111-1111-1111-111111111111'): string {
  return value
}

export function withFixedNow<T>(timestampMs: number, run: () => T): T {
  const originalNow = Date.now
  Date.now = () => timestampMs
  try {
    return run()
  } finally {
    Date.now = originalNow
  }
}
