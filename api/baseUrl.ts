// src/api/baseUrl.ts

type EnvName = 'staging' | 'production'

const parseEnv = (raw?: string | null): EnvName => {
  const v = (raw || '').toLowerCase()
  return v === 'production' ? 'production' : 'staging'
}

const ENV = parseEnv(process.env.EXPO_PUBLIC_ENV)

/**
 * Env vars should be ROOT urls (NO /api/v1 appended)
 * EXPO_PUBLIC_BASE_URL_STAGING=https://....
 * EXPO_PUBLIC_BASE_URL_PROD=https://....
 */
const RAW_ROOT_URL =
  ENV === 'production'
    ? process.env.EXPO_PUBLIC_BASE_URL_PROD
    : process.env.EXPO_PUBLIC_BASE_URL_STAGING

const normalize = (url?: string | null): string => (url ? url.replace(/\/+$/, '') : '')

const apiUrlToRoot = (apiUrl?: string | null): string => {
  const normalized = normalize(apiUrl)
  return normalized.replace(/\/api\/v1$/i, '')
}

const isPrivateHost = (host: string): boolean => {
  const lower = host.toLowerCase()
  if (lower === 'localhost' || lower.endsWith('.local')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    if (lower.startsWith('10.')) return true
    if (lower.startsWith('127.')) return true
    if (lower.startsWith('192.168.')) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true
  }
  return false
}

const isPublicHttpsRoot = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !isPrivateHost(parsed.hostname)
  } catch {
    return false
  }
}

const explicitApiBase = normalize(process.env.EXPO_PUBLIC_API_BASE_URL)
const rootFromApiBase = apiUrlToRoot(explicitApiBase)
const envRoot = normalize(RAW_ROOT_URL)
const hardFallbackRoot = 'https://bitbridgeglobal-fa54ecb89f7d.herokuapp.com'

const root_url = isPublicHttpsRoot(envRoot)
  ? envRoot
  : isPublicHttpsRoot(rootFromApiBase)
    ? rootFromApiBase
    : hardFallbackRoot
const api_base_url = root_url ? `${root_url}/api/v1` : ''

const APP_CONFIG = {
  env: ENV,
  root_url,
  api_base_url,

  // Backward compatibility while you refactor older calls:
  base_url: root_url,
  api_route: '/api/v1', // NOTE: no trailing slash (OK)
} as const

export default APP_CONFIG

console.log('[APP_CONFIG]', {
  env: APP_CONFIG.env,
  root_url: APP_CONFIG.root_url,
  api_base_url: APP_CONFIG.api_base_url,
})

if (!isPublicHttpsRoot(envRoot)) {
  const source = isPublicHttpsRoot(rootFromApiBase)
    ? 'EXPO_PUBLIC_API_BASE_URL'
    : 'hardcoded_production_fallback'
  console.log('[APP_CONFIG_FALLBACK]', {
    reason: 'invalid_or_missing_env_root_url',
    envRoot,
    explicitApiBase,
    selectedSource: source,
    selectedRoot: root_url,
  })
}
