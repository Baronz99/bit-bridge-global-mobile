import React, { useMemo } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Link } from 'expo-router'
import { getUserOrders } from '@/api/orders'
import useFetch from '@/services/useFetch'
import { FEATURE_ORDERS } from '@/constants/featureFlags'
import moneyFormat from '@/utils/moneyFormat'
import { dateFormat } from '@/utils/dateFormat'

const OrdersScreen = () => {
  const { data, loading, error, refetch } = useFetch(() => getUserOrders())

  const orders = useMemo(() => {
    const payload = data?.data ?? data
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.orders)) return payload.orders
    return []
  }, [data])

  const orderTotal = useMemo(() => {
    return orders.reduce((sum: number, order: any) => {
      const amount = Number(order?.total_amount ?? order?.amount ?? 0)
      return sum + (Number.isNaN(amount) ? 0 : amount)
    }, 0)
  }, [orders])

  if (!FEATURE_ORDERS) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Orders</Text>
        <Text className="text-gray-400">Orders are currently disabled.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <Text className="text-white text-2xl font-semibold">Orders</Text>
          <Text className="text-gray-400 mt-1">
            Keep tabs on purchases and recurring services.
          </Text>
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-xl border border-gray-800 bg-gray-950 p-3">
              <Text className="text-gray-400 text-xs">Total orders</Text>
              <Text className="text-white text-lg font-semibold">{orders.length}</Text>
            </View>
            <View className="flex-1 rounded-xl border border-gray-800 bg-gray-950 p-3">
              <Text className="text-gray-400 text-xs">Total spend</Text>
              <Text className="text-white text-lg font-semibold">
                {moneyFormat(orderTotal)}
              </Text>
            </View>
          </View>
          <Link href="/orders/confirm" asChild>
            <TouchableOpacity className="bg-app-primary py-3 rounded-xl mt-4">
              <Text className="text-white text-center font-medium">Create Order</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {loading ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? (
          <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
            <Text className="text-white font-semibold">Error</Text>
            <Text className="text-white/80">{error?.message || 'Failed to load orders'}</Text>
            <TouchableOpacity onPress={refetch} className="mt-3 bg-red-600 py-2 rounded-lg">
              <Text className="text-white text-center">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="mt-6 gap-3">
          {orders.length === 0 && !loading ? (
            <View className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <Text className="text-gray-300 text-center">No orders yet.</Text>
            </View>
          ) : null}

          {orders.map((order: any) => {
            const id = String(order?.id ?? order?.order_id ?? '')
            const amount = Number(order?.total_amount ?? order?.amount ?? 0)
            const status = String(order?.status || 'pending').toLowerCase()
            const statusTone =
              status === 'completed'
                ? 'text-green-400'
                : status === 'pending'
                  ? 'text-yellow-400'
                  : 'text-red-400'
            return (
              <Link key={id} href={`/orders/${id}`} asChild>
                <TouchableOpacity className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-3">
                      <Text className="text-white font-semibold">Order #{id}</Text>
                      <Text className="text-gray-500 text-xs mt-1">
                        {dateFormat(order?.created_at || '')}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-white font-semibold">{moneyFormat(amount)}</Text>
                      <Text className={`text-xs mt-1 ${statusTone}`}>{status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Link>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

export default OrdersScreen
