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
type Listener = () => void | Promise<void>

const listeners: Record<AuthEventName, Set<Listener>> = {
  unauthorized: new Set(),
}

export const authEvents = {
  on(event: AuthEventName, fn: Listener) {
    listeners[event].add(fn)
    return () => listeners[event].delete(fn)
  },
  off(event: AuthEventName, fn: Listener) {
    return listeners[event].delete(fn)
  },
  emit(event: AuthEventName) {
    for (const fn of listeners[event]) {
      try {
        const maybePromise = fn()
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

// 🔎 Toggle verbose logging from env (optional)
const DEBUG_API =
  String(process.env.EXPO_PUBLIC_DEBUG_API || '').toLowerCase() === 'true' || __DEV__ === true

let refreshPromise: Promise<string | null> | null = null

const cleanToken = (token: string) =>
  token.replace(/^Bearer\s+/i, '').replace(/^"+|"+$/g, '').trim()

export const getStoredAccessToken = async () => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (token) return cleanToken(token)

  // One-time migration path: keep existing sessions working after key rename.
  const legacy = await SecureStore.getItemAsync(LEGACY_TOKEN_KEY)
  if (!legacy) return null

  const clean = cleanToken(legacy)
  if (!clean) return null
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, clean),
    SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY),
  ])
  return clean
}

export const getStoredRefreshToken = async () => {
  const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  if (token) return cleanToken(token)

  const legacy = await SecureStore.getItemAsync(LEGACY_REFRESH_TOKEN_KEY)
  if (!legacy) return null

  const clean = cleanToken(legacy)
  if (!clean) return null
  await Promise.all([
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, clean),
    SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY),
  ])
  return clean
}

export const setTokens = async (accessToken?: string, refreshToken?: string) => {
  if (accessToken) await SecureStore.setItemAsync(TOKEN_KEY, cleanToken(accessToken))
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, cleanToken(refreshToken))

  // Converge towards the new keys (best-effort; ignore failures).
  await Promise.allSettled([
    SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY),
  ])
}

export const clearTokens = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY),
  ])
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
  // mask sensitive headers
  if (h.Authorization) h.Authorization = '[masked]'
  if (h.authorization) h.authorization = '[masked]'
  if (h['Bit-Refresh-Token']) h['Bit-Refresh-Token'] = '[masked]'
  if (h['bit-refresh-token']) h['bit-refresh-token'] = '[masked]'
  if (h.cookie) h.cookie = '[masked]'
  if (h.Cookie) h.Cookie = '[masked]'
  return h
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

const logRequest = (config: InternalAxiosRequestConfig) => {
  if (!DEBUG_API) return
  const method = (config.method || 'get').toUpperCase()
  console.log('[API] request', {
    method,
    baseURL: config.baseURL,
    url: config.url,
    fullUrl: fullUrl(config.baseURL, config.url),
    params: safeJson((config as any).params),
    data: safeJson((config as any).data),
    headers: scrubHeaders(config.headers),
    timeout: (config as any).timeout,
    skipAuth: (config as any).__skipAuth === true,
    skipAuthRefresh: (config as any).__skipAuthRefresh === true,
  })
}

const logResponse = (
  config: InternalAxiosRequestConfig | undefined,
  status?: number,
  data?: any
) => {
  if (!DEBUG_API) return

  const method = (config?.method || 'get').toUpperCase()
  const url = config?.url
  const baseURL = config?.baseURL

  const shouldMeta =
    url?.includes('/payment_processors/get_price_list') ||
    url?.includes('/provisions') ||
    url?.includes('/products') ||
    url?.includes('/login') ||
    url?.includes('/refresh') ||
    url?.includes('/timeline') // ✅ include timeline meta

  console.log('[API] response', {
    method,
    baseURL,
    url,
    fullUrl: fullUrl(baseURL, url),
    status,
    ...(shouldMeta ? { dataMeta: summarizeData(data) } : {}),
  })

  // ✅ Timeline inspection (DEV ONLY)
  if (url?.includes('/timeline') && data) {
    try {
      const root = data ?? {}
      const listCandidate =
        root?.items ?? root?.data ?? root?.timeline ?? root?.results ?? root?.records
      const list = Array.isArray(listCandidate) ? listCandidate : []

      console.log('[API][timeline] root meta', {
        rootKeys: Object.keys(root || {}),
        listKey: root?.items ? 'items' : root?.data ? 'data' : root?.timeline ? 'timeline' : 'unknown',
        count: list.length,
        next_cursor: root?.next_cursor ?? root?.cursor ?? null,
      })

      const sample = list[0]
      if (!sample) {
        console.log('[API][timeline] empty list')
        return
      }

      const safeKeys = (obj: any) => (obj && typeof obj === 'object' ? Object.keys(obj) : [])

      const containers = {
        meta: sample?.meta,
        actor: sample?.actor,
      }

      console.log('[API][timeline] sample keys', {
        id: sample?.id,
        type: sample?.kind ?? sample?.type,
        status: sample?.status,
        keys: safeKeys(sample),
      })

      for (const [name, obj] of Object.entries(containers)) {
        const keys = safeKeys(obj)
        if (keys.length) console.log(`[API][timeline] nested keys: ${name}`, { keys })
      }

      console.log('[API][timeline] sample normalized', {
        id: sample?.id,
        kind: sample?.kind,
        label: sample?.label,
        amount_cents: sample?.amount_cents,
        occurred_at: sample?.occurred_at,
        status: sample?.status,
        transaction_type: sample?.meta?.transaction_type,
        reference: sample?.meta?.reference,
        description: sample?.meta?.description,
      })
    } catch (e) {
      console.warn('[API][timeline] inspection failed', e)
    }
  }
}


// Create primary client (normal API calls)
const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
})

// Use a separate client for refresh calls (prevents any interceptor edge recursion)
const refreshClient = axios.create({
  baseURL: ROOT_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
})

// POST /refresh (root route, NOT /api/v1)
const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = await getStoredRefreshToken()
  if (!refreshToken) return null

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

    if (DEBUG_API) console.log('[AUTH] refresh', { url: `${ROOT_URL}/refresh`, status: res.status })

    const data = res.data ?? {}

    // Prefer header token (matches how /login often responds)
    const authHeader = (res.headers as any)?.authorization || (res.headers as any)?.Authorization
    const headerToken = authHeader ? cleanToken(String(authHeader)) : null

    const nextAccess = headerToken || data?.access_token || data?.token || null

    const headerRefresh =
      (res.headers as any)?.['bit-refresh-token'] || (res.headers as any)?.['Bit-Refresh-Token'] || null
    const nextRefresh = headerRefresh || data?.refresh_token || null

    if (!nextAccess) return null

    await setTokens(nextAccess, nextRefresh || undefined)
    return cleanToken(nextAccess)
  } catch {
    return null
  }
}

// Attach token on every request
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getStoredAccessToken()
  const skipAuth = (config as any).__skipAuth === true

  config.headers = config.headers ?? {}
  config.headers.Accept = 'application/json'

  const existingContentType =
    (config.headers as any)['Content-Type'] || (config.headers as any)['content-type']

  const isMultipart =
    typeof existingContentType === 'string' &&
    existingContentType.toLowerCase().includes('multipart/form-data')

  if (!isMultipart) {
    config.headers['Content-Type'] = 'application/json'
  }

  const existingAuth = (config.headers as any).Authorization || (config.headers as any).authorization

  if (!skipAuth) {
    if (existingAuth) {
      config.headers.Authorization = existingAuth
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else {
      delete (config.headers as any).Authorization
    }
  } else {
    delete (config.headers as any).Authorization
  }

  logRequest(config)
  return config
})

// If 401 → refresh → retry once → else logout
client.interceptors.response.use(
  (res) => {
    logResponse(res?.config, res?.status, res?.data)
    return res
  },
  async (error: AxiosError) => {
    const status = error?.response?.status
    const originalRequest: any = error?.config

    const isRefreshRequest =
      originalRequest?.__skipAuthRefresh === true ||
      originalRequest?.url?.includes('/refresh') ||
      originalRequest?.headers?.['Bit-Refresh-Token']

    if (DEBUG_API) {
      const cfg = error.config as InternalAxiosRequestConfig | undefined
      console.log('[API] error', {
        method: (cfg?.method || 'get').toUpperCase(),
        baseURL: cfg?.baseURL,
        url: cfg?.url,
        fullUrl: fullUrl(cfg?.baseURL, cfg?.url),
        status,
        params: safeJson((cfg as any)?.params),
        responseDataMeta: summarizeData(error?.response?.data),
        responseHeaders: scrubHeaders(error?.response?.headers),
      })
    }

    if (status === 401 && originalRequest && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }

        const newAccess = await refreshPromise

        if (newAccess) {
          originalRequest.headers = originalRequest.headers ?? {}
          originalRequest.headers.Authorization = `Bearer ${newAccess}`
          return client.request(originalRequest)
        }

        await clearTokens()
        authEvents.emit('unauthorized')
      } catch {
        await clearTokens()
        authEvents.emit('unauthorized')
      }
    }

    logResponse(error?.config as InternalAxiosRequestConfig, status, error?.response?.data)
    return Promise.reject(error)
  }
)

export default client
