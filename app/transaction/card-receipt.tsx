// app/transaction/card-receipt.tsx
import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getCardHistory, getCardDetails } from '@/api/cards'
import moneyFormat from '@/utils/moneyFormat'

/**
 * PCI-DSS SAFE CARD RECEIPT
 * - NO PAN/CVV
 * - Uses card history (safe transaction fields)
 * - Pull-to-refresh refetches history and re-finds the transaction
 */

const safeStr = (v: any, fallback = '') => {
  const s = String(v ?? '').trim()
  return s || fallback
}

const normalizeLast4 = (value: any) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  return digits.slice(-4).padStart(4, '0')
}

const normalizeStatus = (v: any) => safeStr(v, 'pending').toLowerCase()

const statusTone = (status: string) => {
  if (status === 'approved' || status === 'success' || status === 'successful') return 'text-emerald-300'
  if (status === 'initialized' || status === 'pending') return 'text-amber-300'
  return 'text-red-300'
}

const formatWhen = (value?: string | null) => {
  if (!value) return '--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

const formatLabel = (item: any) => {
  const raw = safeStr(item?.address || item?.description || item?.type, 'Card transaction')
  const lower = raw.toLowerCase()
  if (lower.includes('virtual card funding')) return 'Funding from Tunnel wallet'
  if (lower.includes('virtual card withdrawal')) return 'Withdrawal to Tunnel wallet'
  if (lower.includes('authorization')) return 'Card purchase'
  if (lower.includes('reversal')) return 'Card reversal'
  if (lower.includes('refund')) return 'Card refund'
  if (lower.includes('conversion')) return 'Card conversion'
  return raw
}

const breakdownTransactionFee = (breakdown: any) => {
  if (!breakdown || typeof breakdown !== 'object') return 0

  const principal = Number(breakdown.principal_usd || 0)
  const totalDebit = Number(breakdown.total_debit_usd || 0)
  if (Number.isFinite(totalDebit) && Number.isFinite(principal) && totalDebit > 0 && principal >= 0) {
    return Math.max(0, totalDebit - principal)
  }

  const feeSum =
    Number(breakdown.provider_fee_usd || 0) +
    Number(breakdown.bitbridge_fee_usd || 0) +
    Number(breakdown.fx_markup_usd || 0) +
    Number(breakdown.funding_fee_usd || 0) +
    Number(breakdown.withdrawal_fee_usd || 0)
  return Number.isFinite(feeSum) ? Math.max(0, feeSum) : 0
}

const CardReceipt = () => {
  const router = useRouter()
  const params = useLocalSearchParams()

  // from navigation
  const cardId = safeStr(params.cardId, '')
  const reference = safeStr(params.reference, '')
  const fallbackId = safeStr(params.id, '')
  const fallbackAmount = safeStr(params.amount, '')
  const fallbackStatus = safeStr(params.status, '')
  const fallbackCreatedAt = safeStr(params.created_at, '')
  const fallbackDesc = safeStr(params.description, '')
  const currency = safeStr(params.currency, 'USD')

  // ✅ ADD LOGGING (top of component)
  // Fetch card history for "refresh + confirm"
  const historyFetch = useFetch(
    useCallback(() => {
      if (!cardId) return Promise.resolve({ data: [] } as any)
      return getCardHistory(cardId)
    }, [cardId]),
    true
  )

  // Optional: card details to show last4 (SAFE)
  const detailsFetch = useFetch(
    useCallback(() => {
      if (!cardId) return Promise.resolve({ data: {} } as any)
      return getCardDetails(cardId)
    }, [cardId]),
    true
  )

  const historyPayload = useMemo(() => {
    const payload = (historyFetch.data as any)?.data ?? historyFetch.data
    return Array.isArray(payload) ? payload : payload?.history ?? []
  }, [historyFetch.data])

  const detailsPayload = useMemo(() => (detailsFetch.data as any)?.data ?? detailsFetch.data, [detailsFetch.data])

  const last4 =
    normalizeLast4(
      detailsPayload?.last4 ||
        detailsPayload?.last_4 ||
        detailsPayload?.card_last4 ||
        detailsPayload?.cardLast4
    )

  // Find the transaction by reference/id when possible
  const tx = useMemo(() => {
    if (!historyPayload?.length) return null

    const byRef = reference
      ? historyPayload.find((x: any) => safeStr(x?.transaction_reference || x?.reference, '') === reference)
      : null

    const byId = fallbackId ? historyPayload.find((x: any) => safeStr(x?.id, '') === fallbackId) : null

    return byRef || byId || null
  }, [historyPayload, reference, fallbackId])

  const display = useMemo(() => {
    const source = tx || {}
    const createdAt = safeStr(source?.created_at || source?.createdAt, fallbackCreatedAt)
    const status = normalizeStatus(source?.status || fallbackStatus)
    const amount = Number(source?.amount ?? fallbackAmount ?? 0)
    const desc = formatLabel(source) || fallbackDesc

    const ref =
      safeStr(source?.transaction_reference || source?.reference, '') ||
      reference ||
      (fallbackId ? `#${fallbackId}` : '')

    const breakdown = source?.breakdown || null

    return { createdAt, status, amount, desc, ref, breakdown }
  }, [tx, fallbackAmount, fallbackCreatedAt, fallbackDesc, fallbackStatus, reference, fallbackId])

  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    if (!cardId) return
    setRefreshing(true)
    try {
      await Promise.all([historyFetch.refetch(), detailsFetch.refetch()])
    } finally {
      setRefreshing(false)
    }
  }, [cardId, historyFetch, detailsFetch])

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white/70 text-xs tracking-widest uppercase">Card Receipt</Text>
          <Text className="text-white text-2xl font-semibold mt-2">Transaction Details</Text>
          <Text className="text-gray-400 text-sm mt-2">This receipt does not show full card details for security.</Text>
        </View>

        {(historyFetch.loading || detailsFetch.loading) && !tx ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : null}

        {historyFetch.error ? (
          <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
            <Text className="text-white font-semibold">Error</Text>
            <Text className="text-white/80">{historyFetch.error?.message || 'Failed to load receipt'}</Text>
          </View>
        ) : null}

        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-6">
          <Text className="text-gray-400 text-xs tracking-widest uppercase">Amount</Text>
          <Text className="text-white text-3xl font-semibold mt-2">{moneyFormat(display.amount, currency)}</Text>

          <View className="mt-4 flex-row justify-between items-center">
            <View>
              <Text className="text-gray-400 text-xs uppercase tracking-widest">Status</Text>
              <Text className={`text-sm font-semibold mt-1 ${statusTone(display.status)}`}>{display.status}</Text>
            </View>
            <View className="items-end">
              <Text className="text-gray-400 text-xs uppercase tracking-widest">Card</Text>
              <Text className="text-white text-sm mt-1">{last4 ? `•••• ${last4}` : '•••• ----'}</Text>
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-gray-400 text-xs uppercase tracking-widest">Description</Text>
            <Text className="text-white text-sm mt-1">{display.desc || '--'}</Text>
          </View>

          <View className="mt-4">
            <Text className="text-gray-400 text-xs uppercase tracking-widest">Reference</Text>
            <Text className="text-white text-sm mt-1">{display.ref || '--'}</Text>
          </View>

          <View className="mt-4">
            <Text className="text-gray-400 text-xs uppercase tracking-widest">Date</Text>
            <Text className="text-white text-sm mt-1">{formatWhen(display.createdAt)}</Text>
          </View>
        </View>

        {display.breakdown &&
        (display.breakdown.total_debit_usd ||
          display.breakdown.provider_fee_usd ||
          display.breakdown.bitbridge_fee_usd ||
          display.breakdown.fx_markup_usd) ? (
          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white font-semibold">Breakdown</Text>
            <View className="mt-3">
              <LineItem label="Principal" value={moneyFormat(Number(display.breakdown.principal_usd || 0), 'USD')} />
              {breakdownTransactionFee(display.breakdown) > 0 ? (
                <LineItem
                  label="Transaction fee"
                  value={moneyFormat(breakdownTransactionFee(display.breakdown), 'USD')}
                />
              ) : null}
              <LineItem
                label="Total debit"
                value={moneyFormat(Number(display.breakdown.total_debit_usd || 0), 'USD')}
                emphasis
              />
            </View>
          </View>
        ) : null}

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

export default CardReceipt

const LineItem = ({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) => (
  <View className="flex-row justify-between mt-1">
    <Text className={`text-[11px] ${emphasis ? 'text-gray-200 font-semibold' : 'text-gray-400'}`}>{label}</Text>
    <Text className={`text-[11px] ${emphasis ? 'text-gray-200 font-semibold' : 'text-gray-300'}`}>{value}</Text>
  </View>
)
