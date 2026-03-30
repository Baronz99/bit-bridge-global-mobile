// api/client.ts (MOBILE APP) - shared Axios client for /api/v1
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import APP_CONFIG from './baseUrl'

// Access/refresh token keys: align with web (and migrate legacy keys from earlier mobile builds).
export const TOKEN_KEY = 'bitglobal'
export const REFRESH_TOKEN_KEY = 'refresh-token'
const LEGACY_TOKEN_KEY = 'bitbridge_token'
const LEGACY_REFRESH_TOKEN_KEY = 'bitbridge_refresh_token'

// --- tiny event system (no Node EventEmitter) ---
type AuthEventName = 'unauthorized'
type AuthEventPayload = {
  reason?: string
  status?: number | null
}
type Listener = (payload?: AuthEventPayload) => void | Promise<void>

const listeners: Record<AuthEventName, Set<Listener>> = { unauthorized: new Set() }

export const authEvents = {
  on(event: AuthEventName, fn: Listener) {
    listeners[event].add(fn)
    return () => listeners[event].delete(fn)
  },
  off(event: AuthEventName, fn: Listener) {
    return listeners[event].delete(fn)
  },
  emit(event: AuthEventName, payload?: AuthEventPayload) {
    for (const fn of listeners[event]) {
      try {
        const maybePromise = fn(payload)
        if (maybePromise && typeof (maybePromise as any).catch === 'function') {
          ;(maybePromise as Promise<void>).catch(() => {})
        }
      } catch {
        // swallow to avoid breaking app on listener error
      }
    }
  },
}

const normalizeBase = (url?: string) => String(url || '').replace(/\/+$/, '')
const stripApiV1 = (url?: string) => normalizeBase(url).replace(/\/api\/v1$/i, '')

const API_BASE_URL = normalizeBase(APP_CONFIG.api_base_url) // e.g. https://.../api/v1
const ROOT_URL = normalizeBase(APP_CONFIG.root_url) || stripApiV1(API_BASE_URL) // e.g. https://...

// Toggle verbose logging from env (optional)
const DEBUG_API =
  String(process.env.EXPO_PUBLIC_DEBUG_API || '').toLowerCase() === 'true' || __DEV__ === true

const cleanToken = (token: string) =>
  token.replace(/^Bearer\s+/i, '').replace(/^"+|"+$/g, '').trim()

// --------------------
// In-memory token cache (prevents SecureStore timing/race issues)
// --------------------
let memAccessToken: string | null = null
let memRefreshToken: string | null = null
let tokensBootstrapped = false

async function bootstrapTokensOnce() {
  if (tokensBootstrapped) return
  tokensBootstrapped = true

  try {
    // Access
    const t = await SecureStore.getItemAsync(TOKEN_KEY)
    if (t) {
      memAccessToken = cleanToken(t)
    } else {
      const legacy = await SecureStore.getItemAsync(LEGACY_TOKEN_KEY)
      if (legacy) {
        const clean = cleanToken(legacy)
        if (clean) {
          memAccessToken = clean
          await Promise.all([
            SecureStore.setItemAsync(TOKEN_KEY, clean),
            SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY),
          ])
        }
      }
    }

    // Refresh
    const r = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
    if (r) {
      memRefreshToken = cleanToken(r)
    } else {
      const legacyR = await SecureStore.getItemAsync(LEGACY_REFRESH_TOKEN_KEY)
      if (legacyR) {
        const clean = cleanToken(legacyR)
        if (clean) {
          memRefreshToken = clean
          await Promise.all([
            SecureStore.setItemAsync(REFRESH_TOKEN_KEY, clean),
            SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY),
          ])
        }
      }
    }
  } catch {
    // ignore
  }
}

// Public helpers (used by AuthProvider)
export const getStoredAccessToken = async () => {
  await bootstrapTokensOnce()
  return memAccessToken
}

export const getStoredRefreshToken = async () => {
  await bootstrapTokensOnce()
  return memRefreshToken
}

export const setTokens = async (accessToken?: string, refreshToken?: string) => {
  await bootstrapTokensOnce()

  const nextAccess = accessToken ? cleanToken(accessToken) : null
  const nextRefresh = refreshToken ? cleanToken(refreshToken) : null

  if (nextAccess) {
    memAccessToken = nextAccess
    await SecureStore.setItemAsync(TOKEN_KEY, nextAccess)
  }
  if (nextRefresh) {
    memRefreshToken = nextRefresh
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextRefresh)
  }

  // converge towards new keys
  await Promise.allSettled([
    SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY),
  ])

  // keep axios defaults in sync (important!)
  if (nextAccess) {
    client.defaults.headers.Authorization = `Bearer ${nextAccess}`
  }
}

export const clearTokens = async () => {
  memAccessToken = null
  memRefreshToken = null

  await Promise.allSettled([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY),
  ])

  delete client.defaults.headers.Authorization
}

// -------- Diagnostics helpers --------
const safeJson = (v: any) => {
  try {
    return JSON.parse(JSON.stringify(v))
  } catch {
    return String(v)
  }
}

const scrubHeaders = (headers: any) => {
  const h: any = { ...(headers || {}) }
  if (h.Authorization) h.Authorization = '[masked]'
  if (h.authorization) h.authorization = '[masked]'
  if (h['Bit-Refresh-Token']) h['Bit-Refresh-Token'] = '[masked]'
  if (h['bit-refresh-token']) h['bit-refresh-token'] = '[masked]'
  if (h.cookie) h.cookie = '[masked]'
  if (h.Cookie) h.Cookie = '[masked]'
  return h
}

// ✅ PCI-safe: redact sensitive keys anywhere in request/response payloads
const scrubSensitiveData = (data: any) => {
  const SENSITIVE_KEYS = new Set([
    'card_number',
    'cardNumber',
    'pan',
    'card_pan',
    'cardPan',
    'cvv',
    'cvc',
    'expiry',
    'expiry_date',
    'expiryDate',
    'expiry_month',
    'expiryMonth',
    'expiry_year',
    'expiryYear',
  ])

  try {
    const cloned = JSON.parse(JSON.stringify(data ?? null))
    const walk = (obj: any) => {
      if (!obj || typeof obj !== 'object') return
      for (const k of Object.keys(obj)) {
        if (SENSITIVE_KEYS.has(k)) {
          obj[k] = '[redacted]'
        } else {
          walk(obj[k])
        }
      }
    }
    walk(cloned)
    return cloned
  } catch {
    return '[unserializable]'
  }
}

const fullUrl = (baseURL?: string, url?: string) => {
  const b = normalizeBase(baseURL)
  const u = String(url || '')
  if (!b) return u
  if (!u) return b
  return u.startsWith('http') ? u : `${b}${u.startsWith('/') ? '' : '/'}${u}`
}

const summarizeData = (data: any) => {
  const d = data
  const isArr = Array.isArray(d)
  const hasDataArr = Array.isArray(d?.data)
  const count = isArr ? d.length : hasDataArr ? d.data.length : null
  const keys = d && !isArr ? Object.keys(d) : null
  const sample = isArr ? d.slice(0, 2) : hasDataArr ? d.data.slice(0, 2) : null
  return { isArray: isArr, hasDataArray: hasDataArr, count, keys, sample }
}

// ✅ Detect PCI reveal route; do NOT log request/response body for it
const isPciRevealUrl = (url?: string) => {
  const u = String(url || '')
  return u.includes('/pci/cards/') && u.includes('/reveal')
}

const logRequest = (config: InternalAxiosRequestConfig) => {
  if (!DEBUG_API) return
}

const logResponse = (config: InternalAxiosRequestConfig | undefined, status?: number, data?: any) => {
  if (!DEBUG_API) return
}

// --------------------
// Axios clients
// --------------------
const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
})

const refreshClient = axios.create({
  baseURL: ROOT_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
})

// --------------------
// Refresh flow (single-flight)
// --------------------
let refreshPromise: Promise<{
  accessToken: string | null
  terminal: boolean
  reason?: string
  status?: number | null
}> | null = null

const refreshAccessToken = async (): Promise<{
  accessToken: string | null
  terminal: boolean
  reason?: string
  status?: number | null
}> => {
  await bootstrapTokensOnce()
  const refreshToken = memRefreshToken
  if (!refreshToken) {
    return {
      accessToken: null,
      terminal: false,
      reason: 'missing_refresh_token',
      status: null,
    }
  }

  try {
    const res = await refreshClient.request({
      method: 'POST',
      url: '/refresh',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Bit-Refresh-Token': refreshToken,
      },
    })

    const data = res.data ?? {}

    const authHeader = (res.headers as any)?.authorization || (res.headers as any)?.Authorization
    const headerToken = authHeader ? cleanToken(String(authHeader)) : null

    const nextAccess = headerToken || data?.access_token || data?.token || null

    const headerRefresh =
      (res.headers as any)?.['bit-refresh-token'] || (res.headers as any)?.['Bit-Refresh-Token']
    const nextRefresh = headerRefresh ? cleanToken(String(headerRefresh)) : data?.refresh_token || null

    if (!nextAccess) {
      return {
        accessToken: null,
        terminal: false,
        reason: 'refresh_missing_access_token',
        status: res.status ?? null,
      }
    }

    // persist + update in-memory + update axios defaults
    await setTokens(nextAccess, nextRefresh || undefined)
    return {
      accessToken: cleanToken(nextAccess),
      terminal: false,
      status: res.status ?? null,
    }
  } catch (error: any) {
    const status = error?.response?.status ?? null
    const code = String(
      error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'refresh_failed'
    )
    const terminal = status === 401 && ['invalid_refresh', 'session_expired'].includes(code)
    return {
      accessToken: null,
      terminal,
      reason: code,
      status,
    }
  }
}

// --------------------
// Request interceptor: attach auth reliably
// --------------------
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  await bootstrapTokensOnce()

  const skipAuth = (config as any).__skipAuth === true

  config.headers = config.headers ?? {}
  ;(config.headers as any).Accept = 'application/json'

  const existingContentType =
    (config.headers as any)['Content-Type'] || (config.headers as any)['content-type']

  const isMultipart =
    typeof existingContentType === 'string' &&
    existingContentType.toLowerCase().includes('multipart/form-data')

  if (!isMultipart) {
    ;(config.headers as any)['Content-Type'] = 'application/json'
  }

  // Always normalize/remove both header keys to avoid casing conflicts in RN
  const existingAuth = (config.headers as any).Authorization || (config.headers as any).authorization

  if (skipAuth) {
    delete (config.headers as any).Authorization
    delete (config.headers as any).authorization
  } else {
    if (existingAuth) {
      ;(config.headers as any).Authorization = existingAuth
      delete (config.headers as any).authorization
    } else if (memAccessToken) {
      ;(config.headers as any).Authorization = `Bearer ${memAccessToken}`
      delete (config.headers as any).authorization
    } else {
      delete (config.headers as any).Authorization
      delete (config.headers as any).authorization
    }
  }

  logRequest(config)
  return config
})

// --------------------
// Response interceptor: 401 -> refresh -> retry once
// --------------------
client.interceptors.response.use(
  (res) => {
    logResponse(res?.config, res?.status, res?.data)
    return res
  },
  async (error: AxiosError) => {
    const status = error?.response?.status
    const originalRequest: any = error?.config

    const cfg = error.config as InternalAxiosRequestConfig | undefined

    const isRefreshRequest =
      originalRequest?.__skipAuthRefresh === true ||
      String(originalRequest?.url || '').includes('/refresh') ||
      !!originalRequest?.headers?.['Bit-Refresh-Token'] ||
      !!originalRequest?.headers?.['bit-refresh-token']
    if (status === 401 && originalRequest && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }

        const refreshResult = await refreshPromise
        const newAccess = refreshResult.accessToken

        if (newAccess) {
          // update in-memory token immediately (extra safety)
          memAccessToken = newAccess
          client.defaults.headers.Authorization = `Bearer ${newAccess}`

          originalRequest.headers = originalRequest.headers ?? {}
          originalRequest.headers.Authorization = `Bearer ${newAccess}`
          delete originalRequest.headers.authorization

          return client.request(originalRequest)
        }

        if (refreshResult.terminal) {
          ;(error as any).authInvalid = true
          ;(error as any).authFailureCode = refreshResult.reason
          ;(error as any).authFailureStatus = refreshResult.status
          await clearTokens()
          authEvents.emit('unauthorized', {
            reason: refreshResult.reason,
            status: refreshResult.status,
          })
        }
      } catch {
        // Treat transport/unknown refresh failures as recoverable; preserve local session.
      }
    }

    logResponse(cfg, status, error?.response?.data)
    return Promise.reject(error)
  }
)

export const getApiClientDebugSnapshot = () => {
  return {
    baseURL: client.defaults.baseURL || API_BASE_URL,
    apiBaseURL: API_BASE_URL,
    rootURL: ROOT_URL,
    env: APP_CONFIG.env,
    debugApi: DEBUG_API,
  }
}

export default client


