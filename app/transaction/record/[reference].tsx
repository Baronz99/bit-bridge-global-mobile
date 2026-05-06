import React, { useCallback, useEffect, useRef } from 'react'
import { ActivityIndicator, Alert, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getTransactionRecord } from '@/api/transactions'
import moneyFormat from '@/utils/moneyFormat'
import PerfTrace from '@/utils/perfTrace'
import { resolveTransferLifecycle } from '@/utils/transferLifecycle'
import { FEATURE_DISPUTES } from '@/constants/featureFlags'
import CompletionPanel from '@/components/finance/CompletionPanel'
import type { FinanceSummaryRow, TransactionRecordDTO, TransactionStatusTone } from '@/components/finance/types'

const TransactionRecordScreen = () => {
  const router = useRouter()
  const { reference } = useLocalSearchParams<{ reference?: string | string[] }>()
  const ref = Array.isArray(reference) ? reference[0] : reference
  const uiAfterDataTraceRef = useRef<string | null>(null)

  const fetchRecord = useCallback(async (): Promise<TransactionRecordDTO | null> => {
    if (!ref) return Promise.resolve(null)
    const traceLabel = `tx_record:api:${ref}`
    PerfTrace.start(traceLabel, { reference: ref })
    try {
      const result = await getTransactionRecord(ref)
      PerfTrace.end(traceLabel, { ok: true })
      uiAfterDataTraceRef.current = `tx_record:ui_after_data:${ref}`
      PerfTrace.start(uiAfterDataTraceRef.current)
      return result as TransactionRecordDTO
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string }
      PerfTrace.end(traceLabel, {
        ok: false,
        status: err?.response?.status ?? null,
        message: err?.message || 'request_failed',
      })
      throw error
    }
  }, [ref])

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

  const record = data as TransactionRecordDTO | null

  const handleShareReceipt = async () => {
    if (!record) return
    try {
      const amount = moneyFormat(Number(record.amount ?? 0))
      const status = record.status ?? 'pending'
      const referenceText = record.reference || record.id || ref
      const created = record.created_at ?? '-'
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
    const referenceText = record?.reference || record?.id || ref
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(referenceText))
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', String(referenceText))
    }
  }

  const handleViewReceipt = useCallback(() => {
    const receiptReference = String(record?.reference || record?.id || ref || '').trim()
    if (!receiptReference) return
    router.push({
      pathname: '/transaction/receipt',
      params: { reference: receiptReference },
    })
  }, [record?.id, record?.reference, ref, router])

  const lifecycle = resolveTransferLifecycle({
    lifecycle_state: record?.lifecycle_state,
    status: record?.status,
    display_message: record?.display_message,
  })
  const statusLabel = lifecycle.shortLabel
  const statusTone: TransactionStatusTone = lifecycle.isSuccess ? 'success' : lifecycle.isFailure ? 'failed' : 'pending'
  const summaryRows: FinanceSummaryRow[] = [
    { label: 'Status', value: lifecycle.message, emphasis: true },
    { label: 'Amount', value: moneyFormat(record?.amount ?? 0) },
    { label: 'Transaction', value: record?.transaction_type || record?.type || '--' },
    { label: 'Transaction ID', value: String(record?.reference || record?.id || ref), mono: true },
    { label: 'Note', value: record?.description || '--' },
    { label: 'Payment method', value: record?.payment_method || '--' },
    { label: 'Timestamp', value: record?.created_at || '--' },
  ]

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="pt-8 gap-4">
          {loading ? (
            <View className="py-16 items-center justify-center">
              <ActivityIndicator size="large" color="#f59e0b" />
            </View>
          ) : error ? (
            <View className="rounded-[28px] bg-[#151515] px-5 py-5">
              <Text className="text-white font-semibold">Unable to load</Text>
              <Text className="text-[#A9AFB8] text-sm mt-2 leading-5">
                {((error as { response?: { data?: { message?: string; error?: string } }; message?: string })?.response?.data?.message) ||
                  ((error as { response?: { data?: { message?: string; error?: string } }; message?: string })?.response?.data?.error) ||
                  ((error as { message?: string })?.message) ||
                  'Something went wrong.'}
              </Text>
              <TouchableOpacity onPress={() => refetch?.()} className="mt-4 bg-theme-primary py-4 rounded-[18px]">
                <Text className="text-alt text-center font-semibold">Try again</Text>
              </TouchableOpacity>
            </View>
          ) : record ? (
            <>
              <CompletionPanel
                eyebrow="Wallet transaction"
                title="Transaction record"
                supportingText="Status, timing, and identifiers confirmed below."
                primaryLabel="Amount"
                primaryValue={moneyFormat(record.amount ?? 0)}
                statusLabel={statusLabel}
                statusTone={statusTone}
                summaryTitle="Details"
                summaryRows={summaryRows}
                primaryActionLabel="View receipt"
                onPrimaryAction={handleViewReceipt}
                secondaryActionLabel="Refresh status"
                onSecondaryAction={() => refetch?.()}
              />

              <View className="gap-3">
                <TouchableOpacity onPress={handleShareReceipt} className="bg-[#171A21] py-4 rounded-[18px] items-center">
                  <Text className="text-white text-sm font-semibold">Share receipt</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCopyReference} className="bg-[#171A21] py-4 rounded-[18px] items-center">
                  <Text className="text-white text-sm font-semibold">Copy transaction ID</Text>
                </TouchableOpacity>
                {FEATURE_DISPUTES && String((record.meta as Record<string, unknown> | undefined)?.circle_transaction_id || '').trim() ? (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/orders/[id]/dispute',
                        params: { id: String((record.meta as Record<string, unknown>)?.circle_transaction_id) },
                      })
                    }
                    className="bg-[#171A21] py-4 rounded-[18px] items-center"
                  >
                    <Text className="text-red-300 text-center font-semibold">Raise dispute</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : (
            <View className="rounded-[28px] bg-[#151515] px-5 py-5">
              <Text className="text-gray-300 text-center">No transaction record found.</Text>
              <TouchableOpacity onPress={() => refetch?.()} className="mt-4 bg-theme-primary py-4 rounded-[18px]">
                <Text className="text-alt text-center font-semibold">Refresh</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default TransactionRecordScreen

