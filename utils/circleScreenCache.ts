type CacheEntry<T> = {
  data: T
  cachedAt: number
}

const circleScreenCache = new Map<string, CacheEntry<unknown>>()

export const DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS = 15_000

export const readCircleScreenCache = <T,>(key: string): CacheEntry<T> | null => {
  const entry = circleScreenCache.get(key)
  return entry ? (entry as CacheEntry<T>) : null
}

export const writeCircleScreenCache = <T,>(key: string, data: T) => {
  circleScreenCache.set(key, { data, cachedAt: Date.now() })
}

export const isCircleScreenCacheFresh = (key: string, ttlMs = DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS) => {
  const entry = circleScreenCache.get(key)
  if (!entry) return false
  return Date.now() - entry.cachedAt < ttlMs
}
