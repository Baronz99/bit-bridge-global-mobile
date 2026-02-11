import React, { useCallback } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, Link } from 'expo-router'
import { getOrder } from '@/api/orders'
import useFetch from '@/services/useFetch'
import { FEATURE_ORDERS, FEATURE_DISPUTES } from '@/constants/featureFlags'
import moneyFormat from '@/utils/moneyFormat'
import { dateFormat } from '@/utils/dateFormat'

const OrderDetail = () => {
  const { id } = useLocalSearchParams()
  const orderId = String(id || '')
  const fetchOrder = useCallback(() => getOrder(orderId), [orderId])
  const { data, loading, error, refetch } = useFetch(fetchOrder)

  if (!FEATURE_ORDERS) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Order</Text>
        <Text className="text-gray-400">Orders are currently disabled.</Text>
      </View>
    )
  }

  const payload = data?.data ?? data
  const amount = Number(payload?.total_amount ?? payload?.amount ?? 0)
  const disputeTargetId = String(payload?.circle_transaction_id || '').trim()
  const canRaiseDispute = FEATURE_DISPUTES && disputeTargetId.length > 0

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-white text-2xl font-semibold mt-6">Order #{orderId}</Text>

        {loading ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? (
          <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
            <Text className="text-white font-semibold">Error</Text>
            <Text className="text-white/80">{error?.message || 'Failed to load order'}</Text>
            <TouchableOpacity onPress={refetch} className="mt-3 bg-red-600 py-2 rounded-lg">
              <Text className="text-white text-center">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="bg-gray-900 rounded-xl p-4 mt-6">
          <Text className="text-white font-semibold">Summary</Text>
          <Text className="text-gray-400 text-xs mt-1">Status: {payload?.status || 'pending'}</Text>
          <Text className="text-gray-400 text-xs mt-1">
            Amount: {moneyFormat(amount)}
          </Text>
          <Text className="text-gray-400 text-xs mt-1">
            Created: {dateFormat(payload?.created_at || '')}
          </Text>
        </View>

        <View className="bg-gray-900 rounded-xl p-4 mt-4">
          <Text className="text-white font-semibold">Details</Text>
          <Text className="text-gray-400 text-xs mt-1">
            {payload?.extra_info || 'No extra info available.'}
          </Text>
        </View>

        {canRaiseDispute ? (
          <Link href={`/orders/${disputeTargetId}/dispute`} asChild>
            <TouchableOpacity className="bg-gray-800 py-4 rounded-xl mt-6">
              <Text className="text-white text-center font-medium">Raise a Dispute</Text>
            </TouchableOpacity>
          </Link>
        ) : null}

        <Link
          href={{
            pathname: '/transaction/confirm',
            params: { orderId, source: 'order' },
          }}
          asChild
        >
          <TouchableOpacity className="bg-app-primary py-4 rounded-xl mt-4">
            <Text className="text-white text-center font-medium">View Receipt</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </View>
  )
}

export default OrderDetail
