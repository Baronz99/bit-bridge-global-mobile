import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { invalidateFetchQueries } from '@/services/useFetch'

export type ActiveAccount =
  | { type: 'personal' }
  | { type: 'business'; businessId: string }
  | { type: 'circle'; circleId: string }

type ActiveAccountContextValue = {
  activeAccount: ActiveAccount
  hydrated: boolean
  setActiveAccount: (next: ActiveAccount) => Promise<void>
  selectPersonalAccount: () => Promise<void>
  selectBusinessAccount: (businessId: string) => Promise<void>
  selectCircleAccount: (circleId: string) => Promise<void>
}

const ACTIVE_ACCOUNT_KEY = 'active_account_context_v1'
const PERSONAL_ACCOUNT: ActiveAccount = { type: 'personal' }

const ActiveAccountContext = createContext<ActiveAccountContextValue | null>(null)

const normalizeActiveAccount = (value: any): ActiveAccount => {
  if (value?.type === 'business') {
    const businessId = String(value?.businessId || '').trim()
    if (businessId) return { type: 'business', businessId }
  }
  if (value?.type === 'circle') {
    const circleId = String(value?.circleId || '').trim()
    if (circleId) return { type: 'circle', circleId }
  }
  return PERSONAL_ACCOUNT
}

export function ActiveAccountProvider({ children }: { children: React.ReactNode }) {
  const [activeAccount, setActiveAccountState] = useState<ActiveAccount>(PERSONAL_ACCOUNT)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let mounted = true
    const restore = async () => {
      try {
        const raw = await SecureStore.getItemAsync(ACTIVE_ACCOUNT_KEY)
        if (!mounted) return
        if (raw) {
          // Product decision: every cold app launch starts in personal.
          // We still clear any previously persisted workspace so the
          // switcher label cannot disagree with the landing screen.
          await SecureStore.deleteItemAsync(ACTIVE_ACCOUNT_KEY).catch(() => {})
        }
        setActiveAccountState(PERSONAL_ACCOUNT)
      } catch {
        if (mounted) setActiveAccountState(PERSONAL_ACCOUNT)
      } finally {
        if (mounted) setHydrated(true)
      }
    }

    void restore()
    return () => {
      mounted = false
    }
  }, [])

  const persist = useCallback(async (next: ActiveAccount) => {
    const normalized = normalizeActiveAccount(next)
    const unchanged =
      (normalized.type === 'personal' && activeAccount.type === 'personal') ||
      (normalized.type === 'business' &&
        activeAccount.type === 'business' &&
        normalized.businessId === activeAccount.businessId) ||
      (normalized.type === 'circle' &&
        activeAccount.type === 'circle' &&
        normalized.circleId === activeAccount.circleId)
    if (unchanged) return
    setActiveAccountState(normalized)
    await SecureStore.setItemAsync(ACTIVE_ACCOUNT_KEY, JSON.stringify(normalized)).catch(() => {})
    setTimeout(() => {
      void invalidateFetchQueries(() => true)
    }, 0)
  }, [activeAccount])

  const setActiveAccount = useCallback(
    async (next: ActiveAccount) => {
      await persist(next)
    },
    [persist]
  )

  const selectPersonalAccount = useCallback(async () => {
    await persist(PERSONAL_ACCOUNT)
  }, [persist])

  const selectBusinessAccount = useCallback(
    async (businessId: string) => {
      const clean = String(businessId || '').trim()
      if (!clean) return
      await persist({ type: 'business', businessId: clean })
    },
    [persist]
  )

  const selectCircleAccount = useCallback(
    async (circleId: string) => {
      const clean = String(circleId || '').trim()
      if (!clean) return
      await persist({ type: 'circle', circleId: clean })
    },
    [persist]
  )

  const value = useMemo<ActiveAccountContextValue>(
    () => ({
      activeAccount,
      hydrated,
      setActiveAccount,
      selectPersonalAccount,
      selectBusinessAccount,
      selectCircleAccount,
    }),
    [activeAccount, hydrated, setActiveAccount, selectPersonalAccount, selectBusinessAccount, selectCircleAccount]
  )

  return <ActiveAccountContext.Provider value={value}>{children}</ActiveAccountContext.Provider>
}

export function useActiveAccount() {
  const ctx = useContext(ActiveAccountContext)
  if (!ctx) throw new Error('useActiveAccount must be used within an ActiveAccountProvider')
  return ctx
}
