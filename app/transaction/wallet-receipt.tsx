import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { getTransactions } from '@/api/transactions'
import moneyFormat from '@/utils/moneyFormat'

const WalletReceiptScreen = () => {
  const params = useLocalSearchParams<{
    id?: string
    reference?: string
    amount?: string
    currency?: string
    status?: string
    description?: string
    created_at?: string
    wallet_type?: string
    transaction_type?: string
    address?: string
  }>()

  const reference = params.reference || params.id || '--'
  const amount = Number(params.amount || 0)
  const currency = params.currency || 'NGN'
  const status = params.status || 'pending'
  const description = params.description || 'Wallet transaction'
  const createdAt = params.created_at || '--'
  const walletType = params.wallet_type || 'ngn'
  const txType = params.transaction_type || ''
  const address = params.address || ''

  const isConversion = String(address).toLowerCase().includes('tunnel conversion')
  const [pairLoading, setPairLoading] = useState(false)
  const [pairedAmount, setPairedAmount] = useState<number | null>(null)

  const fetchPair = useCallback(async () => {
    if (!isConversion || !createdAt) return
    setPairLoading(true)
    try {
      const oppositeWallet = walletType === 'ngn' ? 'usd' : 'ngn'
      const res = await getTransactions({ params: { wallet_type: oppositeWallet } })
      const payload = res?.data ?? res
      const list = payload?.data ?? payload?.transactions ?? payload
      if (!Array.isArray(list)) {
        setPairLoading(false)
        return
      }
      const currentTime = new Date(createdAt).getTime()
      const match = list.find((item: any) => {
        const itemTime = new Date(item?.created_at || item?.createdAt || '').getTime()
        const delta = Math.abs(itemTime - currentTime)
        const sameAddress = String(item?.address || '').toLowerCase().includes('tunnel conversion')
        const oppositeType =
          String(item?.transaction_type || '').toLowerCase() !== String(txType).toLowerCase()
        return sameAddress && oppositeType && delta <= 2 * 60 * 1000
      })
      if (match) {
        setPairedAmount(Number(match?.amount ?? 0))
      }
    } finally {
      setPairLoading(false)
    }
  }, [createdAt, isConversion, txType, walletType])

  useEffect(() => {
    fetchPair()
  }, [fetchPair])

  const tendered = useMemo(() => {
    if (!isConversion) return null
    if (String(txType).toLowerCase() === 'withdrawal') return amount
    return pairedAmount
  }, [amount, isConversion, pairedAmount, txType])

  const received = useMemo(() => {
    if (!isConversion) return null
    if (String(txType).toLowerCase() === 'deposit') return amount
    return pairedAmount
  }, [amount, isConversion, pairedAmount, txType])

  const tenderedCurrency =
    String(txType).toLowerCase() === 'withdrawal' ? currency : walletType === 'ngn' ? 'USD' : 'NGN'
  const receivedCurrency =
    String(txType).toLowerCase() === 'deposit' ? currency : walletType === 'ngn' ? 'USD' : 'NGN'

  const handleCopyReference = async () => {
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(reference))
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', String(reference))
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="pt-6">
          <Text className="text-white text-2xl font-semibold">Receipt</Text>
          <Text className="text-gray-400 text-xs mt-1">Wallet transaction summary</Text>
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

        {isConversion ? (
          <View className="mt-5 bg-gray-900/80 border border-gray-800 rounded-2xl p-4">
            <Text className="text-white text-sm font-semibold">Conversion details</Text>
            {pairLoading ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#f59e0b" />
              </View>
            ) : (
              <>
                <View className="mt-3">
                  <Text className="text-gray-400 text-xs">Amount tendered</Text>
                  <Text className="text-white text-sm mt-1">
                    {tendered !== null ? moneyFormat(tendered, tenderedCurrency) : '--'}
                  </Text>
                </View>
                <View className="mt-3">
                  <Text className="text-gray-400 text-xs">Amount received</Text>
                  <Text className="text-white text-sm mt-1">
                    {received !== null ? moneyFormat(received, receivedCurrency) : '--'}
                  </Text>
                </View>
                <View className="mt-3">
                  <Text className="text-gray-400 text-xs">Fee</Text>
                  <Text className="text-white text-sm mt-1">0</Text>
                </View>
              </>
            )}
          </View>
        ) : null}

        <View className="mt-5">
          <TouchableOpacity
            onPress={handleCopyReference}
            className="bg-app-primary py-3 rounded-xl items-center"
          >
            <Text className="text-black text-sm font-semibold">Copy reference</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

export default WalletReceiptScreen
