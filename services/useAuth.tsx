import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState } from 'react-native'
import * as SecureStore from 'expo-secure-store'

import client, {
  TOKEN_KEY as ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  authEvents,
} from '@/api/client'
import APP_CONFIG from '@/api/baseUrl'

type LoginPayload = { email: string; password: string }

type LegacyAuthState = {
  token: string | null
  authenticated: boolean | null
}

export type AuthContextValue = {
  loading: boolean

  token: string | null
  refreshToken: string | null
  user: any | null
  authenticated: boolean

  login: (payload: LoginPayload) => Promise<any>
  logout: () => Promise<void>
  refreshProfile: (options?: { force?: boolean }) => Promise<any>

  // legacy
  authState: LegacyAuthState
  onLogin: (payload: LoginPayload) => Promise<any>
  onLogout: () => Promise<void>
  onRegister: (formData: any) => Promise<any>

  userProfileData: any | null
  loadProfile: (options?: { force?: boolean }) => Promise<any>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const normalize = (v: string | null | undefined) =>
  String(v || '')
    .replace(/^Bearer\s+/i, '')
    .replace(/^"+|"+$/g, '')
    .trim()

async function saveTokens(accessToken: string, refreshToken?: string | null) {
  const cleanAccess = normalize(accessToken)
  if (!cleanAccess) throw new Error('Missing access token')

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, cleanAccess)
  client.defaults.headers.Authorization = `Bearer ${cleanAccess}`

  if (refreshToken) {
    const cleanRefresh = normalize(refreshToken)
    if (cleanRefresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, cleanRefresh)
  }
}

async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ])
  delete client.defaults.headers.Authorization
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [user, setUser] = useState<any | null>(null)

  const userRef = useRef<any | null>(null)
  const profileLoadedRef = useRef(false)
  const profileFetchInFlightRef = useRef(false)

  const authenticated = !!token

  const refreshProfile = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force === true

    if (!force) {
      if (profileFetchInFlightRef.current) return userRef.current
      if (profileLoadedRef.current) return userRef.current
    }

    profileFetchInFlightRef.current = true
    try {
      const res = await client.get('/users/user_profile')
      const data = res?.data?.data ?? res?.data
      userRef.current = data
      setUser(data)
      profileLoadedRef.current = true
      return data
    } finally {
      profileFetchInFlightRef.current = false
    }
  }, [])

  const bootstrap = useCallback(async () => {
    try {
      const storedAccess = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
      const storedRefresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)

      if (storedAccess) {
        const cleanAccess = normalize(storedAccess)
        setToken(cleanAccess)
        client.defaults.headers.Authorization = `Bearer ${cleanAccess}`
      } else {
        setToken(null)
        delete client.defaults.headers.Authorization
      }

      if (storedRefresh) setRefreshToken(normalize(storedRefresh))
      else setRefreshToken(null)

      if (storedAccess) {
        await refreshProfile({ force: true }).catch(async () => {
          await clearTokens()
          setToken(null)
          setRefreshToken(null)
          setUser(null)
          userRef.current = null
          profileLoadedRef.current = false
        })
      }
    } finally {
      setLoading(false)
    }
  }, [refreshProfile])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const onUnauthorized = async () => {
      await clearTokens()
      setToken(null)
      setRefreshToken(null)
      setUser(null)
      userRef.current = null
      profileLoadedRef.current = false
    }

    const unsubscribe = authEvents.on('unauthorized', onUnauthorized)
    return () => {
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        profileLoadedRef.current = false
      }
    })
    return () => subscription.remove()
  }, [])

  const login = useCallback(
    async (payload: LoginPayload) => {
      const loginUrl = `${APP_CONFIG.root_url}/login`
      let res

      try {
        res = await client.request({
          method: 'POST',
          baseURL: APP_CONFIG.root_url,
          url: '/login',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          data: {
            user: {
              email: (payload.email || '').trim(),
              password: (payload.password || '').trim(),
            },
          },
          __skipAuth: true,
          __skipAuthRefresh: true,
        } as any)
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Login failed'
        throw new Error(msg)
      }

      console.log('[AUTH] login', { url: loginUrl, status: res.status })

      const json = res.data || {}

      const authHeader = res.headers?.authorization || res.headers?.Authorization
      const headerToken = authHeader ? normalize(authHeader) : null

      const bodyAccess = normalize(json?.access_token || json?.token || json?.jwt)
      const bodyRefresh = normalize(json?.refresh_token)

      const cleanAccess = normalize(headerToken || bodyAccess)
      if (!cleanAccess) throw new Error('No access token returned')

      await saveTokens(cleanAccess, bodyRefresh || null)

      setToken(cleanAccess)
      setRefreshToken(bodyRefresh || null)

      await refreshProfile({ force: true })
      return json
    },
    [refreshProfile]
  )

  const logout = useCallback(async () => {
    await clearTokens()
    setToken(null)
    setRefreshToken(null)
    setUser(null)
    userRef.current = null
    profileLoadedRef.current = false
  }, [])

  const onRegister = async (_formData: any) => {
    throw new Error('Register not implemented yet')
  }

  const value = useMemo<AuthContextValue>(() => {
    const legacyAuthState: LegacyAuthState = {
      token,
      authenticated: token ? true : null,
    }

    return {
      loading,

      token,
      refreshToken,
      user,
      authenticated,

      login,
      logout,
      refreshProfile,

      authState: legacyAuthState,
      onLogin: login,
      onLogout: logout,
      onRegister,

      userProfileData: user,
      loadProfile: refreshProfile,
    }
  }, [loading, token, refreshToken, user, authenticated, login, logout, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
