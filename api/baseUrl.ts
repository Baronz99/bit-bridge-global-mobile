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

const root_url = normalize(RAW_ROOT_URL)
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
