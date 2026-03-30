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
import client, {
  authEvents,
  clearTokens as clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setTokens as setStoredTokens,
} from '@/api/client'
import APP_CONFIG from '@/api/baseUrl'
import { signup as signupApi } from '@/api/auth'
import { setEmailForVerification } from '@/auth/tokenstore'
import { clearAppLockPersisted } from '@/services/appLockStorage'
import { log } from '@/utils/logger'

type LoginPayload = { email: string; password: string }

type LegacyAuthState = {
  token: string | null
  authenticated: boolean | null
}

export type AuthContextValue = {
  loading: boolean
  authHydrated: boolean
  profileLoading: boolean
  profileError: string | null
  profileErrorStatus: number | null

  token: string | null
  refreshToken: string | null
  user: any | null
  authenticated: boolean

  login: (payload: LoginPayload) => Promise<any>
  logout: () => Promise<void>
  establishSessionFromTokens: (accessToken: string, refreshToken?: string | null) => Promise<void>
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

const redactToken = (value: string | undefined) => {
  if (!value) return value
  if (!value.toLowerCase().startsWith('bearer ')) return '[REDACTED]'
  return 'Bearer [REDACTED]'
}

async function saveTokens(accessToken: string, refreshToken?: string | null) {
  const cleanAccess = normalize(accessToken)
  if (!cleanAccess) throw new Error('Missing access token')

  await setStoredTokens(cleanAccess, refreshToken ? normalize(refreshToken) : undefined)
  client.defaults.headers.Authorization = `Bearer ${cleanAccess}`
}

async function clearTokens() {
  await clearStoredTokens()
  delete client.defaults.headers.Authorization
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authHydrated, setAuthHydrated] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileErrorStatus, setProfileErrorStatus] = useState<number | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [user, setUser] = useState<any | null>(null)

  const userRef = useRef<any | null>(null)
  const profileLoadedRef = useRef(false)
  const profileFetchInFlightRef = useRef(false)
  const lastProfileFetchAtRef = useRef(0)
  const bootstrapProfileAttemptedForTokenRef = useRef<string | null>(null)

  const authenticated = !!token
  const hasProfile = !!user

  const bootTrace = useCallback(
    (event: string, extra: Record<string, unknown> = {}) => {
      log('[BOOT_TRACE][AUTH]', {
        event,
        hydrated: authHydrated,
        authed: authenticated,
        tokenPresent: !!token,
        profileLoading,
        hasProfile,
        lastProfileError: profileError,
        ...extra,
      })
    },
    [authHydrated, authenticated, token, profileLoading, hasProfile, profileError]
  )

  const refreshProfile = useCallback(async (options?: { force?: boolean; tokenOverride?: string | null }) => {
    const force = options?.force === true
    const tokenOverride = options?.tokenOverride ?? null
    const now = Date.now()

    if (!token && !tokenOverride) return userRef.current

    // Never allow concurrent profile fetches; this prevents request storms.
    if (profileFetchInFlightRef.current) return userRef.current

    if (!force && profileLoadedRef.current) return userRef.current

    // Collapse rapid repeated calls from multiple mounted screens/effects.
    if (!force && now - lastProfileFetchAtRef.current < 5000) return userRef.current
    if (force && now - lastProfileFetchAtRef.current < 1500) return userRef.current

    profileFetchInFlightRef.current = true
    setProfileLoading(true)
    setProfileError(null)
    setProfileErrorStatus(null)
    const requestPath = '/users/user_profile'
    const requestBaseURL = String(client.defaults.baseURL || APP_CONFIG.root_url || '')
    const fullRequestUrl = requestBaseURL.endsWith('/')
      ? `${requestBaseURL.slice(0, -1)}${requestPath}`
      : `${requestBaseURL}${requestPath}`
    const authHeader =
      (client.defaults.headers as any)?.Authorization ||
      (client.defaults.headers as any)?.common?.Authorization
    const requestHeaders = {
      Authorization: redactToken(authHeader),
      Accept:
        (client.defaults.headers as any)?.Accept ||
        (client.defaults.headers as any)?.common?.Accept,
      'Content-Type':
        (client.defaults.headers as any)?.['Content-Type'] ||
        (client.defaults.headers as any)?.common?.['Content-Type'],
    }
    try {
      if (tokenOverride) {
        client.defaults.headers.Authorization = `Bearer ${tokenOverride}`
        requestHeaders.Authorization = redactToken(`Bearer ${tokenOverride}`)
      }
      const res = await client.get(requestPath)
      const data = res?.data?.data ?? res?.data
      if (!data || typeof data !== 'object') {
        const parseError = new Error('Invalid profile payload')
        ;(parseError as any).code = 'PROFILE_PARSE_FAILED'
        throw parseError
      }
      userRef.current = data
      setUser(data)
      profileLoadedRef.current = true
      lastProfileFetchAtRef.current = Date.now()
      bootTrace('profile_fetch_success')
      return data
    } catch (error: any) {
      const responsePreview = (() => {
        try {
          const raw =
            typeof error?.response?.data === 'string'
              ? error.response.data
              : JSON.stringify(error?.response?.data ?? '')
          return String(raw).slice(0, 200)
        } catch {
          return String(error?.response?.data ?? '').slice(0, 200)
        }
      })()
      log('[AUTH][PROFILE_FETCH_DEBUG]', {
        baseURL: requestBaseURL,
        requestUrl: fullRequestUrl,
        headers: requestHeaders,
        message: error?.message,
        code: error?.code,
        isAxiosError: error?.isAxiosError === true,
        status: error?.response?.status ?? null,
        responseDataPreview: responsePreview,
      })
      const status = error?.response?.status
      const authInvalid = error?.authInvalid === true
      const authFailureCode = error?.authFailureCode
      if (authInvalid) {
        bootTrace('profile_fetch_session_clear', {
          status: error?.authFailureStatus ?? status ?? null,
          reason: authFailureCode || 'confirmed_refresh_invalid',
        })
        await clearTokens()
        setToken(null)
        setRefreshToken(null)
        setUser(null)
        userRef.current = null
        profileLoadedRef.current = false
        profileFetchInFlightRef.current = false
        setProfileError('Session expired. Please log in again.')
        setProfileErrorStatus(error?.authFailureStatus ?? status ?? 401)
        return null
      }
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load profile'
      bootTrace('profile_fetch_error', { status: status ?? null, message: String(message) })
      setProfileError(String(message))
      setProfileErrorStatus(status ?? null)
      return null
    } finally {
      profileFetchInFlightRef.current = false
      setProfileLoading(false)
    }
  }, [token, bootTrace])

  const bootstrap = useCallback(async () => {
    bootTrace('bootstrap_start')
    try {
      const storedAccess = await getStoredAccessToken()
      const storedRefresh = await getStoredRefreshToken()

      if (storedAccess) {
        const cleanAccess = normalize(storedAccess)
        setToken(cleanAccess)
        client.defaults.headers.Authorization = `Bearer ${cleanAccess}`
        bootTrace('bootstrap_token_restored', { tokenPresent: true })
      } else {
        setToken(null)
        delete client.defaults.headers.Authorization
        bootTrace('bootstrap_token_missing', { tokenPresent: false })
      }

      if (storedRefresh) setRefreshToken(normalize(storedRefresh))
      else setRefreshToken(null)

      if (storedAccess) {
        const cleanAccess = normalize(storedAccess)
        await refreshProfile({ force: true, tokenOverride: cleanAccess }).catch(async () => {
          await clearTokens()
          setToken(null)
          setRefreshToken(null)
          setUser(null)
          userRef.current = null
          profileLoadedRef.current = false
          setProfileError(null)
          setProfileErrorStatus(null)
        })
      }
    } finally {
      setLoading(false)
      setAuthHydrated(true)
      bootTrace('bootstrap_done')
    }
  }, [refreshProfile, bootTrace])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const onUnauthorized = async (payload?: { reason?: string; status?: number | null }) => {
      bootTrace('unauthorized_event', {
        reason: payload?.reason || null,
        status: payload?.status ?? null,
      })
      await clearTokens()
      setToken(null)
      setRefreshToken(null)
      setUser(null)
      userRef.current = null
      profileLoadedRef.current = false
      profileFetchInFlightRef.current = false
      setProfileError(null)
      setProfileErrorStatus(null)
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
    if (token) return
    profileLoadedRef.current = false
    profileFetchInFlightRef.current = false
    lastProfileFetchAtRef.current = 0
    userRef.current = null
    setProfileError(null)
    setProfileErrorStatus(null)
    bootstrapProfileAttemptedForTokenRef.current = null
  }, [token])

  useEffect(() => {
    if (!authHydrated) return
    if (!token) {
      bootstrapProfileAttemptedForTokenRef.current = null
      return
    }
    if (user || profileLoading || profileFetchInFlightRef.current) return
    if (bootstrapProfileAttemptedForTokenRef.current === token) return

    bootstrapProfileAttemptedForTokenRef.current = token
    bootTrace('post_hydration_profile_fetch_trigger')
    void refreshProfile({ force: true })
  }, [authHydrated, token, user, profileLoading, refreshProfile, bootTrace])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      // Mark stale on resume only if profile is old enough to need refresh.
      if (nextState === 'active' && Date.now() - lastProfileFetchAtRef.current > 60_000) {
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

      log('[AUTH] login', { url: loginUrl, status: res.status })

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
      bootTrace('login_success', { status: res.status })

      await refreshProfile({ force: true })
      return json
    },
    [refreshProfile, bootTrace]
  )

  const logout = useCallback(async () => {
    bootTrace('logout_start')
    await clearTokens()
    await clearAppLockPersisted().catch(() => {})
    setToken(null)
    setRefreshToken(null)
    setUser(null)
    userRef.current = null
    profileLoadedRef.current = false
    bootstrapProfileAttemptedForTokenRef.current = null
    bootTrace('logout_done')
  }, [bootTrace])

  const establishSessionFromTokens = useCallback(
    async (accessToken: string, refreshTokenValue?: string | null) => {
      const cleanAccess = normalize(accessToken)
      if (!cleanAccess) throw new Error('Missing access token')

      const cleanRefresh = refreshTokenValue ? normalize(refreshTokenValue) : null
      await saveTokens(cleanAccess, cleanRefresh || null)
      setToken(cleanAccess)
      setRefreshToken(cleanRefresh || null)
      bootTrace('session_established_from_tokens')
      await refreshProfile({ force: true })
    },
    [refreshProfile, bootTrace]
  )

  useEffect(() => {
    bootTrace('state_change')
  }, [authHydrated, authenticated, token, profileLoading, user, profileError, bootTrace])

  const onRegister = async (formData: any) => {
    const userProfile: Record<string, any> = {}
    if (formData?.first_name) userProfile.first_name = formData.first_name
    if (formData?.last_name) userProfile.last_name = formData.last_name
    if (formData?.phone) userProfile.phone_number = formData.phone

    const payload = {
      user: {
        email: (formData?.email || '').trim(),
        password: (formData?.password || '').trim(),
        password_confirmation: (formData?.confirm_password || '').trim(),
        ...(Object.keys(userProfile).length ? { user_profile_attributes: userProfile } : {}),
      },
    }

    if (!payload.user.email || !payload.user.password || !payload.user.password_confirmation) {
      throw new Error('Email and password are required')
    }

    const result = await signupApi(payload)
    await setEmailForVerification(payload.user.email)
    return result
  }

  const value = useMemo<AuthContextValue>(() => {
    const legacyAuthState: LegacyAuthState = {
      token,
      authenticated: token ? true : null,
    }

    return {
      loading,
      authHydrated,
      profileLoading,
      profileError,
      profileErrorStatus,

      token,
      refreshToken,
      user,
      authenticated,

      login,
      logout,
      establishSessionFromTokens,
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

export { resolveUserProfile } from '@/services/auth/resolveUserProfile'
