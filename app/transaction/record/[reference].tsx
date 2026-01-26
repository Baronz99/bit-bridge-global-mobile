import React, { useCallback, useEffect } from 'react'
import { ActivityIndicator, Alert, Share, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getTransactionRecord } from '@/api/transactions'
import moneyFormat from '@/utils/moneyFormat'
import { useAuth } from '@/services/useAuth'

const Row = ({ label, value }: { label: string; value?: string | number }) => (
  <View className="flex-row justify-between py-2">
    <Text className="text-gray-400 text-sm">{label}</Text>
    <Text className="text-gray-200 text-sm text-right">{String(value ?? '-')}</Text>
  </View>
)

const TransactionRecordScreen = () => {
  const router = useRouter()
  const { onLogout } = useAuth()
  const { reference } = useLocalSearchParams<{ reference?: string | string[] }>()
  const ref = Array.isArray(reference) ? reference[0] : reference

  const fetchRecord = useCallback(() => {
    if (!ref) return Promise.resolve(null)
    return getTransactionRecord(ref)
  }, [ref])

  const { data, loading, error } = useFetch(fetchRecord)

  useEffect(() => {
    const status = error?.response?.status
    if (status === 401) {
      void onLogout()
      router.replace('/login')
    }
  }, [error, onLogout, router])

  if (!ref) {
    return (
      <View className="flex-1 bg-primary items-center justify-center px-6">
        <Text className="text-white text-base">Missing transaction reference.</Text>
      </View>
    )
  }

  const handleShareReceipt = async () => {
    if (!data) return
    try {
      const amount = moneyFormat(Number(data?.amount ?? 0))
      const status = data?.status ?? 'pending'
      const referenceText = data?.reference || data?.id || ref
      const created = data?.created_at ?? '-'
      await Share.share({
        message:
          `BitBridge Wallet Receipt\n` +
          `Status: ${status}\n` +
          `Amount: ${amount}\n` +
          `Reference: ${referenceText}\n` +
          `Date: ${created}`,
      })
    } catch {
      /* ignore */
    }
  }

  const handleCopyReference = async () => {
    const referenceText = data?.reference || data?.id || ref
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(referenceText))
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', String(referenceText))
    }
  }

  const statusLabel = String(data?.status || 'pending').toLowerCase()
  const statusClass =
    statusLabel === 'approved'
      ? 'bg-green-700'
      : statusLabel === 'initialized'
        ? 'bg-yellow-700'
        : statusLabel === 'failed'
          ? 'bg-red-700'
          : 'bg-gray-700'

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="pt-10">
        <Text className="text-white text-2xl mb-2">Wallet Transaction</Text>
        <Text className="text-gray-300 mb-6">Review your wallet transaction details.</Text>

        {loading ? (
          <ActivityIndicator size="large" />
        ) : error ? (
          <View className="bg-gray-900 p-4 rounded-xl">
            <Text className="text-white font-semibold">Unable to load</Text>
            <Text className="text-gray-300 text-sm mt-1">
              {error?.message || 'Something went wrong.'}
            </Text>
          </View>
        ) : data ? (
          <View className="bg-gray-900 p-4 rounded-xl">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white font-semibold">Summary</Text>
              <View className={`${statusClass} px-3 py-1 rounded-full`}>
                <Text className="text-white text-xs font-semibold">{statusLabel}</Text>
              </View>
            </View>
            <Row label="Status" value={data?.status} />
            <Row label="Amount" value={moneyFormat(data?.amount ?? 0)} />
            <Row label="Type" value={data?.transaction_type || data?.type} />
            <Row label="Reference" value={data?.reference || data?.id} />
            <Row label="Description" value={data?.description} />
            <Row label="Payment Method" value={data?.payment_method} />
            <Row label="Date" value={data?.created_at} />
          </View>
        ) : (
          <View className="bg-gray-900 p-4 rounded-xl">
            <Text className="text-gray-300 text-center">No transaction record found.</Text>
          </View>
        )}

        <View className="mt-5">
          <Text className="text-gray-400 text-xs mb-2">Actions</Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/transaction/confirm',
                params: { reference: String(ref) },
              })
            }
            className="bg-theme-primary py-4 rounded-xl"
          >
            <Text className="text-white text-center font-medium">View Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShareReceipt}
            className="bg-gray-900 py-4 mt-3 rounded-xl"
            disabled={!data}
          >
            <Text className="text-white text-center">Share Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCopyReference}
            className="bg-gray-900 py-4 mt-3 rounded-xl"
            disabled={!data}
          >
            <Text className="text-white text-center">Copy Reference</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/orders/[id]/dispute',
                params: { id: String(data?.reference || data?.id || ref) },
              })
            }
            className="bg-gray-900 py-4 mt-3 rounded-xl"
          >
            <Text className="text-red-300 text-center">Raise Dispute</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default TransactionRecordScreen
