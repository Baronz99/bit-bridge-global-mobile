import React, { useEffect, useMemo, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar, Text, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import './globals.css'

import { AuthProvider } from '@/services/useAuth'
import { AppLockProvider } from '../services/useAppLock'
import { BalancePrivacyProvider } from '@/services/useBalancePrivacy'
import { useAuth } from '@/services/useAuth'
import { setLastFatalError } from '@/services/fatalError'
import { FEATURE_TIMELINE } from '@/constants/featureFlags'
import { log } from '@/utils/logger'
import BootScreen from '@/src/components/BootScreen'

void SplashScreen.preventAutoHideAsync().catch(() => {})

type ErrorBoundaryState = { hasError: boolean; message: string | null }

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    const message = [error?.message || 'Unknown render error', error?.stack || '']
      .filter(Boolean)
      .join('\n')
      .slice(0, 4000)
    setLastFatalError(message)
    return { hasError: true, message }
  }

  componentDidCatch(error: any, errorInfo: any) {
    const stack = errorInfo?.componentStack || ''
    const payload = [error?.message || 'Unknown render error', error?.stack || '', stack]
      .filter(Boolean)
      .join('\n')
      .slice(0, 4000)
    setLastFatalError(payload)
    log('[FATAL][RENDER]', payload)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Something went wrong</Text>
          <Text style={{ color: '#aaa', marginTop: 8, fontSize: 12, textAlign: 'center' }}>
            {this.state.message || 'Unknown render failure'}
          </Text>
        </View>
      )
    }
    return this.props.children
  }
}

function StartupGate({ children }: { children: React.ReactNode }) {
  const { loading, authHydrated, authenticated, userProfileData, profileLoading, loadProfile } = useAuth()
  const [warmupDone, setWarmupDone] = useState(false)
  const [hardTimeoutReached, setHardTimeoutReached] = useState(false)

  useEffect(() => {
    // Hide native splash as soon as JS is ready to render our in-app boot overlay.
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!authHydrated || loading) {
      setWarmupDone(false)
      return () => {
        cancelled = true
      }
    }

    const runWarmup = async () => {
      // Give warmup requests a strict upper bound so boot never stalls.
      await Promise.race([
        authenticated ? loadProfile({ force: false }).catch(() => null) : Promise.resolve(null),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ])
      if (!cancelled) setWarmupDone(true)
    }

    void runWarmup()
    return () => {
      cancelled = true
    }
  }, [authHydrated, loading, authenticated, loadProfile])

  useEffect(() => {
    const timeout = setTimeout(() => setHardTimeoutReached(true), 8000)
    return () => clearTimeout(timeout)
  }, [])

  const appReady = useMemo(() => {
    if (hardTimeoutReached) return true
    if (!authHydrated || loading) return false
    if (!warmupDone) return false
    if (!authenticated) return true
    if (userProfileData) return true
    return !profileLoading
  }, [hardTimeoutReached, authHydrated, loading, warmupDone, authenticated, userProfileData, profileLoading])

  return (
    <>
      {children}
      <BootScreen visible={!appReady} />
    </>
  )
}

export default function RootLayout() {
  useEffect(() => {
    log('[BOOT_TRACE][ROOT_LAYOUT]', { event: 'providers_mounted' })
    if (__DEV__) {
      log('[FEATURE_FLAG][TIMELINE]', {
        EXPO_PUBLIC_FEATURE_TIMELINE: String(process.env.EXPO_PUBLIC_FEATURE_TIMELINE ?? ''),
        resolved: FEATURE_TIMELINE,
      })
    }

    const utils = (global as any).ErrorUtils
    const previousHandler = typeof utils?.getGlobalHandler === 'function' ? utils.getGlobalHandler() : null
    if (typeof utils?.setGlobalHandler === 'function') {
      utils.setGlobalHandler((error: any, isFatal?: boolean) => {
        const payload = [
          isFatal ? 'Fatal JS Error' : 'JS Error',
          error?.message || String(error),
          error?.stack || '',
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 4000)
        setLastFatalError(payload)
        log('[FATAL][GLOBAL]', payload)
        if (typeof previousHandler === 'function') {
          previousHandler(error, isFatal)
        }
      })
    }

    return () => {
      if (typeof utils?.setGlobalHandler === 'function' && typeof previousHandler === 'function') {
        utils.setGlobalHandler(previousHandler)
      }
    }
  }, [])

  return (
    <RootErrorBoundary>
      <AuthProvider>
        <BalancePrivacyProvider>
          <AppLockProvider>
            <StartupGate>
              <StatusBar hidden={false} barStyle="light-content" backgroundColor="black" />

            <Stack
              screenOptions={{
                headerTitleStyle: { color: 'orange' },
                headerStyle: { backgroundColor: '#030014' },
                headerTintColor: 'white',
              }}
            >
        {/* ✅ IMPORTANT:
            Let app/index.tsx decide whether we land in (tabs) or login.
            So we keep both screens, but we do NOT assume (tabs) is the start. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerTitle: 'Home' }} />
        <Stack.Screen name="lock" options={{ headerShown: false }} />

        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ headerTitle: 'Register' }} />
        <Stack.Screen name="forgot-password" options={{ headerTitle: 'Forgot Password' }} />
        <Stack.Screen name="reset-password" options={{ headerTitle: 'Reset Password' }} />

        <Stack.Screen name="onboarding/index" options={{ headerTitle: 'Onboarding' }} />
        <Stack.Screen name="onboarding/basic-profile" options={{ headerTitle: 'Basic Profile' }} />
        <Stack.Screen name="onboarding/use-case" options={{ headerTitle: 'Use Case' }} />
        <Stack.Screen name="onboarding/kyc-profile" options={{ headerTitle: 'KYC Profile' }} />
        <Stack.Screen name="kyc/anchor-verify" options={{ headerTitle: 'Anchor KYC' }} />
        <Stack.Screen name="kyc/documents" options={{ headerTitle: 'KYC Documents' }} />

        <Stack.Screen name="mobileProviders/index" options={{ headerTitle: 'Mobile Top Up' }} />
        <Stack.Screen name="mobileProviders/[id]/index" options={{ headerTitle: 'Mobile Top Up' }} />
        <Stack.Screen
          name="mobileProviders/[id]/confirm/[orderId]"
          options={{ headerTitle: 'Confirm Payment' }}
        />

        <Stack.Screen name="fundWallet/index" options={{ headerTitle: 'Fund Wallet' }} />
        <Stack.Screen name="withdrawFund/index" options={{ headerTitle: 'Withdraw Fund' }} />
        <Stack.Screen name="currency/convert" options={{ headerTitle: 'Currency Conversion' }} />

        <Stack.Screen name="bank-list/index" options={{ headerTitle: 'Bank List' }} />
        <Stack.Screen name="beneficiaries/index" options={{ headerTitle: 'Beneficiaries' }} />
        <Stack.Screen name="add-beneficiary/index" options={{ headerTitle: 'Add Beneficiary' }} />
        <Stack.Screen name="send-money/index" options={{ headerTitle: 'Send Money' }} />
        <Stack.Screen name="bank-transfer" options={{ headerShown: false }} />
        <Stack.Screen name="transfer-status/index" options={{ headerTitle: 'Transfer Status' }} />
        <Stack.Screen name="anchor-account/index" options={{ headerTitle: 'Anchor Account' }} />

        <Stack.Screen name="tunnel-activation/index" options={{ headerTitle: 'Tunnel Activation' }} />
        <Stack.Screen
          name="convert-ngn-to-usd/index"
          options={{ headerTitle: 'Convert NGN to USD' }}
        />
        <Stack.Screen
          name="convert-usd-to-ngn/index"
          options={{ headerTitle: 'Convert USD to NGN' }}
        />

        <Stack.Screen name="transaction/confirm" options={{ headerTitle: 'Status' }} />
        <Stack.Screen name="transaction/details" options={{ headerTitle: 'Transaction Details' }} />
        <Stack.Screen
          name="transaction/record/[reference]"
          options={{ headerTitle: 'Wallet Transaction' }}
        />
        <Stack.Screen
          name="transaction/wallet-receipt"
          options={{ headerTitle: 'Receipt' }}
        />
        <Stack.Screen name="orders/index" options={{ headerTitle: 'Orders' }} />
        <Stack.Screen name="orders/[id]" options={{ headerTitle: 'Order Details' }} />
        <Stack.Screen name="orders/confirm" options={{ headerTitle: 'Order Confirmation' }} />
        <Stack.Screen name="orders/[id]/dispute" options={{ headerTitle: 'Dispute' }} />

        <Stack.Screen name="cableProviders/index" options={{ headerTitle: 'Cable TV List' }} />
        <Stack.Screen name="cableProviders/[id]/index" options={{ headerTitle: 'Subscribe TV' }} />
        <Stack.Screen
          name="cableProviders/[id]/confirm/[orderId]"
          options={{ headerTitle: 'Confirm Payment' }}
        />

        <Stack.Screen name="powerProviders/index" options={{ headerTitle: 'Electric Bills' }} />
        <Stack.Screen
          name="powerProviders/[id]/index"
          options={{ headerTitle: 'Pay Electric Bills' }}
        />

        <Stack.Screen name="electricity-provider/index" options={{ headerTitle: 'Electricity' }} />
        <Stack.Screen
          name="electricity-provider/[id]/index"
          options={{ headerTitle: 'Electric Bills' }}
        />

        <Stack.Screen name="history/index" options={{ headerTitle: 'History' }} />

        <Stack.Screen name="airtime-top-up/index" options={{ headerTitle: 'Airtime' }} />
        <Stack.Screen name="data-subscription/index" options={{ headerTitle: 'Data' }} />
        <Stack.Screen name="cable-tv-provider/index" options={{ headerTitle: 'Cable TV' }} />

        <Stack.Screen name="delete-deactivate/index" options={{ headerTitle: 'Delete Account' }} />
        <Stack.Screen name="change-password/index" options={{ headerTitle: 'Change Password' }} />
        <Stack.Screen name="settings/pin/index" options={{ headerTitle: 'Transaction PIN' }} />
        <Stack.Screen name="settings/pin/set" options={{ headerTitle: 'Set PIN' }} />
        <Stack.Screen name="settings/pin/change" options={{ headerTitle: 'Change PIN' }} />
        <Stack.Screen name="settings/pin/reset" options={{ headerTitle: 'Reset PIN' }} />
        <Stack.Screen name="settings/card-tokens/index" options={{ headerTitle: 'Saved Cards' }} />
        <Stack.Screen name="payment-tools/index" options={{ headerTitle: 'Payment Tools' }} />
        <Stack.Screen name="payment-tools/query" options={{ headerTitle: 'Query Transaction' }} />
        <Stack.Screen name="payment-tools/ref-order" options={{ headerTitle: 'Reference Order' }} />
        <Stack.Screen name="payment-tools/create-user-transaction" options={{ headerTitle: 'Create Transaction' }} />
        <Stack.Screen name="rewards/index" options={{ headerTitle: 'Rewards' }} />
        <Stack.Screen name="wallet/stats" options={{ headerTitle: 'Wallet Stats' }} />
        <Stack.Screen name="legal/index" options={{ headerTitle: 'Legal' }} />

        <Stack.Screen name="accountProfile/index" options={{ headerTitle: 'Update Profile' }} />
        <Stack.Screen name="accountDetails/index" options={{ headerTitle: 'Account Details' }} />
        <Stack.Screen name="accounts/index" options={{ headerTitle: 'Virtual Accounts' }} />
        <Stack.Screen name="accounts/create" options={{ headerTitle: 'Create Account' }} />
        <Stack.Screen name="cards/index" options={{ headerTitle: 'Cards' }} />
        <Stack.Screen name="cards/[id]" options={{ headerTitle: 'Card Details' }} />
        <Stack.Screen name="cards/create" options={{ headerTitle: 'Create Card' }} />
        <Stack.Screen name="circles/[id]/fund" options={{ headerTitle: 'Fund Circle' }} />
        <Stack.Screen name="circles/[id]/withdraw" options={{ headerTitle: 'Withdraw' }} />
        <Stack.Screen name="circles/[id]/activities" options={{ headerTitle: 'Activities' }} />
        <Stack.Screen name="circles/[id]/audit" options={{ headerTitle: 'Audit Summary' }} />
        <Stack.Screen name="circles/[id]/invite" options={{ headerTitle: 'Invite Member' }} />
        <Stack.Screen name="confirmEmail" options={{ headerTitle: 'Email Confirmation' }} />
        <Stack.Screen name="confirmation" options={{ headerTitle: 'Confirm Email' }} />
            </Stack>
            </StartupGate>
          </AppLockProvider>
        </BalancePrivacyProvider>
      </AuthProvider>
    </RootErrorBoundary>
  )
}
