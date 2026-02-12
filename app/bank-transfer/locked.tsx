import React from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import TierGateCard from '@/components/bankTransfer/TierGateCard'

const BankTransferLockedScreen = () => {
  const router = useRouter()

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="pt-10">
        <Text className="text-white text-2xl mb-2">Bank Transfer</Text>
        <TierGateCard onUpgrade={() => router.replace('/kyc')} />
      </View>
    </View>
  )
}

export default BankTransferLockedScreen
