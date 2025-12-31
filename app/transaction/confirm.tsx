import { Alert, Pressable, Share, Text, View } from 'react-native'
import React, { useCallback, useEffect, useRef } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'

import useFetch from '@/services/useFetch'
import { getTransactionRecord } from '@/api/transactions'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { getPurchaseOrder, updateOrderStatus } from '@/api/billOrder'
// import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons'
import { RouteProp, useNavigation } from '@react-navigation/native'
import LoadingIndicator from '@/components/loadingIndicator'

const Row = ({ label, value }: { label: string; value?: string | number }) => (
  <View className="flex-row justify-between items-start py-2">
    <Text className="text-slate-400 text-sm">{label}</Text>
    <Text className="text-slate-200 text-right font-medium">{String(value ?? '—')}</Text>
  </View>
)

export default function TransactionSuccessScreen() {
  const { reference, orderId } = useLocalSearchParams<{
    reference?: string
    orderId?: string
  }>()
  // const reference  = "bbg-1757381050"
  const {
    loadProfile,
  } = useAuth()
  const router = useRouter()

  const fetchReceipt = useCallback(() => {
    if (reference) {
      return getTransactionRecord(reference as string)
    }
    if (orderId) {
      return getPurchaseOrder(orderId as string)
    }
    return Promise.resolve(null)
  }, [reference, orderId])
  const { data, loading } = useFetch(fetchReceipt)

  const receipt_type = reference?.split('-')[0]
  const hasRefetchedRef = useRef(false)

  useEffect(() => {
    hasRefetchedRef.current = false
  }, [reference, orderId])

  const fetchUpdateStatus = useCallback(
    () => updateOrderStatus(reference as string),
    [reference]
  )
  const {
    data: updateData,
    refetch,
    error: updateError,
  } = useFetch(fetchUpdateStatus, false)

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (data && data?.status === 'initialized' && !hasRefetchedRef.current) {
      hasRefetchedRef.current = true
      refetch()
    }
  }, [data])

  const handleCopyToken = async () => {
    try {
      // await Clipboard.setStringAsync(token);
      Alert.alert('Copied', 'AEDC token copied to clipboard.')
    } catch {
      Alert.alert('Copy failed', 'Please try again.')
    }
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `AEDC Payment Successful\n` +
          `Amount: ${moneyFormat(data?.amount.toLocaleString())}\n` +
          `Meter: ${data?.meter_number}\n` +
          `Units: ${data?.units ?? '-'} kWh\n` +
          `Token: ${data?.token}\n` +
          `Ref: ${data?.id}\n` +
          `Date: ${data?.created_at}`,
      })
    } catch {
      /* user canceled */
    }
  }

  console.log(data, 'DATA: bill order data fetched on confirm screen')

  const billContent = (
    <>
      {/* Header / Success badge */}
      {data?.status === 'completed' ? (
        <View className="items-center pt-14 pb-8 px-6">
          <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
            <Ionicons name="checkmark" size={36} color="#16a34a" />
          </View>
          <Text className="text-2xl font-bold text-slate-100">Payment Successful</Text>
          <Text className="text-slate-400 mt-1">
            Your {data?.biller} {data?.service_types} purchase is complete.
          </Text>
        </View>
      ) : (
        <View className="items-center pt-14 pb-8 px-6">
          <View className="w-16 h-16 rounded-full bg-red-900 items-center justify-center mb-4">
            <Ionicons name="close" size={36} color="#ef4444" />
          </View>
          <Text className="text-2xl font-bold text-white">Payment Declined {data?.status}</Text>
          <Text className="text-gray-400 mt-1">Your transaction could not be processed.</Text>
        </View>
      )}

      {/* Card */}
      <View className="mx-4 rounded-2xl p-5 shadow-sm">
        {/* Amount */}
        <View className="items-center mb-4">
          <Text className="text-slate-200">Amount Paid</Text>
          <Text className="text-3xl font-extrabold text-slate-100 mt-1">
            ₦{data?.total_amount?.toLocaleString()}
          </Text>
        </View>

        {/* AEDC Token */}

        {data?.service_type === 'ELECTRICITY' && (
          <View className="border border-slate-600 -200 rounded-xl p-4 mb-4 bg-slate-900">
            <Text className="text-slate-200 text-xs mb-1">{data?.biller} Token</Text>
            <View className="flex-row items-center justify-between flex-wrap">
              <Text selectable className="text-lg font-semibold tracking-widest text-slate-200">
                {data?.token}
              </Text>
              <Pressable
                onPress={handleCopyToken}
                accessibilityRole="button"
                accessibilityLabel="Copy AEDC token"
                className="px-3 py-2 rounded-lg bg-gray-900 border border-slate-600 -200"
              >
                <View className="flex-row  items-center">
                  <Ionicons name="copy-outline" size={18} color={'gray'} />
                  <Text className="ml-1 font-medium text-slate-400">Copy</Text>
                </View>
              </Pressable>
            </View>
            <Pressable
              onPress={handleShare}
              className="self-start mt-3"
              accessibilityRole="button"
              accessibilityLabel="Share token"
            >
              <View className="flex-row items-center">
                <Ionicons name="share-outline" color={'white'} size={18} />
                <Text className="ml-1 text-slate-300 font-medium">Share</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Details */}
        <Row label="Meter Number" value={data?.meter_number} />
        {!!data?.customerName && <Row label="Customer Name" value={data?.customerName} />}
        {!!data?.address && <Row label="Address" value={data?.address} />}
        <Row label="Disco" value={data?.biller} />
        {data?.units && <Row label="Units (kWh)" value={data?.units ?? '-'} />}
        <Row label="Payment Method" value={data?.payment_method ?? '—'} />
        <Row label="Reference" value={data?.id} />
        <Row label="Date" value={data?.created_at} />
      </View>

      {/* Footer actions */}
    </>
  )

  const transactionContent = (
    <>
      {/* Success Header */}
      <View className="flex-1 bg-gray-900">
        {/* Success Header */}

        {data?.status == 'approved' ? (
          <View className="items-center pt-14 pb-8 px-6">
            <View className="w-16 h-16 rounded-full bg-green-900 items-center justify-center mb-4">
              <Ionicons name="checkmark" size={36} color="#22c55e" />
            </View>
            <Text className="text-2xl font-bold text-white">Deposit Successful</Text>
            <Text className="text-gray-400 mt-1">Your deposit has been credited.</Text>
          </View>
        ) : (
          <View className="items-center pt-14 pb-8 px-6">
            <View className="w-16 h-16 rounded-full bg-red-900 items-center justify-center mb-4">
              <Ionicons name="close" size={36} color="#ef4444" />
            </View>
            <Text className="text-2xl font-bold text-white">Transaction Declined</Text>
            <Text className="text-gray-400 mt-1">Your transaction could not be processed.</Text>
          </View>
        )}

        {/* Card with details */}
        <View className="bg-gray-800 mx-4 rounded-2xl p-5 shadow-sm">
          {/* Amount */}
          <View className="items-center mb-4">
            <Text className="text-gray-400">Amount Deposited</Text>
            <Text className="text-3xl font-extrabold text-white mt-1">
              ₦{data?.amount.toLocaleString()}
            </Text>
          </View>

          {/* Transaction Details */}
          <Row label="Reference" value={data?.id} />
          <Row label="Date" value={data?.created_at} />
          <Row label="Payment Method" value={data?.payment_method ?? '—'} />
        </View>
      </View>
    </>
  )

  return (
    <View className="flex-1 px-1 bg-primary">
      {loading ? (
        <LoadingIndicator />
      ) : reference && receipt_type === 'fbg' ? (
        transactionContent
      ) : (
        billContent
      )}
      <View className="mt-auto px-4 pb-8 pt-6">
        <Pressable
          onPress={() => router.push('/')}
          className="w-full h-14 rounded-2xl bg-theme-primary  items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back to Home"
        >
          <Text className="text-white font-semibold text-base">Back to Home</Text>
        </Pressable>

        {/* <Pressable
          onPress={() => navigation.goBack()}
          className="w-full h-12 mt-3 rounded-2xl border border-slate-300 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text className="text-slate-700 font-medium">Go Back</Text>
        </Pressable> */}
      </View>
    </View>
  )
}
