// api/client.ts (MOBILE APP)
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import APP_CONFIG from './baseUrl'

// ✅ Keep compatible with your existing useAuth.tsx
export const TOKEN_KEY = 'bitbridge_token'
export const REFRESH_TOKEN_KEY = 'bitbridge_refresh_token'

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
    for (const fn of listeners[event]) fn()
  },
}

const normalizeBase = (url?: string) => String(url || '').replace(/\/+$/, '')
const stripApiV1 = (url?: string) => normalizeBase(url).replace(/\/api\/v1$/i, '')

const API_BASE_URL = normalizeBase(APP_CONFIG.api_base_url) // https://.../api/v1
const ROOT_URL = normalizeBase(APP_CONFIG.root_url) || stripApiV1(API_BASE_URL) // https://...

let refreshPromise: Promise<string | null> | null = null

const cleanToken = (token: string) =>
  token.replace(/^Bearer\s+/i, '').replace(/^"+|"+$/g, '').trim()

const getAccessToken = async () => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  return token ? cleanToken(token) : null
}

const getRefreshToken = async () => {
  const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  return token ? cleanToken(token) : null
}

export const setTokens = async (accessToken?: string, refreshToken?: string) => {
  if (accessToken) await SecureStore.setItemAsync(TOKEN_KEY, cleanToken(accessToken))
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, cleanToken(refreshToken))
}

export const clearTokens = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ])
}

// POST /refresh (root route, NOT /api/v1)
// returns next access token (or null)
const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return null

  let res
  try {
    res = await client.request({
      method: 'POST',
      baseURL: ROOT_URL,
      url: '/refresh',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Bit-Refresh-Token': refreshToken,
      },
      __skipAuth: true,
      __skipAuthRefresh: true,
    } as any)
  } catch {
    return null
  }

  console.log('[AUTH] refresh', {
    url: `${ROOT_URL}/refresh`,
    status: res.status,
  })

  const data = res.data ?? {}
  const nextAccess = data?.access_token || data?.token || null
  const nextRefresh = data?.refresh_token || null

  if (!nextAccess) return null

  await setTokens(nextAccess, nextRefresh || undefined)
  return cleanToken(nextAccess)
}

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
})

const logRequest = (config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toUpperCase()
  console.log('[API] request', {
    method,
    baseURL: config.baseURL,
    url: config.url,
  })
}

const logResponse = (config: InternalAxiosRequestConfig | undefined, status?: number) => {
  const method = (config?.method || 'get').toUpperCase()
  console.log('[API] response', {
    method,
    baseURL: config?.baseURL,
    url: config?.url,
    status,
  })
}

// Attach token on every request
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken()
  const skipAuth = (config as any).__skipAuth === true

  config.headers = config.headers ?? {}
  config.headers.Accept = 'application/json'
  config.headers['Content-Type'] = 'application/json'

  const existingAuth =
    (config.headers as any).Authorization || (config.headers as any).authorization
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
    logResponse(res?.config, res?.status)
    return res
  },
  async (error: AxiosError) => {
    const status = error?.response?.status
    const originalRequest: any = error?.config
    const isRefreshRequest =
      originalRequest?.__skipAuthRefresh === true ||
      originalRequest?.url?.includes('/refresh') ||
      originalRequest?.headers?.['Bit-Refresh-Token']

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

        // refresh failed
        await clearTokens()
        authEvents.emit('unauthorized')
      } catch {
        await clearTokens()
        authEvents.emit('unauthorized')
      }
    }

    if (error?.response) {
      const cfg = error.config as InternalAxiosRequestConfig | undefined
      const method = (cfg?.method || 'get').toUpperCase()
      console.log('[API] error', {
        method,
        baseURL: cfg?.baseURL,
        url: cfg?.url,
        status,
        data: error.response?.data,
        headers: error.response?.headers,
      })
    }

    logResponse(error?.config as InternalAxiosRequestConfig, status)
    return Promise.reject(error)
  }
)

export default client
