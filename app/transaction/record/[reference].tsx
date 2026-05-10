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

const cleanText = (value?: unknown) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const lower = text.toLowerCase()
  if (lower === 'undefined' || lower === 'null') return ''
  return text
}

const extractField = (record: TransactionRecordDTO | null, keys: string[]) => {
  if (!record) return ''
  const sources = [
    record as Record<string, unknown>,
    (record.meta as Record<string, unknown> | undefined) || {},
    (record as Record<string, unknown>)?.beneficiary as Record<string, unknown> | undefined,
    (record as Record<string, unknown>)?.details as Record<string, unknown> | undefined,
    (record as Record<string, unknown>)?.provider as Record<string, unknown> | undefined,
    (record as Record<string, unknown>)?.parties as Record<string, unknown> | undefined,
  ]

  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const value = cleanText(source[key])
      if (value) return value
    }
  }
  return ''
}

const maskAccountNumber = (value?: string) => {
  const text = cleanText(value)
  if (!text) return ''
  if (text.includes('*')) return text
  const digits = text.replace(/\D/g, '')
  if (!digits) return text
  if (digits.length <= 4) return digits
  return `****${digits.slice(-4)}`
}

const TransactionRecordScreen = () => {
  const router = useRouter()
  const { reference } = useLocalSearchParams<{ reference?: string | string[] }>()
  const ref = Array.isArray(reference) ? reference[0] : reference
  const uiAfterDataTraceRef = useRef<string | null>(null)
  const isTreasuryPayoutReference = String(ref || '').startsWith('circle-treasury-payout-')

  const fetchRecord = useCallback(async (): Promise<TransactionRecordDTO | null> => {
    if (!ref) return Promise.resolve(null)
    if (isTreasuryPayoutReference) {
      router.replace({
        pathname: '/transaction/receipt',
        params: { reference: String(ref) },
      } as any)
      return Promise.resolve(null)
    }
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
  }, [isTreasuryPayoutReference, ref, router])

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
  const receiptCategory = String(record?.meta?.receipt_category || (record as Record<string, unknown> | undefined)?.receipt_category || '').toLowerCase()
  const eventType = String(record?.event_type || record?.meta?.event_type || '').toLowerCase()
  const destinationType = extractField(record ?? null, ['destination_type'])
  const isTreasuryPayout = receiptCategory === 'treasury_payout' || eventType === 'circle.treasury.payout'
  const isBankDestination = destinationType === 'bank_account' || isTreasuryPayout
  const beneficiaryName = extractField(record ?? null, ['beneficiary_name', 'name', 'account_name'])
  const bankName = extractField(record ?? null, ['beneficiary_bank_name', 'destination_bank_name', 'bank_name', 'bankName', 'bank'])
  const accountNumber = maskAccountNumber(extractField(record ?? null, ['beneficiary_account_number_masked', 'beneficiary_account_number', 'destination_account_number_masked', 'destination_account_number', 'account_number', 'accountNumber', 'account']))
  const narration = extractField(record ?? null, ['narration', 'note', 'description', 'remark'])
  const providerTransferReference = extractField(record ?? null, ['provider_transfer_id', 'transfer_reference', 'provider_reference', 'transaction_reference'])
  const feeBreakdown = (record?.meta as Record<string, unknown> | undefined)?.fee_breakdown as Record<string, unknown> | undefined
  const feeAmount = (() => {
    const canonicalFee = Number(feeBreakdown?.total_fee ?? feeBreakdown?.company_charge ?? feeBreakdown?.platform_fee)
    if (Number.isFinite(canonicalFee) && canonicalFee > 0) return canonicalFee

    const feeCents = Number(feeBreakdown?.total_fee_cents || feeBreakdown?.fee_cents || record?.meta?.fee_cents || 0)
    if (Number.isFinite(feeCents) && feeCents > 0) return feeCents / 100

    return 0
  })()
  const totalDebit = Number((record?.meta as Record<string, unknown> | undefined)?.total_debit_cents || 0) / 100
  const summaryRows: FinanceSummaryRow[] = [
    { label: 'Status', value: lifecycle.message, emphasis: true },
    { label: 'Amount', value: moneyFormat(record?.amount ?? 0) },
    isBankDestination ? { label: 'Recipient', value: beneficiaryName || '--', emphasis: true } : { label: 'Transaction', value: record?.transaction_type || record?.type || '--' },
    isBankDestination ? { label: 'Bank', value: bankName || '--' } : null,
    isBankDestination ? { label: 'Account', value: accountNumber || '--' } : null,
    isBankDestination ? { label: 'Narration', value: narration || '--', wrap: true } : null,
    isBankDestination && feeAmount > 0 ? { label: 'Company charge', value: moneyFormat(feeAmount) } : null,
    isBankDestination && totalDebit > 0 ? { label: 'Total debit', value: moneyFormat(totalDebit) } : null,
    isBankDestination && providerTransferReference ? { label: 'Transfer reference', value: providerTransferReference, mono: true, wrap: true } : null,
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
                eyebrow={isTreasuryPayout ? 'Treasury payout' : 'Wallet transaction'}
                title={isTreasuryPayout ? 'Payout record' : 'Transaction record'}
                supportingText={
                  isTreasuryPayout
                    ? 'Bank payout details, narration, and transfer identifiers are confirmed below.'
                    : 'Status, timing, and identifiers confirmed below.'
                }
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

