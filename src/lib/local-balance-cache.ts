export type LocalBalanceEntry = {
  program_id: string
  balance: number
}

export type LocalBalanceCacheResult = {
  balances: LocalBalanceEntry[]
  cachedAt: string | null
  isExpired: boolean
}

const CACHE_KEY = 'pm_local_balances_v2'
const LEGACY_KEY = 'pm_local_balances'
const CACHE_VERSION = 2
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30

type LocalBalanceCacheRecord = {
  version: number
  cached_at: string
  balances: LocalBalanceEntry[]
}

function sanitizeBalances(value: unknown): LocalBalanceEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      const programId = typeof entry?.program_id === 'string' ? entry.program_id.trim() : ''
      const balance = typeof entry?.balance === 'number' ? entry.balance : Number(entry?.balance)
      if (!programId || !Number.isFinite(balance) || balance < 0) return null
      return { program_id: programId, balance: Math.round(balance) }
    })
    .filter((entry): entry is LocalBalanceEntry => entry !== null)
}

export function readLocalBalanceCache(now = Date.now()): LocalBalanceCacheResult | null {
  if (typeof window === 'undefined') return null

  const parseRecord = (raw: string | null): LocalBalanceCacheResult | null => {
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as LocalBalanceCacheRecord | LocalBalanceEntry[]
      if (Array.isArray(parsed)) {
        const balances = sanitizeBalances(parsed)
        if (balances.length === 0) return null
        return { balances, cachedAt: null, isExpired: false }
      }

      const balances = sanitizeBalances(parsed?.balances)
      if (balances.length === 0) return null

      const cachedAt = typeof parsed.cached_at === 'string' ? parsed.cached_at : null
      const cachedMs = cachedAt ? Date.parse(cachedAt) : NaN
      const isExpired = !Number.isFinite(cachedMs) || now - cachedMs > MAX_AGE_MS
      return { balances, cachedAt, isExpired }
    } catch {
      return null
    }
  }

  return parseRecord(window.localStorage.getItem(CACHE_KEY))
    ?? parseRecord(window.localStorage.getItem(LEGACY_KEY))
}

export function writeLocalBalanceCache(balances: LocalBalanceEntry[], now = new Date()): void {
  if (typeof window === 'undefined') return

  const sanitized = sanitizeBalances(balances)
  if (sanitized.length === 0) {
    window.localStorage.removeItem(CACHE_KEY)
    window.localStorage.removeItem(LEGACY_KEY)
    return
  }

  const payload: LocalBalanceCacheRecord = {
    version: CACHE_VERSION,
    cached_at: now.toISOString(),
    balances: sanitized,
  }

  window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  window.localStorage.removeItem(LEGACY_KEY)
}
