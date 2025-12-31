import React from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'react-native'
import './globals.css'

// ✅ IMPORTANT: named import (matches the new auth file)
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerTitle: 'Home' }} />

        {/* Only keep screens that actually exist in /app */}
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

        <Stack.Screen
          name="electricity-provider/index"
          options={{ headerTitle: 'Electricity' }}
        />
        <Stack.Screen
          name="electricity-provider/[id]/index"
          options={{ headerTitle: 'Electric Bills' }}
        />

        <Stack.Screen name="history/index" options={{ headerTitle: 'History' }} />

        <Stack.Screen name="airtime-top-up/index" options={{ headerTitle: 'Airtime' }} />
        {/* ⚠️ keep this ONLY if the file exists */}
        {/* <Stack.Screen name="airtime-top-up/confirm/[orderId]" options={{ headerTitle: 'Confirm Airtime' }} /> */}

        <Stack.Screen name="data-subscription/index" options={{ headerTitle: 'Data' }} />
        {/* ⚠️ keep this ONLY if the file exists */}
        {/* <Stack.Screen name="data-subscription/confirm/[orderId]" options={{ headerTitle: 'Confirm Data' }} /> */}

        <Stack.Screen name="cable-tv-provider/index" options={{ headerTitle: 'Cable TV' }} />
        {/* ⚠️ keep this ONLY if the file exists */}
        {/* <Stack.Screen name="cable-tv-provider/confirm/[orderId]" options={{ headerTitle: 'TV Subscription' }} /> */}

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
