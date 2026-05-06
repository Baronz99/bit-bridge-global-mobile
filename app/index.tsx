import { useCallback, useEffect, useRef } from 'react'
import { View } from 'react-native'
import { useRootNavigationState, useRouter } from 'expo-router'
import { useAuth } from '../services/useAuth'
import { useAppLock } from '../services/useAppLock'
import { useActiveAccount } from '@/services/useActiveAccount'
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
  } = useAuth()
  const { locked } = useAppLock()
  const { activeAccount, hydrated: accountHydrated, selectPersonalAccount } = useActiveAccount()
  const lastRedirectRef = useRef<string | null>(null)
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
        activeAccountType: activeAccount?.type,
        accountHydrated,
        lastProfileError: profileError,
        redirect,
        navigationReady,
        ...extra,
      })
    },
    [authHydrated, authenticated, token, profileLoading, hasProfile, activeAccount?.type, accountHydrated, profileError, navigationReady]
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
      safeReplace('/welcome', 'no_token_after_hydration')
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

    if (!accountHydrated) {
      bootTrace('waiting_for_account_context')
      return
    }

    if (activeAccount?.type !== 'personal') {
      bootTrace('resetting_workspace_to_personal', null, { previousWorkspace: activeAccount?.type })
      void selectPersonalAccount().then(() => {
        safeReplace('/(tabs)', 'authed_profile_ready_after_workspace_reset')
      })
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
    accountHydrated,
    activeAccount,
    selectPersonalAccount,
    safeReplace,
    bootTrace,
  ])

  return <View style={{ flex: 1, backgroundColor: '#05070D' }} />
}
