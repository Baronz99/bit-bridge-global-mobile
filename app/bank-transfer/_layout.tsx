import React from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect, Stack, usePathname } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import { getTierFromProfile, isTierEligibleForBankTransfer } from '@/utils/bankTransfer'

const BankTransferLayout = () => {
  const pathname = usePathname()
  const { userProfileData, authHydrated, loading, profileLoading } = useAuth()

  if (!authHydrated || loading || profileLoading) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  }

  const eligible = isTierEligibleForBankTransfer(getTierFromProfile(userProfileData))
  const onLockedRoute = pathname?.endsWith('/bank-transfer/locked')

  if (!eligible && !onLockedRoute) {
    return <Redirect href="/bank-transfer/locked" />
  }

  if (eligible && onLockedRoute) {
    return <Redirect href="/bank-transfer" />
  }

  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { color: 'orange' },
        headerStyle: { backgroundColor: '#030014' },
        headerTintColor: 'white',
      }}
    >
      <Stack.Screen name="index" options={{ headerTitle: 'Bank Transfer' }} />
      <Stack.Screen name="locked" options={{ headerTitle: 'Bank Transfer Access' }} />
      <Stack.Screen name="review" options={{ headerTitle: 'Review Transfer' }} />
      <Stack.Screen name="success" options={{ headerTitle: 'Transfer Success' }} />
    </Stack>
  )
}

export default BankTransferLayout
