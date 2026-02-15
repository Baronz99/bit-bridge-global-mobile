import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import {
  clearAppLockPersisted,
  getAppLockBackgroundAt,
  saveAppLockBackgroundAt,
} from '@/services/appLockStorage'
import { log } from '@/utils/logger'

const LOCK_AFTER_MS = Number(process.env.EXPO_PUBLIC_LOCK_AFTER_MS || 180000)

type AppLockContextValue = {
  locked: boolean
  backgroundAt: number | null
  lockNow: () => void
  unlock: () => Promise<void> | void
  resetTimers: () => Promise<void> | void
  setLocked: (value: boolean) => void
  refreshStatus: () => Promise<void>
}

const AppLockContext = createContext<AppLockContextValue | null>(null)

const parsePinStatus = (raw: any) => {
  const data = raw?.data ?? raw
  const hasPin =
    data?.has_pin === true ||
    data?.hasPin === true ||
    data?.pin_set === true ||
    data?.pinSet === true ||
    data?.status === 'set' ||
    data?.status === 'SET'

  const appLockEnabled =
    data?.app_lock_enabled === true ||
    data?.appLockEnabled === true

  return {
    hasPin,
    appLockEnabled,
    shouldLock: hasPin && appLockEnabled,
  }
}

export const AppLockProvider = ({ children }: { children: React.ReactNode }) => {
  const { authenticated, authHydrated } = useAuth()

  const [locked, setLockedState] = useState(false)
  const [backgroundAt, setBackgroundAt] = useState<number | null>(null)
  const bgRef = useRef<number | null>(null)
  const unlockedSessionRef = useRef(false)
  const statusCheckInFlightRef = useRef(false)
  const appLockEnabledRef = useRef(false)

  const persistBackground = useCallback(async (value: number) => {
    bgRef.current = value
    setBackgroundAt(value)
    await saveAppLockBackgroundAt(value)
  }, [])

  const clearBackground = useCallback(async () => {
    bgRef.current = null
    setBackgroundAt(null)
    await clearAppLockPersisted()
  }, [])

  useEffect(() => {
    getAppLockBackgroundAt().then((parsed) => {
      if (parsed !== null) {
        bgRef.current = parsed
        setBackgroundAt(parsed)
      }
    })
  }, [])

  const lockNow = useCallback(() => setLockedState(true), [])

  const unlock = useCallback(async () => {
    setLockedState(false)
    unlockedSessionRef.current = true
    await clearBackground()
  }, [clearBackground])

  const resetTimers = useCallback(async () => {
    await clearBackground()
  }, [clearBackground])

  const handleStateChange = useCallback(
    (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const now = Date.now()
        void persistBackground(now)
        log('[APP_LOCK] background', { at: now })
        return
      }

      if (nextState === 'active') {
        if (!authenticated) {
          void unlock()
          return
        }

        if (!appLockEnabledRef.current) {
          void clearBackground()
          return
        }

        const lastBg = bgRef.current ?? backgroundAt
        const elapsed = lastBg ? Date.now() - lastBg : null
        log('[APP_LOCK] resume', { lastBg, elapsed })
        if (lastBg && elapsed !== null && elapsed >= LOCK_AFTER_MS) {
          setLockedState(true)
          log('[APP_LOCK] locked due to idle')
        }
        void clearBackground()
      }
    },
    [authenticated, backgroundAt, clearBackground, persistBackground, unlock]
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleStateChange)
    return () => subscription.remove()
  }, [handleStateChange])

  const refreshStatus = useCallback(async () => {
    if (!authenticated || !authHydrated) return
    if (statusCheckInFlightRef.current) return
    statusCheckInFlightRef.current = true
    try {
      const res = await getTransactionPinStatus()
      const parsed = parsePinStatus(res)
      appLockEnabledRef.current = parsed.shouldLock
      log('[APP_LOCK] status', parsed)

      if (parsed.shouldLock) {
        if (!unlockedSessionRef.current) {
          setLockedState(true)
        }
      } else {
        setLockedState(false)
      }
    } catch (e) {
      log('[APP_LOCK] status check failed', (e as any)?.message || e)
    } finally {
      statusCheckInFlightRef.current = false
    }
  }, [authenticated, authHydrated])

  useEffect(() => {
    if (!authenticated || !authHydrated) {
      setLockedState(false)
      appLockEnabledRef.current = false
      unlockedSessionRef.current = false
      void clearBackground()
      return
    }
    void refreshStatus()
  }, [authenticated, authHydrated, refreshStatus, clearBackground])

  useEffect(() => {
    if (!authenticated) {
      setLockedState(false)
      appLockEnabledRef.current = false
      unlockedSessionRef.current = false
      void clearBackground()
    }
  }, [authenticated, clearBackground])

  const value = useMemo<AppLockContextValue>(
    () => ({
      locked,
      backgroundAt,
      lockNow,
      unlock,
      resetTimers,
      setLocked: setLockedState,
      refreshStatus,
    }),
    [backgroundAt, lockNow, locked, refreshStatus, resetTimers, unlock]
  )

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
}

export const useAppLock = () => {
  const ctx = useContext(AppLockContext)
  if (!ctx) throw new Error('useAppLock must be used within an AppLockProvider')
  return ctx
}
