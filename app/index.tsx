import { useCallback, useEffect, useRef } from 'react'
import { View } from 'react-native'
import { useRootNavigationState, useRouter } from 'expo-router'
import { useAuth } from '../services/useAuth'
import { useAppLock } from '../services/useAppLock'
import { log } from '@/utils/logger'

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
  } = useAuth()
  const { locked } = useAppLock()
  const lastRedirectRef = useRef<string | null>(null)
  const failsafeTriggeredRef = useRef(false)
  const hasProfile = !!userProfileData

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

  return <View style={{ flex: 1, backgroundColor: '#05070D' }} />
}
