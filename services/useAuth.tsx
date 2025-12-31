// src/services/useAuth.tsx (MOBILE APP)
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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

  // preferred
  token: string | null
  refreshToken: string | null
  user: any | null
  authenticated: boolean

  login: (payload: LoginPayload) => Promise<any>
  logout: () => Promise<void>
  refreshProfile: () => Promise<any>

  // legacy (what your current screens still use)
  authState: LegacyAuthState
  onLogin: (payload: LoginPayload) => Promise<any>
  onLogout: () => Promise<void>
  onRegister: (formData: any) => Promise<any>

  // legacy aliases used by older screens
  userProfileData: any | null
  loadProfile: () => Promise<any>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const normalize = (v: string | null | undefined) =>
  String(v || '').replace(/^Bearer\s+/i, '').replace(/^"+|"+$/g, '').trim()

async function saveTokens(accessToken: string, refreshToken?: string | null) {
  const cleanAccess = normalize(accessToken)
  if (!cleanAccess) throw new Error('Missing access token')

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, cleanAccess)
  client.defaults.headers.Authorization = `Bearer ${cleanAccess}`

  if (refreshToken) {
    const cleanRefresh = normalize(refreshToken)
    if (cleanRefresh) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, cleanRefresh)
    }
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

  const authenticated = !!token

  // ✅ Profile fetch (api/v1)
  const refreshProfile = useCallback(async () => {
    const res = await client.get('/users/user_profile')
    const data = res?.data?.data ?? res?.data
    setUser(data)
    return data
  }, [])

  // ✅ One-time boot: load tokens and profile
  const bootstrap = async () => {
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

      // If we have an access token, try profile
      if (storedAccess) {
        await refreshProfile().catch(async () => {
          // If profile fails badly, clear session
          await clearTokens()
          setToken(null)
          setRefreshToken(null)
          setUser(null)
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ✅ Listen for global 401 "logout" signal from api/client refresh logic
    useEffect(() => {
    const onUnauthorized = async () => {
      await clearTokens()
      setToken(null)
      setRefreshToken(null)
      setUser(null)
    }

    // ✅ on() returns an unsubscribe function in your typed emitter
    const unsubscribe = authEvents.on('unauthorized', onUnauthorized)

    return () => {
      unsubscribe?.()
    }
  }, [])


  // ✅ Login: use ROOT /login (Devise) and store access + refresh tokens
  const login = useCallback(async (payload: LoginPayload) => {
    const loginUrl = `${APP_CONFIG.root_url}/login`
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: {
          email: (payload.email || '').trim(),
          password: (payload.password || '').trim(),
        },
      }),
    })

    console.log('[AUTH] login', { url: loginUrl, status: res.status })

    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg = (json?.error || json?.message || 'Login failed') as string
      throw new Error(msg)
    }

    // Prefer header, fallback to payload
    const authHeader = res.headers.get('authorization') || res.headers.get('Authorization')
    const headerToken = authHeader ? normalize(authHeader) : null

    const bodyAccess = normalize(json?.access_token || json?.token || json?.jwt)
    const bodyRefresh = normalize(json?.refresh_token)

    const access = headerToken || bodyAccess
    if (!access) throw new Error('No access token returned')

    await saveTokens(access, bodyRefresh || null)

    setToken(access)
    setRefreshToken(bodyRefresh || null)

    await refreshProfile()
    return json
  }, [refreshProfile])

  const logout = useCallback(async () => {
    await clearTokens()
    setToken(null)
    setRefreshToken(null)
    setUser(null)
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

      // legacy aliases
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
