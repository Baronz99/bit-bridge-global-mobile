import React from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect, Slot, usePathname } from 'expo-router'
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

  return <Slot />
}

export default BankTransferLayout
