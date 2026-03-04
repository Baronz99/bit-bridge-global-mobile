import React, { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { formatNaira, maskAccountNumber } from '@/utils/bankTransfer'
import { resolveTransferLifecycle } from '@/utils/transferLifecycle'

type TransferSummary = {
  bank_name: string
  account_number: string
  account_name: string
  amount: number
  fee: number
  fee_breakdown?: {
    platform_fee?: number
    stamp_duty_fee?: number
    total_fee?: number
  }
  total_debit: number
  description?: string
  transfer_reference: string
  lifecycle_state?: string
  status?: string
  display_message?: string
  transfer_id?: string
}

const parseSummary = (raw: any): TransferSummary | null => {
  const input = Array.isArray(raw) ? raw[0] : raw
  if (!input) return null
  try {
    const parsed = JSON.parse(String(input))
    if (!parsed?.transfer_reference) return null
    return parsed
  } catch {
    return null
  }
}

const balanceImpactCopy = (state: string) => {
  if (state === 'failed_refunded' || state === 'released') return 'Funds have been returned to your available balance.'
  if (state === 'failed_reversal_pending') return 'Debit occurred. Reversal is in progress.'
  if (state === 'failed_unrecovered') return 'Reversal is pending. Contact support with your transfer reference.'
  if (state === 'pending_provider' || state === 'reserved' || state === 'pending') {
    return 'Amount may remain reserved until provider confirmation is complete.'
  }
  return 'Transfer was completed and reflected in your wallet ledger.'
}

const statusBadgeStyle = (state: string) => {
  if (state === 'completed') return { text: 'Successful', classes: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' }
  if (state === 'failed' || state.startsWith('failed') || state === 'released') {
    return { text: 'Failed', classes: 'bg-red-500/15 border-red-500/40 text-red-300' }
  }
  return { text: 'Pending', classes: 'bg-amber-500/15 border-amber-500/40 text-amber-300' }
}

const SuccessScreen = () => {
  const router = useRouter()
  const { summary } = useLocalSearchParams<{ summary?: string }>()

  const payload = useMemo(() => parseSummary(summary), [summary])
  const transferFee = Number(payload?.fee_breakdown?.platform_fee ?? 0)
  const stampDutyFee = Number(payload?.fee_breakdown?.stamp_duty_fee ?? 0)
  const hasTransferReference = Boolean(String(payload?.transfer_reference || '').trim())

  const lifecycle = useMemo(
    () =>
      resolveTransferLifecycle({
        lifecycle_state: payload?.lifecycle_state,
        status: payload?.status,
        display_message: payload?.display_message,
      }),
    [payload?.display_message, payload?.lifecycle_state, payload?.status]
  )

  const headerTitle = lifecycle.isSuccess
    ? 'Transfer Successful'
    : lifecycle.isFailure
      ? 'Transfer Failed'
      : 'Transfer Submitted'

  const stepLabel = lifecycle.isSuccess
    ? 'Step 3 of 3: Completed'
    : lifecycle.isFailure
      ? 'Step 3 of 3: Update required'
      : 'Step 3 of 3: Processing'
  const badge = statusBadgeStyle(lifecycle.state)

  if (!payload) {
    return (
      <View className="flex-1 bg-primary px-4">
        <View className="pt-10">
          <Text className="text-white text-2xl mb-2">Transfer Update</Text>
          <Text className="text-gray-300">Transfer was submitted. Check timeline for latest status.</Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/wallet')}
            className="bg-theme-primary py-4 rounded-xl mt-4"
          >
            <Text className="text-alt text-center font-semibold">Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View className="pt-10">
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-2xl">{headerTitle}</Text>
            <View className={`px-3 py-1 rounded-full border ${badge.classes}`}>
              <Text className="text-[11px] font-semibold">{badge.text}</Text>
            </View>
          </View>
          <Text className="text-gray-300 mt-2 mb-1">{stepLabel}</Text>
          <Text className="text-gray-500 text-xs mb-4">{lifecycle.message}</Text>

          <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <Text className="text-white text-base font-semibold mb-3">Transfer summary</Text>

            <Text className="text-gray-400 text-xs">From</Text>
            <Text className="text-white text-sm mb-2">BitBridge NGN Wallet</Text>

            <Text className="text-gray-400 text-xs">To</Text>
            <Text className="text-white text-sm">{payload.account_name}</Text>
            <Text className="text-gray-400 text-xs mb-2">
              {payload.bank_name} - {maskAccountNumber(payload.account_number)}
            </Text>

            <Text className="text-gray-400 text-xs">Amount</Text>
            <Text className="text-white text-sm mb-2">{formatNaira(Number(payload.amount || 0))}</Text>

            <Text className="text-gray-400 text-xs">Fee</Text>
            <Text className="text-white text-sm mb-2">{formatNaira(Number(payload.fee || 0))}</Text>

            {transferFee > 0 ? (
              <>
                <Text className="text-gray-400 text-xs">Transfer Fee</Text>
                <Text className="text-white text-sm mb-2">{formatNaira(transferFee)}</Text>
              </>
            ) : null}

            {stampDutyFee > 0 ? (
              <>
                <Text className="text-gray-400 text-xs">Stamp Duty</Text>
                <Text className="text-white text-sm mb-2">{formatNaira(stampDutyFee)}</Text>
              </>
            ) : null}

            <Text className="text-gray-400 text-xs">Total Debit</Text>
            <Text className="text-white text-sm mb-2">{formatNaira(Number(payload.total_debit || 0))}</Text>

            <Text className="text-gray-400 text-xs">Balance impact</Text>
            <Text className="text-white text-sm mb-2">{balanceImpactCopy(lifecycle.state)}</Text>

            {payload.description ? (
              <>
                <Text className="text-gray-400 text-xs">Narration</Text>
                <Text className="text-white text-sm mb-2">{payload.description}</Text>
              </>
            ) : null}

            <Text className="text-gray-400 text-xs">Transfer Reference</Text>
            <Text className="text-white text-xs">{payload.transfer_reference}</Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (lifecycle.isTerminal && hasTransferReference) {
                router.replace({
                  pathname: '/transaction/receipt',
                  params: { reference: String(payload.transfer_reference || '') },
                })
                return
              }
              if (hasTransferReference) {
                router.replace({
                  pathname: '/transaction/record/[reference]',
                  params: { reference: String(payload.transfer_reference || '') },
                })
                return
              }
              router.replace('/(tabs)/timeline')
            }}
            className="bg-theme-primary py-4 rounded-xl mt-5"
          >
            <Text className="text-alt text-center font-semibold">
              {lifecycle.isTerminal && hasTransferReference ? 'View Receipt' : 'Track Transfer'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/wallet')}
            className="bg-gray-900 border border-gray-800 py-4 rounded-xl mt-3"
          >
            <Text className="text-white text-center">Done</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

export default SuccessScreen

