import React, { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect, Stack, usePathname } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import { getTierFromProfile, isTierEligibleForBankTransfer } from '@/utils/bankTransfer'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const BankTransferLayout = () => {
  const pathname = usePathname()
  const { userProfileData, authHydrated, loading, profileLoading, loadProfile } = useAuth()
  const [eligibilityRecheckDone, setEligibilityRecheckDone] = useState(false)
  const eligible = isTierEligibleForBankTransfer(getTierFromProfile(userProfileData))
  const onLockedRoute = pathname?.endsWith('/bank-transfer/locked')

  useEffect(() => {
    let mounted = true
    if (!authHydrated || loading || profileLoading) return
    if (eligible || onLockedRoute || eligibilityRecheckDone) return

    ;(async () => {
      let refreshed = await loadProfile({ force: true }).catch(() => null)
      if (!isTierEligibleForBankTransfer(getTierFromProfile(refreshed))) {
        // Bypass useAuth rapid-force throttling window for definitive tier recheck.
        await delay(1700)
        refreshed = await loadProfile({ force: true }).catch(() => refreshed)
      }
      if (mounted) setEligibilityRecheckDone(true)
    })()

    return () => {
      mounted = false
    }
  }, [
    authHydrated,
    eligible,
    eligibilityRecheckDone,
    loadProfile,
    loading,
    onLockedRoute,
    profileLoading,
  ])

  if (!authHydrated || loading || profileLoading) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  }

  if (!eligible && !onLockedRoute && !eligibilityRecheckDone) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  }

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
      <Stack.Screen name="success" options={{ headerTitle: 'Transfer Status' }} />
    </Stack>
  )
}

export default BankTransferLayout
