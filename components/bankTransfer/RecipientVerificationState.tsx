import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { maskAccountNumber } from '@/utils/bankTransfer'

type RecipientVerificationStateProps = {
  status: 'idle' | 'loading' | 'success' | 'error'
  accountName?: string
  bankName?: string
  accountNumber?: string
  error?: string | null
}

const RecipientVerificationState = ({
  status,
  accountName,
  bankName,
  accountNumber,
  error,
}: RecipientVerificationStateProps) => {
  if (status === 'loading') {
    return (
      <View className="flex-row items-center bg-blue-900/25 border border-blue-800 px-3 py-3 rounded-xl mt-3">
        <ActivityIndicator size="small" color="#93c5fd" />
        <Text className="text-blue-100 text-xs ml-2">Verifying recipient...</Text>
      </View>
    )
  }

  if (status === 'success' && accountName) {
    return (
      <View className="bg-green-900/20 border border-green-700 rounded-xl p-3 mt-3">
        <Text className="text-green-300 text-xs uppercase tracking-widest">Verified Recipient</Text>
        <Text className="text-white text-sm font-semibold mt-1">{accountName.toUpperCase()}</Text>
        <Text className="text-green-100 text-xs mt-1">
          {bankName || 'Bank'} - {maskAccountNumber(accountNumber || '')}
        </Text>
      </View>
    )
  }

  if (status === 'error') {
    return (
      <View className="bg-red-900/20 border border-red-700 rounded-xl p-3 mt-3">
        <Text className="text-red-200 text-xs">
          {error || 'Recipient verification failed. Please confirm bank and account number.'}
        </Text>
      </View>
    )
  }

  return null
}

export default RecipientVerificationState
