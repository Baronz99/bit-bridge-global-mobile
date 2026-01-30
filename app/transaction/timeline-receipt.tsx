// app/transaction/timeline-receipt.tsx
import React, { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import moneyFormat from '@/utils/moneyFormat'

const safeStr = (v: any, fb = '') => {
  const s = String(v ?? '').trim()
  return s || fb
}

const safeJsonParse = (v: any) => {
  try {
    if (!v) return null
    if (typeof v === 'object') return v
    return JSON.parse(String(v))
  } catch {
    return null
  }
}

const formatWhen = (value?: any) => {
  if (!value) return '--'
  // handle seconds vs ms
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleString()
  }
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

const guessAmount = (item: any) => {
  const v =
    item?.amount ??
    item?.meta?.amount ??
    item?.payload?.amount ??
    item?.data?.amount ??
    item?.value ??
    0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const guessCurrency = (item: any) => {
  return (
    safeStr(item?.currency) ||
    safeStr(item?.meta?.currency) ||
    safeStr(item?.payload?.currency) ||
    safeStr(item?.data?.currency) ||
    'NGN'
  ).toUpperCase()
}

const guessStatus = (item: any) => {
  return (
    safeStr(item?.status) ||
    safeStr(item?.meta?.status) ||
    safeStr(item?.payload?.status) ||
    safeStr(item?.data?.status) ||
    'pending'
  ).toLowerCase()
}

const statusTone = (status: string) => {
  if (status === 'approved' || status === 'success' || status === 'successful' || status === 'completed')
    return 'text-emerald-300'
  if (status === 'pending' || status === 'initialized' || status === 'processing') return 'text-amber-300'
  return 'text-red-300'
}

export default function TimelineReceipt() {
  const router = useRouter()
  const params = useLocalSearchParams()

  const timelineItem = useMemo(() => {
    return safeJsonParse(params.item)
  }, [params.item])

  const reference =
    safeStr(params.reference) ||
    safeStr(timelineItem?.meta?.reference) ||
    safeStr(timelineItem?.reference) ||
    safeStr(timelineItem?.id)

  const createdAt =
    safeStr(params.created_at) ||
    safeStr(timelineItem?.created_at) ||
    safeStr(timelineItem?.createdAt) ||
    safeStr(timelineItem?.meta?.created_at) ||
    safeStr(timelineItem?.meta?.createdAt)

  const amount = Number(safeStr(params.amount)) || guessAmount(timelineItem)
  const currency = safeStr(params.currency) || guessCurrency(timelineItem)
  const status = safeStr(params.status) || guessStatus(timelineItem)

  const title =
    safeStr(timelineItem?.title) ||
    safeStr(timelineItem?.meta?.title) ||
    safeStr(params.title) ||
    'Receipt'

  const description =
    safeStr(timelineItem?.description) ||
    safeStr(timelineItem?.meta?.description) ||
    safeStr(params.description) ||
    ''

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white/70 text-xs tracking-widest uppercase">Timeline Receipt</Text>
          <Text className="text-white text-2xl font-semibold mt-2">{title}</Text>
          <Text className="text-gray-400 text-sm mt-2">
            This receipt is generated from the timeline item (safe, no extra record lookup).
          </Text>
        </View>

        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-6">
          <Text className="text-gray-400 text-xs tracking-widest uppercase">Amount</Text>
          <Text className="text-white text-3xl font-semibold mt-2">{moneyFormat(amount, currency)}</Text>

          <View className="mt-4 flex-row justify-between items-center">
            <View>
              <Text className="text-gray-400 text-xs uppercase tracking-widest">Status</Text>
              <Text className={`text-sm font-semibold mt-1 ${statusTone(status)}`}>{status}</Text>
            </View>
            <View className="items-end">
              <Text className="text-gray-400 text-xs uppercase tracking-widest">Reference</Text>
              <Text className="text-white text-sm mt-1">{reference || '--'}</Text>
            </View>
          </View>

          {description ? (
            <View className="mt-4">
              <Text className="text-gray-400 text-xs uppercase tracking-widest">Description</Text>
              <Text className="text-white text-sm mt-1">{description}</Text>
            </View>
          ) : null}

          <View className="mt-4">
            <Text className="text-gray-400 text-xs uppercase tracking-widest">Date</Text>
            <Text className="text-white text-sm mt-1">{formatWhen(createdAt)}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-gray-900 border border-gray-800 py-3 rounded-xl"
        >
          <Text className="text-white text-center font-medium">Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}
