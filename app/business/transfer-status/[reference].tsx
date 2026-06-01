import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import { getBusinessTransfer } from '@/api/business'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'
import { resolveTransferLifecycle } from '@/utils/transferLifecycle'

const formatNgn = (value: unknown, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value || 0))

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const labelize = (value?: string | null) =>
  String(value || 'pending')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const getReceiptCta = (status?: string | null) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'pending_approval') return 'View approval receipt'
  if (normalized === 'rejected') return 'View rejected receipt'
  return 'View receipt'
}

const BusinessTransferStatusScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ reference?: string }>()
  const { activeAccount } = useActiveAccount()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transfer, setTransfer] = useState<Record<string, unknown> | null>(null)
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const reference = String(params.reference || '').trim()

  const loadTransfer = useCallback(async () => {
    if (!businessId || !reference) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)
    try {
      const response = await getBusinessTransfer(businessId, reference)
      setTransfer(response?.data?.data?.transfer || null)
    } catch (error: unknown) {
      const errorResponse = error as { response?: { status?: number; data?: unknown } }
      const message = buildApiErrorMessage({
        status: errorResponse?.response?.status,
        data: errorResponse?.response?.data,
        fallback: 'Unable to load the business transfer right now.',
      })
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [businessId, reference])

  useEffect(() => {
    loadTransfer()
  }, [loadTransfer])

  const lifecycle = useMemo(
    () =>
      resolveTransferLifecycle({
        lifecycle_state: transfer?.lifecycle_state,
        status: transfer?.status || transfer?.transaction_status,
      }),
    [transfer]
  )

  const canOpenReceipt = Boolean(String(transfer?.receipt_reference || '').trim())
  const receiptCta = getReceiptCta(transfer?.status || transfer?.lifecycle_state)

  return (
    <ScreenContainer topPadding={20}>
      <View className="rounded-[28px] border border-[#FF7A18]/40 bg-[#151A22] p-5">
        <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">Transfer status</Text>
        <Text className="text-white text-2xl font-semibold mt-3">Business account</Text>
        <Text className="text-gray-300 text-sm mt-2">Track the current state of a business transfer, including approval-backed transfers before execution.</Text>
      </View>

      {loading ? (
        <View className="py-10 items-center justify-center">
          <ActivityIndicator size="small" color="#FFB05A" />
          <Text className="text-white mt-3">Loading transfer status...</Text>
        </View>
      ) : errorMessage ? (
        <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <Text className="text-red-100 text-sm">{errorMessage}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Transfer summary</Text>
            <Text className="text-white text-2xl font-semibold mt-4">
              {formatNgn(transfer?.amount || 0, transfer?.currency || 'NGN')}
            </Text>
            {transfer?.meta?.total_debit ? (
              <Text className="text-gray-400 text-sm mt-2">Total debit: {formatNgn(transfer?.meta?.total_debit || 0, transfer?.currency || 'NGN')}</Text>
            ) : null}
            <Text className="text-gray-300 text-sm mt-1">{lifecycle.message}</Text>
            <Text className="text-gray-400 text-xs mt-2">Reference: {transfer?.reference || reference}</Text>
            <Text className="text-gray-500 text-xs mt-1">Status: {labelize(transfer?.status)}</Text>
            <Text className="text-gray-500 text-xs mt-1">Status flow: {labelize(transfer?.lifecycle_state)}</Text>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Transfer details</Text>
            <Text className="text-gray-400 text-xs mt-4">Narration</Text>
            <Text className="text-white text-sm mt-1">{transfer?.narration || 'Not available'}</Text>
            <Text className="text-gray-400 text-xs mt-4">Recipient</Text>
            <Text className="text-white text-sm mt-1">{transfer?.destination?.account_name || 'Not available'}</Text>
            <Text className="text-gray-400 text-xs mt-4">Bank</Text>
            <Text className="text-white text-sm mt-1">{transfer?.destination?.bank_name || 'Not available'}</Text>
            <Text className="text-gray-400 text-xs mt-4">Account number</Text>
            <Text className="text-white text-sm mt-1">{transfer?.destination?.account_number || 'Not available'}</Text>
            <Text className="text-gray-400 text-xs mt-4">Created</Text>
            <Text className="text-white text-sm mt-1">{formatDate(transfer?.created_at)}</Text>
            <Text className="text-gray-400 text-xs mt-4">Updated</Text>
            <Text className="text-white text-sm mt-1">{formatDate(transfer?.updated_at)}</Text>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Processing and approval</Text>
            <Text className="text-gray-400 text-xs mt-4">Processing status</Text>
            <Text className="text-white text-sm mt-1">{transfer?.provider?.provider_status || 'Awaiting processing update'}</Text>
            <Text className="text-gray-400 text-xs mt-4">Required approvals</Text>
            <Text className="text-white text-sm mt-1">{transfer?.meta?.required_approvals ?? 'Not applicable'}</Text>
            <Text className="text-gray-400 text-xs mt-4">Collected approvals</Text>
            <Text className="text-white text-sm mt-1">{transfer?.meta?.collected_approvals ?? 'Not applicable'}</Text>
          </View>

          <TouchableOpacity onPress={loadTransfer} className="mt-4 rounded-2xl border border-gray-700 px-4 py-4 items-center">
            <Text className="text-white text-sm font-semibold">Refresh status</Text>
          </TouchableOpacity>

          {canOpenReceipt ? (
            <TouchableOpacity
              onPress={() => router.push(`/business/receipts/${encodeURIComponent(String(transfer?.receipt_reference || ''))}` as never)}
              className="mt-4 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center"
            >
              <Text className="text-black text-sm font-semibold">{receiptCta}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </ScreenContainer>
  )
}

export default BusinessTransferStatusScreen
