import React, { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { formatNaira, maskAccountNumber } from '@/utils/bankTransfer'

type TransferSummary = {
  bank_name: string
  account_number: string
  account_name: string
  amount: number
  fee: number
  total_debit: number
  description?: string
  transfer_reference: string
}

const parseSummary = (raw: any): TransferSummary | null => {
  const input = Array.isArray(raw) ? raw[0] : raw
  if (!input) return null
  try {
    const parsed = JSON.parse(String(input))
    if (!parsed?.transfer_reference) return null
    return parsed
  } catch {
    return null
  }
}

const SuccessScreen = () => {
  const router = useRouter()
  const { summary } = useLocalSearchParams<{ summary?: string }>()

  const payload = useMemo(() => parseSummary(summary), [summary])

  if (!payload) {
    return (
      <View className="flex-1 bg-primary px-4">
        <View className="pt-10">
          <Text className="text-white text-2xl mb-2">Transfer Complete</Text>
          <Text className="text-gray-300">Transfer was submitted successfully.</Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/wallet')}
            className="bg-theme-primary py-4 rounded-xl mt-4"
          >
            <Text className="text-alt text-center font-semibold">Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View className="pt-10">
          <Text className="text-white text-2xl mb-2">Transfer Successful</Text>
          <Text className="text-gray-300 mb-4">Step 3 of 3: Completed</Text>

          <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <Text className="text-white text-base font-semibold mb-3">Receipt</Text>

            <Text className="text-gray-400 text-xs">From</Text>
            <Text className="text-white text-sm mb-2">BitBridge NGN Wallet</Text>

            <Text className="text-gray-400 text-xs">To</Text>
            <Text className="text-white text-sm">{payload.account_name}</Text>
            <Text className="text-gray-400 text-xs mb-2">
              {payload.bank_name} - {maskAccountNumber(payload.account_number)}
            </Text>

            <Text className="text-gray-400 text-xs">Amount</Text>
            <Text className="text-white text-sm mb-2">{formatNaira(Number(payload.amount || 0))}</Text>

            <Text className="text-gray-400 text-xs">Fee</Text>
            <Text className="text-white text-sm mb-2">{formatNaira(Number(payload.fee || 0))}</Text>

            <Text className="text-gray-400 text-xs">Total Debit</Text>
            <Text className="text-white text-sm mb-2">{formatNaira(Number(payload.total_debit || 0))}</Text>

            {payload.description ? (
              <>
                <Text className="text-gray-400 text-xs">Narration</Text>
                <Text className="text-white text-sm mb-2">{payload.description}</Text>
              </>
            ) : null}

            <Text className="text-gray-400 text-xs">Transfer Reference</Text>
            <Text className="text-white text-xs">{payload.transfer_reference}</Text>
          </View>

          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/wallet')}
            className="bg-theme-primary py-4 rounded-xl mt-5"
          >
            <Text className="text-alt text-center font-semibold">Done</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/timeline')}
            className="bg-gray-900 border border-gray-800 py-4 rounded-xl mt-3"
          >
            <Text className="text-white text-center">View in Timeline</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

export default SuccessScreen
