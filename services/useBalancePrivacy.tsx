import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as SecureStore from 'expo-secure-store'

const BALANCE_PRIVACY_KEY = 'balance_privacy_hidden_v1'

type LocalAuthResult = {
  success: boolean
  error?: string
}

type LocalAuthModule = {
  hasHardwareAsync: () => Promise<boolean>
  isEnrolledAsync: () => Promise<boolean>
  authenticateAsync: (options: {
    promptMessage: string
    cancelLabel?: string
    fallbackLabel?: string
    disableDeviceFallback?: boolean
  }) => Promise<LocalAuthResult>
}

type BalancePrivacyContextValue = {
  balancesHidden: boolean
  ready: boolean
  setBalancesHidden: (hidden: boolean) => Promise<void>
  toggleBalancesVisibility: () => Promise<boolean>
  maskFormattedAmount: (formatted: string) => string
}

const BalancePrivacyContext = createContext<BalancePrivacyContextValue | undefined>(undefined)

const loadLocalAuthentication = async (): Promise<LocalAuthModule | null> => {
  try {
    const mod = await import('expo-local-authentication')
    const api = (mod?.default ?? mod) as LocalAuthModule
    if (
      api &&
      typeof api.hasHardwareAsync === 'function' &&
      typeof api.isEnrolledAsync === 'function' &&
      typeof api.authenticateAsync === 'function'
    ) {
      return api
    }
    return null
  } catch {
    return null
  }
}

const authForReveal = async () => {
  const localAuth = await loadLocalAuthentication()
  if (!localAuth) return true

  try {
    const hasHardware = await localAuth.hasHardwareAsync()
    const isEnrolled = await localAuth.isEnrolledAsync()
    if (!hasHardware || !isEnrolled) return true

    const result = await localAuth.authenticateAsync({
      promptMessage: 'Reveal balances',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use device passcode',
      disableDeviceFallback: false,
    })
    return result.success === true
  } catch {
    return false
  }
}

export const BalancePrivacyProvider = ({ children }: { children: React.ReactNode }) => {
  const [balancesHidden, setBalancesHiddenState] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const raw = await SecureStore.getItemAsync(BALANCE_PRIVACY_KEY)
        if (!mounted) return
        if (raw === 'false') {
          setBalancesHiddenState(false)
        } else {
          setBalancesHiddenState(true)
        }
      } catch {
        if (mounted) setBalancesHiddenState(true)
      } finally {
        if (mounted) setReady(true)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const persist = useCallback(async (next: boolean) => {
    setBalancesHiddenState(next)
    await SecureStore.setItemAsync(BALANCE_PRIVACY_KEY, String(next)).catch(() => {})
  }, [])

  const setBalancesHidden = useCallback(
    async (hidden: boolean) => {
      await persist(Boolean(hidden))
    },
    [persist]
  )

  const toggleBalancesVisibility = useCallback(async () => {
    if (balancesHidden) {
      const allowed = await authForReveal()
      if (!allowed) return false
      await persist(false)
      return true
    }
    await persist(true)
    return true
  }, [balancesHidden, persist])

  const maskFormattedAmount = useCallback((formatted: string) => {
    const value = String(formatted || '')
    if (!value) return '••••••'
    const masked = value.replace(/\d/g, '•')
    return masked === value ? '••••••' : masked
  }, [])

  const value = useMemo(
    () => ({
      balancesHidden,
      ready,
      setBalancesHidden,
      toggleBalancesVisibility,
      maskFormattedAmount,
    }),
    [balancesHidden, ready, setBalancesHidden, toggleBalancesVisibility, maskFormattedAmount]
  )

  return <BalancePrivacyContext.Provider value={value}>{children}</BalancePrivacyContext.Provider>
}

export const useBalancePrivacy = () => {
  const ctx = useContext(BalancePrivacyContext)
  if (!ctx) throw new Error('useBalancePrivacy must be used within BalancePrivacyProvider')
  return ctx
}

