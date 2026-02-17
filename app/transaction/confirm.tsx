import { Alert, AppState, Pressable, Share, Text, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'

import useFetch from '@/services/useFetch'
import { getTransactionRecord } from '@/api/transactions'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { cancelPayment, getPurchaseOrder, queryTransaction } from '@/api/billOrder'
import { getOrder } from '@/api/orders'
import { Ionicons } from '@expo/vector-icons'
import LoadingIndicator from '@/components/loadingIndicator'
import { log } from '@/utils/log'
import { resolveElectricityIdentity } from '@/utils/electricityIdentity'

const Row = ({ label, value }: { label: string; value?: string | number }) => (
  <View className="flex-row justify-between items-start py-2">
    <Text className="text-slate-400 text-sm">{label}</Text>
    <Text className="text-slate-200 text-right font-medium">{String(value ?? '—')}</Text>
  </View>
)

const norm = (s?: any) => String(s || '').toLowerCase().trim()

const isTerminalStatus = (s?: string) => {
  const v = norm(s)
  return ['completed', 'approved', 'success', 'paid', 'failed', 'declined', 'cancelled', 'canceled', 'refunded'].includes(v)
}

const isSuccessfulStatus = (s?: string) => {
  const v = norm(s)
  return ['completed', 'approved', 'success', 'paid'].includes(v)
}

const isStillProcessing = (s?: string) => {
  const v = norm(s)
  return ['initialized', 'pending', 'processing', 'in_progress', 'queued'].includes(v)
}

const isElectricity = (serviceType?: any) => String(serviceType || '').trim().toUpperCase() === 'ELECTRICITY'

const pickFirst = (...values: any[]) => {
  for (const v of values) {
    const s = String(v ?? '').trim()
    if (s) return s
  }
  return ''
}

const unwrap = <T,>(res: any): T => (res && res.data !== undefined ? res.data : res)
const isBillRef = (s?: string) => String(s || '').startsWith('bbg-')
const isUuidLike = (s?: string) => {
  const v = String(s || '')
  if (!v || isBillRef(v) || v.startsWith('fbg-')) return false
  return v.length >= 20 && v.includes('-')
}
const resolveBillish = (payload: any) =>
  pickFirst(
    payload?.bill_order?.reference,
    payload?.reference,
    payload?.id,
    payload?.bill_order?.id,
    payload?.bill_order_id,
    payload?.transaction_record?.reference
  )

export default function TransactionSuccessScreen() {
  const { reference, orderId, source } = useLocalSearchParams<{
    reference?: string
    orderId?: string
    source?: string
  }>()

  const { loadProfile } = useAuth()
  const router = useRouter()
  const [resolvedReference, setResolvedReference] = useState<string>('')
  const attemptedResolveRef = useRef(false)

  const receiptType = useMemo(() => {
    const ref = String(reference || '')
    return ref.includes('-') ? ref.split('-')[0] : ''
  }, [reference])

  /**
   * Fetch receipt:
   * - reference => transaction record (includes deposits like fbg-*)
   * - orderId + source=order => order receipt
   * - orderId => bill order receipt
   */
  const fetchReceipt = useCallback(() => {
    if (reference) {
      if (isUuidLike(reference as string)) return getPurchaseOrder(reference as string)
      return getTransactionRecord(reference as string)
    }
    if (orderId) {
      if (source === 'order') return getOrder(orderId as string)
      return getPurchaseOrder(orderId as string)
    }
    return Promise.resolve(null)
  }, [reference, orderId, source])

  const { data, loading, refetch } = useFetch(fetchReceipt)

  const receiptRef = useMemo(
    () =>
      pickFirst(
        (data as any)?.reference, // best
        (data as any)?.transaction_record?.reference,
        (data as any)?.transaction_ref,
        (data as any)?.transaction_reference,
        reference
      ),
    [data, reference]
  )
  const hasReceiptRef = Boolean(String(receiptRef || '').trim())
  const fallbackReceiptRef = useMemo(() => {
    if (hasReceiptRef) return String(receiptRef)

    const orderParam = String(orderId || '').trim()
    if (orderParam && isUuidLike(orderParam)) return `bill-${orderParam}`

    const routeRef = String(reference || '').trim()
    if (routeRef && isUuidLike(routeRef)) return `bill-${routeRef}`

    return ''
  }, [hasReceiptRef, orderId, receiptRef, reference])
  const canOpenReceipt = useMemo(() => {
    const status = String((data as any)?.status || '')
    const hasReceiptRefValue = Boolean(String(fallbackReceiptRef || '').trim())
    const electricityFlow = isElectricity((data as any)?.service_type)
    const tokenPresent = String((data as any)?.token || '').trim().length > 0
    if (!hasReceiptRefValue || !isSuccessfulStatus(status)) return false
    if (electricityFlow) return tokenPresent
    return true
  }, [data, fallbackReceiptRef])
  const isBillSuccess = useMemo(() => {
    const status = String((data as any)?.status || '')
    if (!isSuccessfulStatus(status)) return false
    if (isElectricity((data as any)?.service_type)) {
      return String((data as any)?.token || '').trim().length > 0
    }
    return true
  }, [data])
  const electricityIdentity = useMemo(() => resolveElectricityIdentity(data), [data])
  const effectiveReference = useMemo(
    () => pickFirst(resolvedReference, isBillRef(receiptRef) ? receiptRef : '', reference),
    [resolvedReference, receiptRef, reference]
  )

  // ---- Safe polling (NO MULTI-INTERVALS) ----
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)
  const hasQueriedVendorRef = useRef(false)
  const hasLoadedProfileRef = useRef(false)
  const didRefreshOnTerminalRef = useRef(false)
  const mountedRef = useRef(true)
  const refetchInFlightRef = useRef(false)
  const lastRefetchAtRef = useRef(0)

  const safeRefetch = useCallback(
    async (force = false) => {
      const now = Date.now()
      if (!force && now - lastRefetchAtRef.current < 3500) return
      if (refetchInFlightRef.current) return

      refetchInFlightRef.current = true
      lastRefetchAtRef.current = now
      try {
        await refetch?.()
      } finally {
        refetchInFlightRef.current = false
      }
    },
    [refetch]
  )

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopPolling()
    }
  }, [stopPolling])

  useEffect(() => {
    pollCountRef.current = 0
    hasQueriedVendorRef.current = false
    didRefreshOnTerminalRef.current = false
    stopPolling()
  }, [reference, orderId, stopPolling])

  useEffect(() => {
    if (!hasLoadedProfileRef.current) {
      hasLoadedProfileRef.current = true
      try {
        loadProfile({ force: true })
      } catch {
        // ignore
      }
    }
  }, [loadProfile])

  useEffect(() => {
    if (!data) return

    const status = norm((data as any)?.status)
    const ref = effectiveReference

    if (isTerminalStatus(status)) {
      stopPolling()

      if (!didRefreshOnTerminalRef.current) {
        didRefreshOnTerminalRef.current = true
        try {
          loadProfile({ force: true })
        } catch {
          // ignore
        }
      }
      return
    }

    if (ref && isStillProcessing(status) && !hasQueriedVendorRef.current) {
      hasQueriedVendorRef.current = true
      ;(async () => {
        try {
          if (__DEV__) {
            log('[TXN] nudge queryTransaction', { resolvedReference: ref, status })
          }
          await queryTransaction(ref)
        } catch {
          // ignore
        } finally {
          safeRefetch(true)
        }
      })()
    }

    if (!pollTimerRef.current && isStillProcessing(status)) {
      pollCountRef.current = 0

      pollTimerRef.current = setInterval(() => {
        if (!mountedRef.current) {
          stopPolling()
          return
        }

        pollCountRef.current += 1

        if (pollCountRef.current >= 48) {
          stopPolling()
          return
        }

        safeRefetch()
      }, 5000)
    }
  }, [data, effectiveReference, safeRefetch, loadProfile, stopPolling])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return
      const status = String((data as any)?.status || '')
      if (isStillProcessing(status)) {
        safeRefetch(true)
      }
    })
    return () => sub.remove()
  }, [data, safeRefetch])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return
      const status = String((data as any)?.status || '')
      if (isStillProcessing(status)) {
        refetch?.()
      }
    })
    return () => sub.remove()
  }, [data, refetch])

  // Resolve reference when route param is UUID by fetching transaction_record once
  useEffect(() => {
    if (resolvedReference || attemptedResolveRef.current) return
    const routeParam = reference || orderId
    if (!routeParam) return
    if (reference && isBillRef(reference)) {
      setResolvedReference(reference)
      return
    }
    if (receiptRef && isBillRef(receiptRef)) {
      setResolvedReference(String(receiptRef))
      return
    }
    if (!isUuidLike(routeParam)) return

    attemptedResolveRef.current = true
    ;(async () => {
      // UUID-like route params are usually bill-order ids; resolve through purchase first.
      try {
        const proc = unwrap<any>(await getPurchaseOrder(routeParam))
        const refResolved = resolveBillish(proc)
        if (refResolved && isBillRef(refResolved)) {
          setResolvedReference(String(refResolved))
          return
        }
      } catch {
        // fallback to transaction record lookup
      }

      try {
        const record = unwrap<any>(await getTransactionRecord(routeParam))
        const refResolved = pickFirst(
          record?.reference,
          record?.transaction_reference,
          record?.transaction_record?.reference
        )
        if (refResolved && isBillRef(refResolved)) {
          setResolvedReference(String(refResolved))
          return
        }
      } catch {
        // ignore; polling will continue on UUID
      }
    })()
  }, [orderId, reference, receiptRef, resolvedReference])

  // Dev logs for diagnostics
  useEffect(() => {
    if (__DEV__ && data) {
      log('[TXN] status snapshot', {
        routeParam: reference || orderId,
        status: (data as any)?.status,
        reference: effectiveReference,
        bill_order_id: (data as any)?.bill_order_id || (data as any)?.bill_order?.id || (data as any)?.id,
      })
    }
  }, [data, effectiveReference, orderId, reference])

  // ---- Share helpers ----
  const handleCopyToken = async () => {
    try {
      Alert.alert('Copied', 'Token copied to clipboard.')
    } catch {
      Alert.alert('Copy failed', 'Please try again.')
    }
  }

  const handleShare = async () => {
    try {
      const ref = pickFirst((data as any)?.reference, (data as any)?.id, reference, '—')
      await Share.share({
        message:
          `Payment Successful\n` +
          `Amount: ${moneyFormat(Number((data as any)?.amount ?? 0))}\n` +
          `Ref: ${ref}\n` +
          `Date: ${(data as any)?.created_at ?? '—'}`,
      })
    } catch {
      /* canceled */
    }
  }

  const handleShareReceipt = async () => {
    try {
      const amount = moneyFormat(Number((data as any)?.total_amount ?? (data as any)?.amount ?? 0))
      const ref = pickFirst((data as any)?.reference, (data as any)?.id, reference, '—')
      const status = (data as any)?.status ?? 'pending'
      const created = (data as any)?.created_at ?? '—'
      await Share.share({
        message:
          `BitBridge Receipt\n` +
          `Status: ${status}\n` +
          `Amount: ${amount}\n` +
          `Reference: ${ref}\n` +
          `Date: ${created}`,
      })
    } catch {
      /* canceled */
    }
  }

  /**
   * ✅ Clean receipt flow:
   * Always pass the REAL reference (fbg-/bbg-), never UUID id.
   */
  const handleViewReceipt = useCallback(() => {
    const finalReceiptRef = String(fallbackReceiptRef || '').trim()
    if (!finalReceiptRef) {
      router.push('/')
      return
    }
    router.push({
      pathname: '/transaction/receipt',
      params: { reference: finalReceiptRef },
    } as any)
  }, [fallbackReceiptRef, router])

  // ---- Optional manual cancel (ONLY for bbg-*; never auto) ----
  const handleCancel = async () => {
    const ref = String(reference || '')
    if (!ref || !ref.startsWith('bbg-')) return

    Alert.alert(
      'Cancel payment?',
      'This will mark the transaction as declined. Only do this if you intentionally want to cancel.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelPayment(ref)
              refetch?.()
              loadProfile({ force: true })
            } catch (e: any) {
              Alert.alert('Cancel failed', e?.message || 'Please try again.')
            }
          },
        },
      ]
    )
  }

  // ---- UI blocks ----
  const billContent = (
    <>
      {isBillSuccess ? (
        <View className="items-center pt-14 pb-8 px-6">
          <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
            <Ionicons name="checkmark" size={36} color="#16a34a" />
          </View>
          <Text className="text-2xl font-bold text-slate-100">Payment Successful</Text>
          <Text className="text-slate-400 mt-1">
            Your {(data as any)?.biller} {(data as any)?.service_types} purchase is complete.
          </Text>
        </View>
      ) : (
        <View className="items-center pt-14 pb-8 px-6">
          <View className="w-16 h-16 rounded-full bg-slate-800 items-center justify-center mb-4">
            <Ionicons name="time-outline" size={34} color="#94a3b8" />
          </View>
          <Text className="text-2xl font-bold text-white">
            {(data as any)?.status ? `Status: ${(data as any)?.status}` : 'Processing...'}
          </Text>
          <Text className="text-gray-400 mt-1">
            {isElectricity((data as any)?.service_type) && isSuccessfulStatus((data as any)?.status)
              ? 'Payment succeeded. Finalizing electricity token...'
              : 'If this stays pending, please wait a moment — it may be confirming.'}
          </Text>
        </View>
      )}

      <View className="mx-4 rounded-2xl p-4 bg-slate-900 mb-4">
        <Text className="text-slate-200 font-semibold mb-2">Receipt Summary</Text>
        <Row label="Service" value={(data as any)?.service_type || '—'} />
        <Row label="Recipient" value={(data as any)?.meter_number || (data as any)?.phone_number || '—'} />
        <Row label="Reference" value={pickFirst((data as any)?.reference, (data as any)?.id, reference, '—')} />
        <Row label="Status" value={(data as any)?.status ?? 'pending'} />
      </View>

      <View className="mx-4 rounded-2xl p-5 shadow-sm bg-gray-900">
        <View className="items-center mb-4">
          <Text className="text-slate-200">Amount</Text>
          <Text className="text-3xl font-extrabold text-slate-100 mt-1">
            ₦{Number((data as any)?.total_amount ?? 0).toLocaleString()}
          </Text>
        </View>

        {(data as any)?.service_type === 'ELECTRICITY' &&
          isSuccessfulStatus((data as any)?.status) &&
          !!(data as any)?.token && (
          <View className="border border-slate-700 rounded-xl p-4 mb-4 bg-slate-900">
            <Text className="text-slate-200 text-xs mb-1">{(data as any)?.biller} Token</Text>
            <View className="flex-row items-center justify-between flex-wrap">
              <Text selectable className="text-lg font-semibold tracking-widest text-slate-200">
                {(data as any)?.token}
              </Text>
              <Pressable
                onPress={handleCopyToken}
                className="px-3 py-2 rounded-lg bg-gray-900 border border-slate-700"
              >
                <View className="flex-row items-center">
                  <Ionicons name="copy-outline" size={18} color={'gray'} />
                  <Text className="ml-1 font-medium text-slate-400">Copy</Text>
                </View>
              </Pressable>
            </View>
            <Pressable onPress={handleShare} className="self-start mt-3">
              <View className="flex-row items-center">
                <Ionicons name="share-outline" color={'white'} size={18} />
                <Text className="ml-1 text-slate-300 font-medium">Share</Text>
              </View>
            </Pressable>
          </View>
        )}

        <Row label="Meter/Phone" value={(data as any)?.meter_number || (data as any)?.phone_number} />
        {!!electricityIdentity.customerName && <Row label="Customer Name" value={electricityIdentity.customerName} />}
        {!!electricityIdentity.serviceAddress && <Row label="Address" value={electricityIdentity.serviceAddress} />}
        <Row label="Provider" value={(data as any)?.biller} />
        {(data as any)?.units && <Row label="Units (kWh)" value={(data as any)?.units ?? '-'} />}
        {!!(data as any)?.service_charge &&
          Number((data as any)?.service_charge) > 0 && (
            <Row label="Service Charge" value={moneyFormat(Number((data as any)?.service_charge || 0))} />
          )}
        {(data as any)?.total_amount && (
          <Row label="Total Debited" value={moneyFormat(Number((data as any)?.total_amount || 0))} />
        )}
        <Row label="Payment Method" value={(data as any)?.payment_method ?? '—'} />
        <Row label="Reference" value={pickFirst((data as any)?.reference, (data as any)?.id, reference, '—')} />
        <Row label="Date" value={(data as any)?.created_at} />

        {canOpenReceipt ? (
          <Pressable
            onPress={handleViewReceipt}
            className="mt-4 w-full rounded-2xl bg-theme-primary py-3 items-center"
          >
            <Text className="text-white font-semibold">View Receipt Details</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => safeRefetch(true)}
            className="mt-4 w-full rounded-2xl border border-slate-600 py-3 items-center"
          >
            <Text className="text-slate-200 font-semibold">Refresh Status</Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleShareReceipt}
          className="mt-3 w-full rounded-2xl border border-slate-600 py-3 items-center"
        >
          <Text className="text-slate-200 font-medium">Share Receipt</Text>
        </Pressable>

        {String(reference || '').startsWith('bbg-') &&
          isStillProcessing(String((data as any)?.status || '')) && (
            <Pressable
              onPress={handleCancel}
              className="mt-3 w-full rounded-2xl border border-red-600 py-3 items-center"
            >
              <Text className="text-red-400 font-medium">Cancel Payment</Text>
            </Pressable>
          )}
      </View>
    </>
  )

  const orderContent = (
    <View className="flex-1 bg-gray-900">
      <View className="items-center pt-14 pb-8 px-6">
        <View className="w-16 h-16 rounded-full bg-green-900 items-center justify-center mb-4">
          <Ionicons name="checkmark" size={36} color="#22c55e" />
        </View>
        <Text className="text-2xl font-bold text-white">Order Received</Text>
        <Text className="text-gray-400 mt-1">Your order has been created.</Text>
      </View>

      <View className="bg-gray-800 mx-4 rounded-2xl p-5 shadow-sm">
        <Text className="text-gray-300 font-semibold mb-2">Receipt Summary</Text>
        <Row label="Order ID" value={(data as any)?.id} />
        <Row label="Status" value={(data as any)?.status ?? 'pending'} />
        <Row label="Items" value={(data as any)?.order_items?.length ?? 0} />
        <Row label="Date" value={(data as any)?.created_at} />

        <View className="items-center mb-4">
          <Text className="text-gray-400">Total Amount</Text>
          <Text className="text-3xl font-extrabold text-white mt-1">
            {moneyFormat((data as any)?.total_amount ?? (data as any)?.amount ?? 0)}
          </Text>
        </View>

        {canOpenReceipt ? (
          <Pressable
            onPress={handleViewReceipt}
            className="mt-4 w-full rounded-2xl bg-theme-primary py-3 items-center"
          >
            <Text className="text-white font-semibold">View Receipt Details</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleShareReceipt}
          className="mt-3 w-full rounded-2xl border border-slate-600 py-3 items-center"
        >
          <Text className="text-slate-200 font-medium">Share Receipt</Text>
        </Pressable>
      </View>
    </View>
  )

  const transactionContent = (
    <View className="flex-1 bg-gray-900">
      {(data as any)?.status === 'approved' ? (
        <View className="items-center pt-14 pb-8 px-6">
          <View className="w-16 h-16 rounded-full bg-green-900 items-center justify-center mb-4">
            <Ionicons name="checkmark" size={36} color="#22c55e" />
          </View>
          <Text className="text-2xl font-bold text-white">Deposit Successful</Text>
          <Text className="text-gray-400 mt-1">Your deposit has been credited.</Text>
        </View>
      ) : (
        <View className="items-center pt-14 pb-8 px-6">
          <View className="w-16 h-16 rounded-full bg-slate-800 items-center justify-center mb-4">
            <Ionicons name="time-outline" size={34} color="#94a3b8" />
          </View>
          <Text className="text-2xl font-bold text-white">
            {(data as any)?.status ? `Status: ${(data as any)?.status}` : 'Processing...'}
          </Text>
          <Text className="text-gray-400 mt-1">
            Deposits can take a moment to reflect. Please wait — we’ll refresh automatically.
          </Text>
        </View>
      )}

      <View className="bg-gray-800 mx-4 rounded-2xl p-5 shadow-sm">
        <View className="items-center mb-4">
          <Text className="text-gray-400">Amount</Text>
          <Text className="text-3xl font-extrabold text-white mt-1">
            ₦{Number((data as any)?.amount ?? 0).toLocaleString()}
          </Text>
        </View>

        <Row label="Reference" value={pickFirst((data as any)?.reference, (data as any)?.id, reference, '—')} />
        <Row label="Date" value={(data as any)?.created_at} />
        <Row label="Payment Method" value={(data as any)?.payment_method ?? '—'} />

        {canOpenReceipt ? (
          <Pressable
            onPress={handleViewReceipt}
            className="mt-4 w-full rounded-2xl bg-theme-primary py-3 items-center"
          >
            <Text className="text-white font-semibold">View Receipt Details</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )

  return (
    <View className="flex-1 px-1 bg-primary">
      {loading ? (
        <LoadingIndicator />
      ) : reference && receiptType === 'fbg' ? (
        transactionContent
      ) : source === 'order' ? (
        orderContent
      ) : (
        billContent
      )}

      <View className="mt-auto px-4 pb-8 pt-6">
        <Pressable
          onPress={() => router.push('/')}
          className="w-full h-14 rounded-2xl bg-theme-primary items-center justify-center"
        >
          <Text className="text-white font-semibold text-base">Back to Home</Text>
        </Pressable>
      </View>
    </View>
  )
}
