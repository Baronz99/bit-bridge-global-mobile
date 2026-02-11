import React, { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'react-native'
import './globals.css'

import { AuthProvider } from '@/services/useAuth'
import { AppLockProvider } from '../services/useAppLock'

export default function RootLayout() {
  useEffect(() => {
    console.log('[BOOT_TRACE][ROOT_LAYOUT]', { event: 'providers_mounted' })
  }, [])

  return (
    <AuthProvider>
      <AppLockProvider>
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
        <Stack.Screen name="bank-transfer/index" options={{ headerTitle: 'Bank Transfer' }} />
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
      </Stack>
      </AppLockProvider>
    </AuthProvider>
  )
}
