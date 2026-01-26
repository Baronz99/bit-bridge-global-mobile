import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { createDepositAccount } from '@/api/account'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const CreateDepositAccount = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [account, setAccount] = useState<any | null>(null)

  const handleCreate = async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await createDepositAccount()
      const payload = response?.data ?? response
      setAccount(payload)
      setNotice(response?.message || 'Deposit account created.')
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to create account',
      })
      setNotice(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Accounts</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Create Deposit Account</Text>
        <Text className="text-gray-400 mt-2 text-sm">
          Generate a virtual account for wallet funding.
        </Text>
      </View>

      {notice ? (
        <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-yellow-400">{notice}</Text>
        </View>
      ) : null}

      {account ? (
        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-6">
          <Text className="text-white font-semibold">Account Details</Text>
          {account?.account_number ? (
            <Text className="text-gray-300 mt-2">
              Account Number: {account.account_number}
            </Text>
          ) : null}
          {account?.account_name ? (
            <Text className="text-gray-300">Account Name: {account.account_name}</Text>
          ) : null}
          {account?.bank_name ? (
            <Text className="text-gray-300">Bank: {account.bank_name}</Text>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity
        onPress={handleCreate}
        className="bg-app-primary py-4 rounded-xl mt-6"
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text className="text-white text-center font-medium">Create Account</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/accounts')}
        className="bg-gray-900 border border-gray-800 py-4 rounded-xl mt-3"
      >
        <Text className="text-white text-center font-medium">Back to Accounts</Text>
      </TouchableOpacity>
    </View>
  )
}

export default CreateDepositAccount
