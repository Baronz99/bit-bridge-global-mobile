import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { Redirect, router, Stack, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/services/useAuth'
import { getTierFromProfile, isTierEligibleForBankTransfer } from '@/utils/bankTransfer'
import { backOrFallback } from '@/utils/navigationRecovery'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const HeaderBackButton = () => (
  <TouchableOpacity
    onPress={() => backOrFallback(router, '/(tabs)')}
    className="flex-row items-center"
    accessibilityRole="button"
    accessibilityLabel="Go back"
    hitSlop={12}
  >
    <Ionicons name="chevron-back" size={20} color="white" />
    <Text className="ml-1 text-sm font-semibold text-white">Back</Text>
  </TouchableOpacity>
)

const BankTransferLayout = () => {
  const pathname = usePathname()
  const { userProfileData, authHydrated, loading, profileLoading, loadProfile } = useAuth()
  const [eligibilityRecheckDone, setEligibilityRecheckDone] = useState(false)
  const [recoveryVisible, setRecoveryVisible] = useState(false)
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

  const waitingForEligibility = !authHydrated || loading || profileLoading || (!eligible && !onLockedRoute && !eligibilityRecheckDone)

  useEffect(() => {
    if (!waitingForEligibility) {
      setRecoveryVisible(false)
      return
    }
    const timeout = setTimeout(() => setRecoveryVisible(true), 5000)
    return () => clearTimeout(timeout)
  }, [waitingForEligibility])

  if (waitingForEligibility) {
    if (!recoveryVisible) {
      return (
        <View className="flex-1 bg-primary items-center justify-center">
          <ActivityIndicator />
        </View>
      )
    }

    return (
      <View className="flex-1 bg-primary items-center justify-center px-5">
        <View className="w-full max-w-[420px] rounded-[28px] border border-white/10 bg-[#0F172A] p-6">
          <Text className="text-white text-xl font-semibold">Still checking bank transfer access</Text>
          <Text className="mt-3 text-sm leading-6 text-slate-300">
            We are refreshing your verification status. Try again or return to Home while we keep your account safe.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setRecoveryVisible(false)
              void loadProfile({ force: true }).catch(() => null)
            }}
            className="mt-5 rounded-2xl bg-app-primary px-4 py-4"
          >
            <Text className="text-center font-semibold text-white">Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)' as const)}
            className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
          >
            <Text className="text-center font-semibold text-white">Go Home</Text>
          </TouchableOpacity>
        </View>
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
      <Stack.Screen
        name="index"
        options={{
          headerTitle: 'Bank Transfer',
          headerLeft: HeaderBackButton,
        }}
      />
      <Stack.Screen
        name="locked"
        options={{
          headerTitle: 'Bank Transfer Access',
          headerLeft: HeaderBackButton,
        }}
      />
      <Stack.Screen name="review" options={{ headerTitle: 'Review Transfer' }} />
      <Stack.Screen name="success" options={{ headerTitle: 'Transfer Status' }} />
    </Stack>
  )
}

export default BankTransferLayout
