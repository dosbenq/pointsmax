const DEFAULT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
] as const

type ModelListResponse = {
  models?: Array<{
    name?: string
    supportedGenerationMethods?: string[]
  }>
}

type ModelCacheEntry = {
  expiresAt: number
  supportedModels: Set<string>
}

const MODEL_LIST_CACHE_TTL_MS = 5 * 60 * 1000
const MODEL_BLACKLIST_TTL_MS = 60 * 60 * 1000

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function isGeminiDisabled(): boolean {
  // Keep test runs deterministic and offline-safe by default.
  if (process.env.NODE_ENV === 'test') return true
  return parseBooleanFlag(process.env.DISABLE_GEMINI)
}

function parseCandidates(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function normalizeModelName(value: string): string {
  const withoutPrefix = value.startsWith('models/') ? value.slice('models/'.length) : value
  // e.g. gemini-1.5-flash-002 -> gemini-1.5-flash
  return withoutPrefix.replace(/-(\d{3})$/, '')
}

export function getGeminiModelCandidates(): string[] {
  const fromCandidatesEnv = parseCandidates(process.env.GEMINI_MODEL_CANDIDATES)
  const fromSingleEnv = parseCandidates(process.env.GEMINI_MODEL)

  const envCandidates = [...fromCandidatesEnv, ...fromSingleEnv]
  const expandedEnvCandidates = envCandidates.flatMap((name) => {
    const normalized = normalizeModelName(name)
    return normalized === name ? [name] : [name, normalized]
  })
  const merged = [...expandedEnvCandidates, ...DEFAULT_MODELS]
  const seen = new Set<string>()

  return merged.filter((name) => {
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })
}

function getModelCache(): Map<string, ModelCacheEntry> {
  const globalWithCache = globalThis as typeof globalThis & {
    __pointsmaxGeminiModelCache?: Map<string, ModelCacheEntry>
  }
  if (!globalWithCache.__pointsmaxGeminiModelCache) {
    globalWithCache.__pointsmaxGeminiModelCache = new Map<string, ModelCacheEntry>()
  }
  return globalWithCache.__pointsmaxGeminiModelCache
}

function getBlacklist(): Map<string, number> {
  const globalWithBlacklist = globalThis as typeof globalThis & {
    __pointsmaxGeminiModelBlacklist?: Map<string, number>
  }
  if (!globalWithBlacklist.__pointsmaxGeminiModelBlacklist) {
    globalWithBlacklist.__pointsmaxGeminiModelBlacklist = new Map<string, number>()
  }
  return globalWithBlacklist.__pointsmaxGeminiModelBlacklist
}

function filterBlacklistedModels(candidates: string[]): string[] {
  const now = Date.now()
  const blacklist = getBlacklist()
  for (const [name, expiresAt] of blacklist.entries()) {
    if (expiresAt <= now) blacklist.delete(name)
  }

  const filtered = candidates.filter((name) => {
    const expiresAt = blacklist.get(name)
    return !expiresAt || expiresAt <= now
  })
  return filtered.length > 0 ? filtered : candidates
}

async function getSupportedModelsForApiKey(apiKey: string): Promise<Set<string> | null> {
  const cache = getModelCache()
  const now = Date.now()
  const cacheKey = apiKey
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.supportedModels

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET', cache: 'no-store' },
    )
    if (!res.ok) return null

    const body = (await res.json()) as ModelListResponse
    const models = body.models ?? []
    const supported = new Set<string>()

    for (const model of models) {
      const name = model.name
      if (!name || !name.startsWith('models/')) continue
      const methods = model.supportedGenerationMethods ?? []
      if (!methods.includes('generateContent') && !methods.includes('streamGenerateContent')) {
        continue
      }
      supported.add(name.slice('models/'.length))
    }

    if (supported.size > 0) {
      cache.set(cacheKey, {
        expiresAt: now + MODEL_LIST_CACHE_TTL_MS,
        supportedModels: supported,
      })
      return supported
    }
    return null
  } catch {
    return null
  }
}

export async function getGeminiModelCandidatesForApiKey(apiKey: string): Promise<string[]> {
  const candidates = filterBlacklistedModels(getGeminiModelCandidates())
  const supported = await getSupportedModelsForApiKey(apiKey)
  if (!supported || supported.size === 0) return candidates

  const preferredSupported = candidates.filter((name) => supported.has(name))
  const discoveredSupported = [...supported].filter((name) => !preferredSupported.includes(name))
  const merged = [...preferredSupported, ...discoveredSupported]
  return merged.length > 0 ? merged : candidates
}

export function markGeminiModelUnavailable(modelName: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  if (!/(not found|not supported|no longer available|deprecated|retired)/i.test(message)) return
  getBlacklist().set(modelName, Date.now() + MODEL_BLACKLIST_TTL_MS)
}
