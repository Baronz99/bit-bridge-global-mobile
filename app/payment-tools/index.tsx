import React, { useMemo } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/services/useAuth'

const PaymentToolsScreen = () => {
  const router = useRouter()
  const { userProfileData } = useAuth()
  const isAdmin = useMemo(() => {
    const role = userProfileData?.role || userProfileData?.user_profile?.role
    return role === 'admin' || role === 'super_admin'
  }, [userProfileData])

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="pt-10">
        <Text className="text-white text-2xl mb-2">Payment Tools</Text>
        <Text className="text-gray-300 mb-6">Lookup payment processor data.</Text>

        <TouchableOpacity
          onPress={() => router.push('/payment-tools/query')}
          className="bg-gray-900 py-5 rounded-xl"
        >
          <Text className="text-white text-center">Query Transaction</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/payment-tools/ref-order')}
          className="bg-gray-900 py-5 rounded-xl mt-4"
        >
          <Text className="text-white text-center">Reference Order Lookup</Text>
        </TouchableOpacity>

        {isAdmin ? (
          <TouchableOpacity
            onPress={() => router.push('/payment-tools/create-user-transaction')}
            className="bg-gray-900 py-5 rounded-xl mt-4"
          >
            <Text className="text-white text-center">Create User Transaction</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

export default PaymentToolsScreen
