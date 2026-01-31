import React, { useEffect } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'

const AnchorKycVerify = () => {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/accounts')
    }, 200)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="pt-10">
        <Text className="text-white text-2xl font-semibold">Anchor KYC</Text>
        <Text className="text-gray-400 mt-2">
          KYC verification now happens inside Virtual Accounts.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/accounts')}
          className="bg-app-primary py-4 rounded-xl mt-6"
        >
          <Text className="text-white text-center font-medium">Go to Virtual Accounts</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default AnchorKycVerify
