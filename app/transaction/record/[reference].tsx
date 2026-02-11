import React, { useCallback, useEffect, useRef } from 'react'
import { ActivityIndicator, Alert, Share, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getTransactionRecord } from '@/api/transactions'
import moneyFormat from '@/utils/moneyFormat'
import PerfTrace from '@/utils/perfTrace'
import { FEATURE_DISPUTES } from '@/constants/featureFlags'

const Row = ({ label, value }: { label: string; value?: string | number }) => (
  <View className="flex-row justify-between py-2">
    <Text className="text-gray-400 text-sm">{label}</Text>
    <Text className="text-gray-200 text-sm text-right">{String(value ?? '-')}</Text>
  </View>
)

const TransactionRecordScreen = () => {
  const router = useRouter()
  const { reference } = useLocalSearchParams<{ reference?: string | string[] }>()
  const ref = Array.isArray(reference) ? reference[0] : reference
  const uiAfterDataTraceRef = useRef<string | null>(null)

  const fetchRecord = useCallback(async () => {
    if (!ref) return Promise.resolve(null)
    const traceLabel = `tx_record:api:${ref}`
    PerfTrace.start(traceLabel, { reference: ref })
    try {
      const result = await getTransactionRecord(ref)
      PerfTrace.end(traceLabel, { ok: true })
      uiAfterDataTraceRef.current = `tx_record:ui_after_data:${ref}`
      PerfTrace.start(uiAfterDataTraceRef.current)
      return result
    } catch (error: any) {
      PerfTrace.end(traceLabel, {
        ok: false,
        status: error?.response?.status ?? null,
        message: error?.message || 'request_failed',
      })
      throw error
    }
  }, [ref])

  // IMPORTANT:
  // - Do NOT manually logout on 401 here.
  // - client.ts already handles refresh/retry and emits unauthorized → AuthProvider clears session.
  const { data, loading, error, refetch } = useFetch(fetchRecord)

  useEffect(() => {
    if (!data || !uiAfterDataTraceRef.current) return
    const label = uiAfterDataTraceRef.current
    const frame = requestAnimationFrame(() => {
      PerfTrace.end(label, { rendered: true })
      uiAfterDataTraceRef.current = null
    })
    return () => cancelAnimationFrame(frame)
  }, [data])

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
      const amount = moneyFormat(Number((data as any)?.amount ?? 0))
      const status = (data as any)?.status ?? 'pending'
      const referenceText = (data as any)?.reference || (data as any)?.id || ref
      const created = (data as any)?.created_at ?? '-'
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
    const referenceText = (data as any)?.reference || (data as any)?.id || ref
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(referenceText))
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', String(referenceText))
    }
  }

  const statusLabel = String((data as any)?.status || 'pending').toLowerCase()
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
              {(error as any)?.response?.data?.message ||
                (error as any)?.response?.data?.error ||
                (error as any)?.message ||
                'Something went wrong.'}
            </Text>

            <TouchableOpacity
              onPress={() => refetch?.()}
              className="mt-4 bg-theme-primary py-3 rounded-xl"
            >
              <Text className="text-white text-center font-medium">Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <View className="bg-gray-900 p-4 rounded-xl">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white font-semibold">Summary</Text>
              <View className={`${statusClass} px-3 py-1 rounded-full`}>
                <Text className="text-white text-xs font-semibold">{statusLabel}</Text>
              </View>
            </View>

            <Row label="Status" value={(data as any)?.status} />
            <Row label="Amount" value={moneyFormat((data as any)?.amount ?? 0)} />
            <Row label="Type" value={(data as any)?.transaction_type || (data as any)?.type} />
            <Row label="Reference" value={(data as any)?.reference || (data as any)?.id} />
            <Row label="Description" value={(data as any)?.description} />
            <Row label="Payment Method" value={(data as any)?.payment_method} />
            <Row label="Date" value={(data as any)?.created_at} />
          </View>
        ) : (
          <View className="bg-gray-900 p-4 rounded-xl">
            <Text className="text-gray-300 text-center">No transaction record found.</Text>

            <TouchableOpacity
              onPress={() => refetch?.()}
              className="mt-4 bg-theme-primary py-3 rounded-xl"
            >
              <Text className="text-white text-center font-medium">Refresh</Text>
            </TouchableOpacity>
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
            onPress={() => refetch?.()}
            className="bg-gray-900 py-4 mt-3 rounded-xl"
          >
            <Text className="text-white text-center">Refresh Status</Text>
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

          {FEATURE_DISPUTES && String((data as any)?.meta?.circle_transaction_id || '').trim() ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/orders/[id]/dispute',
                  params: { id: String((data as any)?.meta?.circle_transaction_id) },
                })
              }
              className="bg-gray-900 py-4 mt-3 rounded-xl"
            >
              <Text className="text-red-300 text-center">Raise Dispute</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  )
}

export default TransactionRecordScreen
