import React from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'react-native'
import './globals.css'

import { AuthProvider } from '@/services/useAuth'

export default function RootLayout() {
  return (
    <AuthProvider>
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

        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ headerTitle: 'Register' }} />

        <Stack.Screen name="mobileProviders/index" options={{ headerTitle: 'Mobile Top Up' }} />
        <Stack.Screen name="mobileProviders/[id]/index" options={{ headerTitle: 'Mobile Top Up' }} />
        <Stack.Screen
          name="mobileProviders/[id]/confirm/[orderId]"
          options={{ headerTitle: 'Confirm Payment' }}
        />

        <Stack.Screen name="fundWallet/index" options={{ headerTitle: 'Fund Wallet' }} />
        <Stack.Screen name="withdrawFund/index" options={{ headerTitle: 'Withdraw Fund' }} />

        <Stack.Screen name="bank-list/index" options={{ headerTitle: 'Bank List' }} />
        <Stack.Screen name="beneficiaries/index" options={{ headerTitle: 'Beneficiaries' }} />
        <Stack.Screen name="add-beneficiary/index" options={{ headerTitle: 'Add Beneficiary' }} />
        <Stack.Screen name="bank-transfer/index" options={{ headerTitle: 'Bank Transfer' }} />
        <Stack.Screen name="transfer-status/index" options={{ headerTitle: 'Transfer Status' }} />

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
        <Stack.Screen name="legal/index" options={{ headerTitle: 'Legal' }} />

        <Stack.Screen name="accountProfile/index" options={{ headerTitle: 'Update Profile' }} />
        <Stack.Screen name="accountDetails/index" options={{ headerTitle: 'Account Details' }} />
        <Stack.Screen name="confirmEmail" options={{ headerTitle: 'Email Confirmation' }} />
      </Stack>
    </AuthProvider>
  )
}
