import React, { useEffect } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'

const AccountsScreen = () => {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/anchor-account')
    }, 200)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Accounts</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Deposit Accounts</Text>
        <Text className="text-gray-400 mt-2 text-sm">
          Deposit accounts now live in the Deposit Account screen.
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => router.replace('/anchor-account')}
        className="bg-app-primary py-4 rounded-xl mt-6"
      >
        <Text className="text-white text-center font-medium">Go to Deposit Account</Text>
      </TouchableOpacity>
    </View>
  )
}

export default AccountsScreen
