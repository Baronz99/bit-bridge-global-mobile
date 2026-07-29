import React, { useEffect, useMemo, useState } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar, Text, TouchableOpacity, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import './globals.css'

import { AuthProvider } from '@/services/useAuth'
import { AppLockProvider } from '../services/useAppLock'
import { BalancePrivacyProvider } from '@/services/useBalancePrivacy'
import { ActiveAccountProvider } from '@/services/useActiveAccount'
import { useAuth } from '@/services/useAuth'
import { setLastFatalError } from '@/services/fatalError'
import { authEvents, clearTokens } from '@/api/client'
import { FEATURE_TIMELINE } from '@/constants/featureFlags'
import { log } from '@/utils/logger'
import BootScreen from '@/src/components/BootScreen'
import PushNotificationsBridge from '@/services/PushNotificationsBridge'
import AppModal from '@/components/modal/Modal'
import { launchSupportEmail } from '@/services/support/SupportLauncher'

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
      const handleRetry = () => {
        this.setState({ hasError: false, message: null })
      }

      const handleGoHome = () => {
        this.setState({ hasError: false, message: null })
        router.replace('/(tabs)' as any)
      }

      const handleSignOut = async () => {
        await clearTokens().catch(() => null)
        authEvents.emit('unauthorized', { reason: 'fatal_error_sign_out' })
        this.setState({ hasError: false, message: null })
        router.replace('/welcome' as any)
      }

      const handleContactSupport = async () => {
        await launchSupportEmail({ category: 'general' })
      }

      return (
        <View style={{ flex: 1, backgroundColor: '#05070D', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 420, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)', backgroundColor: '#0F172A', padding: 24 }}>
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
              Recovery
            </Text>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: '700', marginTop: 12 }}>We need to reload this screen</Text>
            <Text style={{ color: '#CBD5E1', marginTop: 10, fontSize: 14, lineHeight: 22 }}>
              Something interrupted the app. Your account is safe. Try again or return to a safe screen.
            </Text>
            <TouchableOpacity onPress={handleRetry} style={{ marginTop: 22, borderRadius: 18, backgroundColor: '#2563EB', paddingVertical: 15, paddingHorizontal: 18 }}>
              <Text style={{ color: 'white', textAlign: 'center', fontSize: 15, fontWeight: '700' }}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleGoHome} style={{ marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: '#111827', paddingVertical: 15, paddingHorizontal: 18 }}>
              <Text style={{ color: 'white', textAlign: 'center', fontSize: 15, fontWeight: '600' }}>Go Home</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { void handleSignOut() }} style={{ marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: '#111827', paddingVertical: 15, paddingHorizontal: 18 }}>
              <Text style={{ color: 'white', textAlign: 'center', fontSize: 15, fontWeight: '600' }}>Sign out</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { void handleContactSupport() }} style={{ marginTop: 12, alignSelf: 'center' }}>
              <Text style={{ color: '#93C5FD', textAlign: 'center', fontSize: 13, fontWeight: '600' }}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      )
    }
    return this.props.children
  }
}

function SecurityLockNoticeOverlay() {
  const { securityLockNotice, dismissSecurityLockNotice } = useAuth()

  return (
    <AppModal open={!!securityLockNotice} onclose={dismissSecurityLockNotice}>
      <View className="w-full rounded-[24px] border border-gray-800 bg-gray-900 px-5 py-6">
        <Text className="text-white text-center text-xl font-semibold">
          {securityLockNotice?.title || 'Transaction temporarily unavailable'}
        </Text>
        <Text className="mt-3 text-center text-sm leading-6 text-gray-300">
          {securityLockNotice?.message || 'This transaction cant be completed right now. Please try again later.'}
        </Text>
        <TouchableOpacity onPress={dismissSecurityLockNotice} className="mt-6 rounded-2xl bg-app-primary px-4 py-4">
          <Text className="text-center font-semibold text-white">Okay</Text>
        </TouchableOpacity>
      </View>
    </AppModal>
  )
}

function StartupGate({ children }: { children: React.ReactNode }) {
  const { loading, authHydrated, authenticated, userProfileData, profileLoading, loadProfile, onLogout } = useAuth()
  const [warmupDone, setWarmupDone] = useState(false)
  const [showRecoveryActions, setShowRecoveryActions] = useState(false)

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
    if (authHydrated && !loading && warmupDone && (!authenticated || userProfileData || !profileLoading)) {
      setShowRecoveryActions(false)
      return
    }

    const timeout = setTimeout(() => setShowRecoveryActions(true), 5000)
    return () => clearTimeout(timeout)
  }, [authHydrated, loading, warmupDone, authenticated, userProfileData, profileLoading])

  const appReady = useMemo(() => {
    if (!authHydrated || loading) return false
    if (!warmupDone) return false
    if (!authenticated) return true
    if (userProfileData) return true
    return !profileLoading
  }, [authHydrated, loading, warmupDone, authenticated, userProfileData, profileLoading])

  const handleRetry = async () => {
    setShowRecoveryActions(false)
    setWarmupDone(false)
    await Promise.race([
      authenticated ? loadProfile({ force: true }).catch(() => null) : Promise.resolve(null),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ])
    setWarmupDone(true)
  }

  const handleGoSafe = () => {
    setShowRecoveryActions(false)
    router.replace((authenticated ? '/(tabs)' : '/welcome') as any)
  }

  const handleContactSupport = async () => {
    await launchSupportEmail({ category: 'general' })
  }

  return (
    <>
      {children}
      <BootScreen visible={!appReady} />
      {!appReady && showRecoveryActions ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 36, paddingHorizontal: 20 }}>
          <View style={{ alignSelf: 'center', width: '100%', maxWidth: 420, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)', backgroundColor: 'rgba(15,23,42,0.96)', padding: 20 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Still loading your account</Text>
            <Text style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 20, marginTop: 8 }}>
              This is taking longer than usual. You can retry, return to a safe screen, or contact support.
            </Text>
            <TouchableOpacity onPress={() => { void handleRetry() }} style={{ marginTop: 16, borderRadius: 16, backgroundColor: '#2563EB', paddingVertical: 14 }}>
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleGoSafe} style={{ marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: '#111827', paddingVertical: 14 }}>
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>{authenticated ? 'Go Home' : 'Go to Sign in'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { void onLogout() }} style={{ marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: '#111827', paddingVertical: 14 }}>
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>Sign out</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { void handleContactSupport() }} style={{ marginTop: 10 }}>
              <Text style={{ color: '#93C5FD', textAlign: 'center', fontWeight: '600' }}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
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
          <ActiveAccountProvider>
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
        {/* âœ… IMPORTANT:
            Let app/index.tsx decide whether we land in (tabs) or login.
            So we keep both screens, but we do NOT assume (tabs) is the start. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerTitle: 'Home' }} />
        <Stack.Screen name="lock" options={{ headerShown: false }} />

        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerTitle: 'Forgot Password' }} />
        <Stack.Screen name="recover-unconfirmed" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerTitle: 'Reset Password' }} />

        <Stack.Screen name="onboarding/index" options={{ headerTitle: 'Onboarding' }} />
        <Stack.Screen name="onboarding/basic-profile" options={{ headerTitle: 'Basic Profile' }} />
        <Stack.Screen name="onboarding/use-case" options={{ headerTitle: 'Use Case' }} />
        <Stack.Screen name="onboarding/kyc-profile" options={{ headerTitle: 'Identity Profile' }} />
        <Stack.Screen name="kyc/documents" options={{ headerTitle: 'Identity Documents' }} />
        <Stack.Screen name="kyc/address" options={{ headerTitle: 'Address Verification' }} />

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
        <Stack.Screen name="anchor-account/index" options={{ headerTitle: 'Deposit Account' }} />
        <Stack.Screen name="business/index" options={{ headerShown: false }} />
        <Stack.Screen name="business/activate" options={{ headerTitle: 'Activate Business Account' }} />
        <Stack.Screen name="business/onboarding" options={{ headerTitle: 'Business Profile' }} />
        <Stack.Screen name="business/kyb" options={{ headerTitle: 'Business Verification' }} />
        <Stack.Screen name="business/team" options={{ headerTitle: 'Business Team' }} />
        <Stack.Screen name="business/approvals" options={{ headerTitle: 'Business Approvals' }} />
        <Stack.Screen name="business/transfers" options={{ headerTitle: 'Business Transfers' }} />
        <Stack.Screen name="business/transfer-status/[reference]" options={{ headerTitle: 'Business Transfer Status' }} />
        <Stack.Screen name="business/payouts" options={{ headerTitle: 'Business Payroll' }} />
        <Stack.Screen name="business/payroll-run/[id]" options={{ headerTitle: 'Payroll Run' }} />
        <Stack.Screen name="business/receipts/[reference]" options={{ headerTitle: 'Business Receipt' }} />

        <Stack.Screen name="tunnel-activation/index" options={{ headerTitle: 'Global Activation' }} />
        <Stack.Screen name="fx/index" options={{ headerTitle: 'Convert' }} />

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
        <Stack.Screen name="settings/security-lock/index" options={{ headerTitle: 'Security Lock' }} />
        <Stack.Screen name="settings/security-lock/unlock" options={{ headerTitle: 'Unlock Security Lock' }} />
        <Stack.Screen name="settings/card-tokens/index" options={{ headerTitle: 'Saved Cards' }} />
        <Stack.Screen name="payment-tools/index" options={{ headerTitle: 'Payment Tools' }} />
        <Stack.Screen name="payment-tools/query" options={{ headerTitle: 'Query Transaction' }} />
        <Stack.Screen name="payment-tools/ref-order" options={{ headerTitle: 'Reference Order' }} />
        <Stack.Screen name="payment-tools/create-user-transaction" options={{ headerTitle: 'Create Transaction' }} />
        <Stack.Screen name="rewards/index" options={{ headerTitle: 'Rewards' }} />
        <Stack.Screen name="wallet/stats" options={{ headerTitle: 'Wallet Stats' }} />
        <Stack.Screen name="legal/index" options={{ headerTitle: 'Legal' }} />
        <Stack.Screen name="help-support/index" options={{ headerTitle: 'Help & Support' }} />

        <Stack.Screen name="accountProfile/index" options={{ headerTitle: 'Update Profile' }} />
        <Stack.Screen name="accountDetails/index" options={{ headerTitle: 'Account Details' }} />
        <Stack.Screen name="accounts/index" options={{ headerTitle: 'Deposit Accounts' }} />
        <Stack.Screen name="accounts/create" options={{ headerTitle: 'Create Account' }} />
        <Stack.Screen name="cards/index" options={{ headerTitle: 'Cards' }} />
        <Stack.Screen name="cards/[id]" options={{ headerTitle: 'Card Details' }} />
        <Stack.Screen name="cards/create" options={{ headerTitle: 'Create Card' }} />
        <Stack.Screen name="confirmEmail" options={{ headerTitle: 'Email Confirmation' }} />
        <Stack.Screen name="confirmation" options={{ headerTitle: 'Confirm Email' }} />
        <Stack.Screen name="circles/index" options={{ headerShown: false }} />
        <Stack.Screen name="circles/[id]" options={{ headerShown: false }} />
            </Stack>
            <PushNotificationsBridge />
            <SecurityLockNoticeOverlay />
            </StartupGate>
          </AppLockProvider>
          </ActiveAccountProvider>
        </BalancePrivacyProvider>
      </AuthProvider>
    </RootErrorBoundary>
  )
}

