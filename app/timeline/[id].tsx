import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getTimelineItemSmart } from '@/api/timeline'
import { MOCK_TIMELINE } from '@/components/timeline/mockData'
import moneyFormat from '@/utils/moneyFormat'

type AnyRecord = Record<string, any>

const StatusStep = ({ label, active }: { label: string; active: boolean }) => (
  <View className="flex-row items-center mb-2">
    <View className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-gray-700'}`} />
    <Text className={`ml-2 text-xs ${active ? 'text-emerald-300' : 'text-gray-500'}`}>{label}</Text>
  </View>
)

const normalizeStatus = (value: unknown) => String(value || 'pending').toLowerCase()

// ✅ Only treat references with known prefixes as receipt references.
// Prevents wallet-tx-* from routing into receipt endpoints.
const isReceiptReference = (ref: string) => {
  const v = String(ref || '').trim().toLowerCase()
  if (!v) return false
  return (
    v.startsWith('bbg-') ||
    v.startsWith('fbg-') ||
    v.startsWith('trx-') ||
    v.startsWith('txn-') ||
    v.startsWith('bill-') ||
    v.startsWith('trf-')
  )
}

// Extract a transaction-like reference from multiple known shapes
const getTimelineReference = (record: AnyRecord | null): string => {
  if (!record) return ''
  const meta = (record.meta as AnyRecord) || {}
  const raw =
    record.reference ||
    meta.reference ||
    meta.transaction_reference ||
    meta.payment_reference ||
    meta.provider_reference ||
    meta.session_id ||
    ''

  const ref = String(raw || '').trim()
  return isReceiptReference(ref) ? ref : ''
}

const getTimelineTimestamp = (record: AnyRecord | null): string => {
  if (!record) return ''
  return record.occurred_at || record.created_at || record.createdAt || record.timestamp || ''
}

const isMoneyLike = (record: AnyRecord | null): boolean => {
  if (!record) return false
  const kind = String(record.kind || record.type || '').toLowerCase()
  const label = String(record.label || record.title || '').toLowerCase()
  const meta = (record.meta as AnyRecord) || {}
  const txType = String(meta.transaction_type || '').toLowerCase()

  // money-like heuristics:
  if (Boolean(getTimelineReference(record))) return true
  if (txType) return true
  if (kind.includes('wallet') || kind.includes('transfer') || kind.includes('deposit') || kind.includes('withdraw')) return true
  if (kind.includes('bill') || label.includes('bill') || label.includes('airtime') || label.includes('data')) return true
  if (label.includes('transfer') || label.includes('paid') || label.includes('purchase')) return true

  return false
}

const ActivityDetailsScreen = () => {
  const router = useRouter()
  const { id, autoReceipt } = useLocalSearchParams<{ id?: string; autoReceipt?: string }>()
  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState<AnyRecord | null>(null)
  const [usedFallback, setUsedFallback] = useState(false)

  // If you ever want to force auto-open bank receipt when a reference exists:
  // /timeline/[id]?autoReceipt=1
  const shouldAutoOpenReceipt = String(autoReceipt || '').toLowerCase() === '1'

  const loadDetails = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setUsedFallback(false)

    const fallback =
      (MOCK_TIMELINE.find((item) => String((item as any).id) === String(id)) as AnyRecord | undefined) || null

    try {
      const res = await getTimelineItemSmart(String(id))
      if (!res) {
        // 404 or unsupported id -> use fallback
        setRecord(fallback)
        if (fallback) setUsedFallback(true)
        return
      }

      const payload = (res as any)?.data ?? res
      const data = (payload as any)?.data ?? payload
      setRecord((data as AnyRecord) ?? fallback)
      if (!data && fallback) setUsedFallback(true)
    } catch {
      setRecord(fallback)
      if (fallback) setUsedFallback(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDetails()
  }, [loadDetails])

  const meta = (record?.meta as AnyRecord) || {}
  const status = normalizeStatus(record?.status)
  const reference = getTimelineReference(record)
  const moneyLike = useMemo(() => isMoneyLike(record), [record])

  const currency = (meta.currency as string) || 'NGN'
  const amountCents = Number(record?.amount_cents ?? meta.amount_cents ?? 0)
  const amountValue = amountCents ? amountCents / 100 : Number(record?.amount ?? meta.amount ?? 0)
  const amount = amountValue ? moneyFormat(amountValue, currency) : '-'

  const title = String(record?.label || record?.title || record?.text || record?.message || 'Activity details')
  const occurredAt = getTimelineTimestamp(record) || '-'

  const actor = record?.actor as AnyRecord | undefined
  const actorName = (actor?.name as string) || (record?.actor_name as string) || 'You'

  const isFailed = status.includes('failed') || status.includes('declined') || status.includes('reversed')
  const isPending = status.includes('pending') || status.includes('initialized') || status.includes('processing')
  const isSuccessful = status.includes('approved') || status.includes('successful') || status.includes('completed')

  const statusSteps = useMemo(() => {
    if (isFailed) return ['Created', 'Processing', 'Failed']
    if (isPending) return ['Created', 'Processing', 'Pending']
    if (isSuccessful) return ['Created', 'Processing', 'Successful']
    return ['Created', 'Processing', 'Successful']
  }, [isFailed, isPending, isSuccessful])

  // Optional: auto-open receipt only when reference is REAL
  useEffect(() => {
    if (!shouldAutoOpenReceipt) return
    if (!record) return
    if (!reference) return
    if (!moneyLike) return
    router.replace({ pathname: '/transaction/confirm', params: { reference } })
  }, [shouldAutoOpenReceipt, record, reference, moneyLike, router])

  const handleCopy = async () => {
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(reference || '')
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', reference || '---')
    }
  }

  if (!id) {
    return (
      <View className="flex-1 bg-primary items-center justify-center px-6">
        <Text className="text-white text-base">Missing activity ID.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pt-6">
          <Text className="text-white text-2xl font-semibold">Activity details</Text>
          <Text className="text-gray-400 text-xs mt-1">
            {moneyLike ? 'For money activity, view the receipt for full details.' : 'Review the details for this activity.'}
          </Text>
          {usedFallback ? (
            <Text className="text-amber-300 text-[11px] mt-2">
              Showing cached details (timeline detail endpoint unavailable).
            </Text>
          ) : null}
        </View>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text className="text-gray-400 text-xs mt-3">Loading details...</Text>
          </View>
        ) : record ? (
          <>
            <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <Text className="text-white text-lg font-semibold">{title}</Text>
              <Text className="text-gray-400 text-xs mt-1">{occurredAt}</Text>

              <View className="mt-3">
                <Text className="text-white text-2xl font-semibold">{amount}</Text>
                <Text className="text-gray-400 text-xs mt-1">Status: {status}</Text>
              </View>
            </View>

            <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <Text className="text-white text-sm font-semibold mb-3">Status timeline</Text>
              <StatusStep label={statusSteps[0]} active />
              <StatusStep label={statusSteps[1]} active={isPending || isSuccessful || isFailed} />
              <StatusStep label={statusSteps[2]} active={isSuccessful || isFailed || isPending} />
            </View>

            <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <Text className="text-white text-sm font-semibold mb-3">Participants</Text>
              <Text className="text-gray-300 text-xs">Actor: {actorName}</Text>
              {meta.account_name ? (
                <Text className="text-gray-300 text-xs mt-2">Beneficiary: {String(meta.account_name)}</Text>
              ) : null}
            </View>

            <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <Text className="text-white text-sm font-semibold mb-3">Details</Text>

              <Text className="text-gray-400 text-xs">Reference</Text>
              <Text className="text-gray-200 text-sm mt-1">{reference || '---'}</Text>
            </View>

            <View className="mt-5">
              <TouchableOpacity onPress={handleCopy} className="bg-app-primary py-3 rounded-xl items-center">
                <Text className="text-black text-sm font-semibold">Copy reference</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!reference) {
                    Alert.alert('Receipt unavailable', 'This activity does not have a receipt reference.')
                    return
                  }
                  router.push({ pathname: '/transaction/confirm', params: { reference } })
                }}
                className={`py-3 rounded-xl items-center mt-3 ${reference ? 'bg-gray-900' : 'bg-gray-900/40'}`}
              >
                <Text className="text-white text-sm">{reference ? 'View receipt' : 'Receipt unavailable'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!reference) {
                    Alert.alert('No reference', 'This activity has no reference for dispute tracking.')
                    return
                  }
                  router.push({ pathname: '/orders/[id]/dispute', params: { id: reference } })
                }}
                className={`py-3 rounded-xl items-center mt-3 ${reference ? 'bg-gray-900' : 'bg-gray-900/40'}`}
              >
                <Text className="text-red-300 text-sm">Raise dispute</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View className="py-10 items-center">
            <Text className="text-gray-400 text-sm">Activity not found.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

export default ActivityDetailsScreen
