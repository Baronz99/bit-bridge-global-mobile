import React from 'react'
import { Alert, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import moneyFormat from '@/utils/moneyFormat'

const ReceiptScreen = () => {
  const params = useLocalSearchParams<{
    reference?: string
    amount?: string
    currency?: string
    status?: string
    description?: string
    created_at?: string
  }>()

  const reference = params.reference || '--'
  const amount = Number(params.amount || 0)
  const currency = params.currency || 'USD'
  const status = params.status || 'pending'
  const description = params.description || 'Transaction receipt'
  const createdAt = params.created_at || '--'

  const handleCopyReference = async () => {
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(reference))
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', String(reference))
    }
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `BitBridge Receipt\n` +
          `Description: ${description}\n` +
          `Amount: ${moneyFormat(amount, currency)}\n` +
          `Status: ${status}\n` +
          `Reference: ${reference}\n` +
          `Date: ${createdAt}`,
      })
    } catch {
      // no-op
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="pt-6">
          <Text className="text-white text-2xl font-semibold">Receipt</Text>
          <Text className="text-gray-400 text-xs mt-1">Transaction summary</Text>
        </View>

        <View className="mt-6 bg-gray-900/80 border border-gray-800 rounded-2xl p-4">
          <Text className="text-white text-lg font-semibold">{description}</Text>
          <Text className="text-gray-400 text-xs mt-1">{createdAt}</Text>
          <Text className="text-white text-2xl font-semibold mt-4">
            {moneyFormat(amount, currency)}
          </Text>
          <View className="mt-4">
            <Text className="text-gray-400 text-xs uppercase tracking-widest">Status</Text>
            <Text className="text-white text-sm mt-1">{status}</Text>
          </View>
          <View className="mt-4">
            <Text className="text-gray-400 text-xs uppercase tracking-widest">Reference</Text>
            <Text className="text-white text-sm mt-1">{reference}</Text>
          </View>
        </View>

        <View className="mt-5">
          <TouchableOpacity
            onPress={handleShare}
            className="bg-app-primary py-3 rounded-xl items-center"
          >
            <Text className="text-black text-sm font-semibold">Share receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCopyReference}
            className="bg-gray-900 py-3 rounded-xl items-center mt-3"
          >
            <Text className="text-white text-sm">Copy reference</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

export default ReceiptScreen
