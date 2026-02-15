import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, TouchableOpacity, View, Text } from 'react-native'
import { useRootNavigationState, useRouter } from 'expo-router'
import { useAuth } from '../services/useAuth'
import { useAppLock } from '../services/useAppLock'
import { getLastFatalError, subscribeLastFatalError } from '@/services/fatalError'
import { DEBUG_ENABLED, log } from '@/utils/logger'

export default function Index() {
  const router = useRouter()
  const rootNavigationState = useRootNavigationState()
  const navigationReady = !!rootNavigationState?.key
  const {
    loading,
    authenticated,
    authHydrated,
    profileLoading,
    profileError,
    token,
    userProfileData,
    onLogout,
    loadProfile,
  } = useAuth()
  const { locked } = useAppLock()
  const lastRedirectRef = useRef<string | null>(null)
  const failsafeTriggeredRef = useRef(false)
  const hasProfile = !!userProfileData
  const [lastFatalError, setLastFatalErrorState] = useState<string | null>(getLastFatalError())
  const showFatalDiagnostics = DEBUG_ENABLED

  useEffect(() => {
    return subscribeLastFatalError(setLastFatalErrorState)
  }, [])

  const bootTrace = useCallback(
    (event: string, redirect: string | null = null, extra: Record<string, unknown> = {}) => {
      log('[BOOT_TRACE][INDEX]', {
        event,
        hydrated: authHydrated,
        authed: authenticated,
        tokenPresent: !!token,
        profileLoading,
        hasProfile,
        lastProfileError: profileError,
        redirect,
        navigationReady,
        ...extra,
      })
    },
    [authHydrated, authenticated, token, profileLoading, hasProfile, profileError, navigationReady]
  )

  const safeReplace = useCallback(
    (target: string, reason: string) => {
      if (!navigationReady) {
        bootTrace('redirect_skipped_nav_not_ready', target, { reason })
        return
      }
      if (lastRedirectRef.current === target) return
      lastRedirectRef.current = target
      bootTrace('redirect', target, { reason })
      router.replace(target as any)
    },
    [navigationReady, router, bootTrace]
  )

  useEffect(() => {
    bootTrace('state_change')
  }, [bootTrace])

  useEffect(() => {
    if (!authHydrated) return
    if (loading) return

    if (!authenticated) {
      safeReplace('/login', 'no_token_after_hydration')
      return
    }

    if (locked) {
      safeReplace('/lock', 'app_lock_enabled')
      return
    }

    if (profileLoading || !hasProfile) {
      bootTrace('waiting_for_profile')
      return
    }

    safeReplace('/(tabs)', 'authed_profile_ready')
  }, [
    authHydrated,
    loading,
    authenticated,
    locked,
    profileLoading,
    hasProfile,
    safeReplace,
    bootTrace,
  ])

  useEffect(() => {
    if (!authHydrated || !authenticated || hasProfile) {
      failsafeTriggeredRef.current = false
      return
    }
    const timeout = setTimeout(async () => {
      if (failsafeTriggeredRef.current) return
      failsafeTriggeredRef.current = true
      bootTrace('failsafe_session_clear', '/login', { reason: 'authed_no_profile_8s_timeout' })
      await onLogout()
      safeReplace('/login', 'failsafe_authed_no_profile_8s')
    }, 8000)
    return () => clearTimeout(timeout)
  }, [authHydrated, authenticated, hasProfile, onLogout, safeReplace, bootTrace])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
      <Image
        source={require('../assets/logos/bitbridge-logo-clear.png')}
        style={{ width: 150, height: 150 }}
        resizeMode="contain"
      />
      <View style={{ height: 10 }} />
      <ActivityIndicator size="large" color="#FFCC00" />
      <View style={{ height: 14 }} />
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Loading your account...</Text>
      {showFatalDiagnostics ? (
        <View style={{ marginTop: 8, alignItems: 'center' }}>
          <Text style={{ color: '#aaa', marginTop: 6, fontSize: 12 }}>
            hydrated: {String(authHydrated)} | loading: {String(loading)} | authed: {String(authenticated)}
          </Text>
          <Text style={{ color: '#aaa', marginTop: 6, fontSize: 12 }}>
            tokenPresent: {String(!!token)} | profileLoading: {String(profileLoading)} | hasProfile:{' '}
            {String(hasProfile)}
          </Text>
          <Text style={{ color: '#aaa', marginTop: 6, fontSize: 12 }}>
            lastProfileError: {profileError ? String(profileError) : 'none'}
          </Text>
          <Text style={{ color: '#f97316', marginTop: 6, fontSize: 11, paddingHorizontal: 12 }} numberOfLines={8}>
            lastFatalError: {lastFatalError || 'none'}
          </Text>
        </View>
      ) : null}
      <TouchableOpacity
        onPress={() => {
          if (profileLoading) return
          bootTrace('manual_retry_profile_fetch')
          void loadProfile({ force: true })
        }}
        style={{
          marginTop: 12,
          borderWidth: 1,
          borderColor: '#555',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: '#ddd' }}>{profileLoading ? 'Retrying...' : 'Try again'}</Text>
      </TouchableOpacity>
    </View>
  )
}
