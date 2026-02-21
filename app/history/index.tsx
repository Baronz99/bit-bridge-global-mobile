import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View, TextInput } from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'expo-router'
import useFetch from '@/services/useFetch'
import moneyFormat from '@/utils/moneyFormat'
import { getUserOrders } from '@/api/billOrder'
import { getTransactions } from '@/api/transactions'
import { resolveTransferLifecycle } from '@/utils/transferLifecycle'

const index = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'wallet'>('orders')
  const [orderStatus, setOrderStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>(
    'all'
  )
  const [walletFilter, setWalletFilter] = useState<'all' | 'deposit' | 'withdraw'>('all')
  const [walletStatusFilter, setWalletStatusFilter] = useState<'all' | 'approved' | 'initialized' | 'failed'>(
    'all'
  )
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchOrders = useCallback(() => {
    const params = orderStatus === 'all' ? undefined : { status: orderStatus }
    return getUserOrders(params)
  }, [orderStatus])
  const {
    data: ordersData,
    loading: ordersLoading,
    refetch: refetchOrders,
  } = useFetch(fetchOrders, activeTab === 'orders')

  const fetchTransactions = useCallback(() => {
    return getTransactions({
      params:
        walletFilter === 'all'
          ? {}
          : {
              transaction_type: walletFilter,
            },
    })
  }, [walletFilter])
  const {
    data: walletData,
    loading: walletLoading,
    refetch: refetchWallet,
  } = useFetch(fetchTransactions, activeTab === 'wallet')

  useEffect(() => {
    if (activeTab === 'orders') {
      refetchOrders()
    } else {
      refetchWallet()
    }
  }, [activeTab, refetchOrders, refetchWallet])

  useEffect(() => {
    if (activeTab === 'orders') {
      refetchOrders()
    }
  }, [activeTab, orderStatus, refetchOrders])

  useEffect(() => {
    if (activeTab === 'wallet') {
      refetchWallet()
    }
  }, [activeTab, walletFilter, refetchWallet])

  const orders = useMemo(() => {
    if (Array.isArray(ordersData)) return ordersData
    if (ordersData && typeof ordersData === 'object') {
      const container = ordersData as Record<string, any>
      const list = container.data ?? container.orders ?? container.items ?? []
      return Array.isArray(list) ? list : []
    }
    return []
  }, [ordersData])

  const transactions = useMemo(() => {
    const payload = (walletData as any)?.data ?? walletData
    const list = payload?.data ?? payload?.transactions ?? payload
    return Array.isArray(list) ? list : []
  }, [walletData])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const now = Date.now()
    const parseDate = (value: string, endOfDay: boolean) => {
      const trimmed = value.trim()
      if (!trimmed) return null
      const suffix = endOfDay ? 'T23:59:59' : 'T00:00:00'
      const parsed = new Date(`${trimmed}${suffix}`)
      return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
    }
    const start = parseDate(startDate, false)
    const end = parseDate(endDate, true)
    const cutoff =
      start || end
        ? null
        : dateRange === '7d'
          ? now - 7 * 24 * 60 * 60 * 1000
          : dateRange === '30d'
            ? now - 30 * 24 * 60 * 60 * 1000
            : null

    return orders.filter((item: any) => {
      const status = String(item?.status || '').toLowerCase()
      if (orderStatus !== 'all' && status !== orderStatus) return false

      if (start || end) {
        const createdAt = item?.created_at || item?.createdAt
        const timestamp = createdAt ? new Date(createdAt).getTime() : NaN
        if (!Number.isNaN(timestamp)) {
          if (start && timestamp < start) return false
          if (end && timestamp > end) return false
        }
      }

      if (cutoff) {
        const createdAt = item?.created_at || item?.createdAt
        const timestamp = createdAt ? new Date(createdAt).getTime() : NaN
        if (!Number.isNaN(timestamp) && timestamp < cutoff) return false
      }

      if (!normalizedSearch) return true
      const haystack = [
        item?.service_type,
        item?.id,
        item?.reference,
        item?.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [orders, searchTerm, dateRange, orderStatus, startDate, endDate])

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const now = Date.now()
    const parseDate = (value: string, endOfDay: boolean) => {
      const trimmed = value.trim()
      if (!trimmed) return null
      const suffix = endOfDay ? 'T23:59:59' : 'T00:00:00'
      const parsed = new Date(`${trimmed}${suffix}`)
      return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
    }
    const start = parseDate(startDate, false)
    const end = parseDate(endDate, true)
    const cutoff =
      start || end
        ? null
        : dateRange === '7d'
          ? now - 7 * 24 * 60 * 60 * 1000
          : dateRange === '30d'
            ? now - 30 * 24 * 60 * 60 * 1000
            : null

    return transactions.filter((item: any) => {
      if (!isPrimaryTransaction(item)) return false

      const filterStatus = statusFilterValue(item)
      if (walletStatusFilter !== 'all' && filterStatus !== walletStatusFilter) return false

      if (start || end) {
        const createdAt = item?.created_at || item?.createdAt
        const timestamp = createdAt ? new Date(createdAt).getTime() : NaN
        if (!Number.isNaN(timestamp)) {
          if (start && timestamp < start) return false
          if (end && timestamp > end) return false
        }
      }

      if (cutoff) {
        const createdAt = item?.created_at || item?.createdAt
        const timestamp = createdAt ? new Date(createdAt).getTime() : NaN
        if (!Number.isNaN(timestamp) && timestamp < cutoff) return false
      }

      if (!normalizedSearch) return true
      const haystack = [
        item?.display_message,
        item?.transaction_type,
        item?.type,
        item?.reference,
        item?.transfer_reference,
        item?.id,
        item?.lifecycle_state,
        item?.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [transactions, searchTerm, dateRange, walletStatusFilter, startDate, endDate])

  const ordersCount = filteredOrders.length
  const walletCount = filteredTransactions.length
  const statusTone = (status: string) => {
    const normalized = resolveTransferLifecycle({ lifecycle_state: status, status }).state
    if (normalized === 'completed' || normalized === 'approved') return 'text-green-400'
    if (normalized === 'failed_refunded' || normalized === 'released') return 'text-sky-300'
    if (normalized === 'pending_provider' || normalized === 'pending' || normalized === 'initialized' || normalized === 'reserved') return 'text-yellow-400'
    return 'text-red-400'
  }

  const isPrimaryTransaction = (item: any) => item?.show_in_primary_feed !== false

  const transactionState = (item: any) =>
    resolveTransferLifecycle({
      lifecycle_state: item?.lifecycle_state,
      status: item?.status,
      display_message: item?.display_message,
    }).state

  const statusFilterValue = (item: any) => {
    const state = transactionState(item)
    if (state === 'completed') return 'approved'
    if (state === 'reserved' || state === 'pending_provider' || state === 'pending') return 'initialized'
    if (state === 'failed_refunded' || state === 'failed_reversal_pending' || state === 'failed_unrecovered' || state === 'released') return 'failed'
    return state
  }

  const displayAmount = (item: any) =>
    Number(item?.display_total ?? item?.display_amount ?? item?.amount ?? 0)

  return (
    <View className="flex-1 bg-primary">
      <View className="flex-1">
        <View className="mx-4 mt-4 mb-3 rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <Text className="text-white text-lg font-semibold">History</Text>
          <Text className="text-gray-400 text-xs mt-1">
            Track orders and wallet activity in one place.
          </Text>
          <View className="flex-row mt-4 gap-3">
            <View className="flex-1 rounded-xl border border-gray-800 bg-gray-950 p-3">
              <Text className="text-gray-400 text-xs">Orders</Text>
              <Text className="text-white text-lg font-semibold">{ordersCount}</Text>
            </View>
            <View className="flex-1 rounded-xl border border-gray-800 bg-gray-950 p-3">
              <Text className="text-gray-400 text-xs">Wallet</Text>
              <Text className="text-white text-lg font-semibold">{walletCount}</Text>
            </View>
          </View>
        </View>

        <View className="mx-4 mb-4 rounded-full bg-gray-900 p-1 flex-row">
          <TouchableOpacity
            onPress={() => setActiveTab('orders')}
            className={`flex-1 ${activeTab === 'orders' ? 'bg-app-primary' : 'bg-transparent'} py-2 rounded-full`}
          >
            <Text className="text-white text-xs text-center font-semibold">Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('wallet')}
            className={`flex-1 ${activeTab === 'wallet' ? 'bg-app-primary' : 'bg-transparent'} py-2 rounded-full`}
          >
            <Text className="text-white text-xs text-center font-semibold">Wallet</Text>
          </TouchableOpacity>
        </View>

        <View className="mx-4 mb-4 rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <Text className="text-gray-300 text-xs uppercase tracking-wide">Filters</Text>

          {activeTab === 'orders' ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(['all', 'completed', 'pending', 'failed'] as const).map((status) => {
                const active = orderStatus === status
                return (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setOrderStatus(status)}
                    className={`${active ? 'bg-gray-800' : 'bg-gray-950'} px-3 py-2 rounded-full border border-gray-800`}
                  >
                    <Text className="text-white text-xs">
                      {status === 'all' ? 'All' : status}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ) : (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(['all', 'deposit', 'withdraw'] as const).map((filter) => {
                const active = walletFilter === filter
                return (
                  <TouchableOpacity
                    key={filter}
                    onPress={() => setWalletFilter(filter)}
                    className={`${active ? 'bg-gray-800' : 'bg-gray-950'} px-3 py-2 rounded-full border border-gray-800`}
                  >
                    <Text className="text-white text-xs">
                      {filter === 'all'
                        ? 'All'
                        : filter === 'deposit'
                          ? 'Deposits'
                          : 'Withdrawals'}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {activeTab === 'wallet' ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(['all', 'approved', 'initialized', 'failed'] as const).map((filter) => {
                const active = walletStatusFilter === filter
                return (
                  <TouchableOpacity
                    key={filter}
                    onPress={() => setWalletStatusFilter(filter)}
                    className={`${active ? 'bg-gray-800' : 'bg-gray-950'} px-3 py-2 rounded-full border border-gray-800`}
                  >
                    <Text className="text-white text-xs">
                      {filter === 'all' ? 'All status' : filter}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ) : null}

          <View className="mt-3 flex-row flex-wrap gap-2">
            {(['all', '7d', '30d'] as const).map((range) => {
              const active = dateRange === range
              return (
                <TouchableOpacity
                  key={range}
                  onPress={() => setDateRange(range)}
                  className={`${active ? 'bg-gray-800' : 'bg-gray-950'} px-3 py-2 rounded-full border border-gray-800`}
                >
                  <Text className="text-white text-xs">
                    {range === 'all' ? 'All time' : range}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View className="mt-3 flex-row gap-2">
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="Start YYYY-MM-DD"
              placeholderTextColor="gray"
              className="flex-1 border border-gray-800 rounded-xl px-4 py-3 text-white bg-gray-950"
            />
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="End YYYY-MM-DD"
              placeholderTextColor="gray"
              className="flex-1 border border-gray-800 rounded-xl px-4 py-3 text-white bg-gray-950"
            />
          </View>

          <View className="mt-3">
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search by service, ref, or status"
              placeholderTextColor="gray"
              className="border border-gray-800 rounded-xl px-4 py-3 text-white bg-gray-950"
            />
          </View>
        </View>

        <View className="flex-1 mx-4 mb-2">
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 40,
              marginBottom: 40,
            }}
          >
            {activeTab === 'orders' && ordersLoading ? (
              <ActivityIndicator size={'large'} color={'#000ff'} className="mt-10 self-center" />
            ) : null}

            {activeTab === 'wallet' && walletLoading ? (
              <ActivityIndicator size={'large'} color={'#000ff'} className="mt-10 self-center" />
            ) : null}

            {activeTab === 'orders' && !ordersLoading ? (
              filteredOrders.length < 1 ? (
                <View className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4">
                  <Text className="text-center text-gray-300">No orders</Text>
                </View>
              ) : (
                filteredOrders.map((item: any, index: number) => {
                  const status = String(item?.status || 'pending').toLowerCase()
                  const reference = item?.reference ?? item?.id
                  return (
                    <Link
                      key={`${reference}-${index}`}
                      href={{
                        pathname: '/transaction/confirm',
                        params: { orderId: String(item?.id), source: 'bill' },
                      }}
                      asChild
                    >
                      <TouchableOpacity className="mb-3 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4">
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1 pr-3">
                            <Text className="text-white font-semibold">
                              {item?.service_type || 'Order'}
                            </Text>
                            <Text className="text-gray-500 text-xs mt-1">
                              Ref {reference || 'unknown'}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-white font-semibold">
                              {moneyFormat(item.amount)}
                            </Text>
                            <Text className={`text-xs mt-1 ${statusTone(status)}`}>
                              {status}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Link>
                  )
                })
              )
            ) : null}

            {activeTab === 'wallet' && !walletLoading ? (
              filteredTransactions.length < 1 ? (
                <View className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4">
                  <Text className="text-center text-gray-300">No transactions</Text>
                </View>
              ) : (
                filteredTransactions.map((item: any, index: number) => {
                  const reference = item?.reference ?? item?.transfer_reference ?? item?.id
                  const status = transactionState(item)
                  const typeLabel = item?.transaction_type || item?.type || 'transaction'
                  const message = item?.display_message
                  if (!reference) {
                    return (
                      <View
                        key={`transaction-${index}`}
                        className="mb-3 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4"
                      >
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1 pr-3">
                            <Text className="text-white font-semibold">{typeLabel}</Text>
                            <Text className="text-gray-500 text-xs mt-1">Reference pending</Text>
                            {message ? <Text className="text-gray-400 text-xs mt-1">{message}</Text> : null}
                          </View>
                          <View className="items-end">
                            <Text className="text-white font-semibold">
                              {moneyFormat(displayAmount(item))}
                            </Text>
                            <Text className={`text-xs mt-1 ${statusTone(status)}`}>
                              {status}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )
                  }
                  return (
                    <Link
                      key={`${reference}-${index}`}
                      href={{
                        pathname: '/transaction/record/[reference]',
                        params: { reference: String(reference) },
                      }}
                      asChild
                    >
                      <TouchableOpacity className="mb-3 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4">
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1 pr-3">
                            <Text className="text-white font-semibold">{typeLabel}</Text>
                            <Text className="text-gray-500 text-xs mt-1">
                              Ref {reference}
                            </Text>
                            {message ? <Text className="text-gray-400 text-xs mt-1">{message}</Text> : null}
                          </View>
                          <View className="items-end">
                            <Text className="text-white font-semibold">
                              {moneyFormat(displayAmount(item))}
                            </Text>
                            <Text className={`text-xs mt-1 ${statusTone(status)}`}>
                              {status}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Link>
                  )
                })
              )
            ) : null}
          </ScrollView>
        </View>
      </View>
    </View>
  )
}

export default index


