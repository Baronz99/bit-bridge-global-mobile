import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { formatNaira, maskAccountNumber } from '@/utils/bankTransfer'
import { resolveTransferLifecycle } from '@/utils/transferLifecycle'
import { useAuth } from '@/services/useAuth'
import {
  getTransferBiometricFailureMessage,
  resolveTransactionBiometricUserId,
  useTransactionBiometrics,
} from '@/services/useTransactionBiometrics'
import CompletionPanel from '@/components/finance/CompletionPanel'

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
  created_at?: string
  biometric_enrollment_status?: 'not_attempted' | 'eligible_not_enabled' | 'enabling' | 'enabled' | 'skipped' | 'failed'
  biometric_enrollment_reason?: string
  biometric_enrollment_message?: string
  biometric_enrollment_code?: string
  biometric_enrollment_details?: string
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

const statusMeta = (state: string) => {
  if (state === 'completed') return { text: 'Successful', tone: 'success' as const }
  if (state === 'failed' || state.startsWith('failed') || state === 'released') {
    return { text: 'Failed', tone: 'failed' as const }
  }
  return { text: 'Pending', tone: 'pending' as const }
}

const formatTime = (value?: string) => {
  if (!value) return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const SuccessScreen = () => {
  const router = useRouter()
  const { summary } = useLocalSearchParams<{ summary?: string }>()
  const { userProfileData } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))

  const payload = useMemo(() => parseSummary(summary), [summary])
  const [transferBiometricState, setTransferBiometricState] = useState<TransferSummary['biometric_enrollment_status']>(
    payload?.biometric_enrollment_status || 'not_attempted'
  )
  const [transferBiometricMessage, setTransferBiometricMessage] = useState(
    String(payload?.biometric_enrollment_message || '').trim()
  )
  const [transferBiometricCode, setTransferBiometricCode] = useState(
    String(payload?.biometric_enrollment_code || '').trim()
  )
  const [transferBiometricDetails, setTransferBiometricDetails] = useState(
    String(payload?.biometric_enrollment_details || '').trim()
  )

  useEffect(() => {
    setTransferBiometricState(payload?.biometric_enrollment_status || 'not_attempted')
    setTransferBiometricMessage(String(payload?.biometric_enrollment_message || '').trim())
    setTransferBiometricCode(String(payload?.biometric_enrollment_code || '').trim())
    setTransferBiometricDetails(String(payload?.biometric_enrollment_details || '').trim())
  }, [
    payload?.biometric_enrollment_details,
    payload?.biometric_enrollment_code,
    payload?.biometric_enrollment_message,
    payload?.biometric_enrollment_status,
  ])

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
    ? 'Transfer completed'
    : lifecycle.isFailure
      ? 'Transfer update required'
      : 'Transfer in progress'

  const badge = statusMeta(lifecycle.state)
  const biometricNotice = useMemo(() => {
    if (transferBiometricState === 'enabled') {
      return {
        error: false,
        message: 'Face ID / Fingerprint is now enabled for future transfer confirmations on this device.',
      }
    }
    if (transferBiometricState === 'failed') {
      return {
        error: true,
        message:
          getTransferBiometricFailureMessage(transferBiometricCode, transferBiometricMessage) ||
          'Transfer biometrics could not be enabled on this device yet.',
      }
    }
    if (transferBiometricState === 'skipped') {
      return {
        error: false,
        message: transferBiometricMessage || 'You can enable Face ID / Fingerprint for future transfers later.',
      }
    }
    return null
  }, [transferBiometricCode, transferBiometricMessage, transferBiometricState])

  const showEnableCard =
    transferBiometricState === 'eligible_not_enabled' ||
    transferBiometricState === 'enabling' ||
    transferBiometricState === 'failed'

  const handleEnableNow = async () => {
    setTransferBiometricState('enabling')
    setTransferBiometricMessage('')
    setTransferBiometricCode('')
    const result = await transactionBiometrics.enablePreparedEnrollment()
    setTransferBiometricState(result.state)
    setTransferBiometricMessage(result.message || '')
    setTransferBiometricCode(result.code || '')
    setTransferBiometricDetails(result.details ? JSON.stringify(result.details) : '')
  }

  const handleLater = () => {
    transactionBiometrics.skipPreparedEnrollment()
    setTransferBiometricState('skipped')
    setTransferBiometricMessage('You can enable Face ID / Fingerprint for future transfers later from this device after another PIN-confirmed transfer.')
    setTransferBiometricCode('')
    setTransferBiometricDetails('')
  }

  if (!payload) {
    return (
      <View className="flex-1 bg-primary px-4">
        <View className="pt-10">
          <CompletionPanel
            eyebrow="Bank transfer"
            title="Transfer submitted"
            supportingText="Check your timeline for the latest provider update."
            primaryLabel="Current status"
            primaryValue="Processing"
            statusLabel="Pending"
            statusTone="pending"
            summaryTitle="What happens next"
            summaryRows={[
              { label: 'Provider status', value: 'Awaiting confirmation', emphasis: true },
              { label: 'Next action', value: 'Track transfer from timeline' },
            ]}
            primaryActionLabel="Track transfer"
            onPrimaryAction={() => router.replace('/(tabs)/timeline')}
            secondaryActionLabel="Done"
            onSecondaryAction={() => router.replace('/(tabs)/wallet')}
          />
        </View>
      </View>
    )
  }

  const summaryRows = [
    { label: 'You paid', value: formatNaira(Number(payload.total_debit || 0)), emphasis: true },
    { label: 'Transfer amount', value: formatNaira(Number(payload.amount || 0)) },
    { label: 'Fee', value: formatNaira(Number(payload.fee || 0)) },
    transferFee > 0 ? { label: 'Transfer fee', value: formatNaira(transferFee) } : null,
    stampDutyFee > 0 ? { label: 'Stamp duty', value: formatNaira(stampDutyFee) } : null,
    { label: 'Recipient', value: payload.account_name },
    { label: 'Destination', value: `${payload.bank_name} • ${maskAccountNumber(payload.account_number)}` },
    payload.description ? { label: 'Narration', value: payload.description } : null,
    { label: 'Transfer ID', value: payload.transfer_reference, mono: true },
    { label: 'Timestamp', value: formatTime(payload.created_at) },
    { label: 'Status', value: badge.text },
    { label: 'Balance impact', value: balanceImpactCopy(lifecycle.state) },
  ].filter(Boolean) as { label: string; value: string; emphasis?: boolean; mono?: boolean }[]

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View className="pt-8 gap-4">
          <CompletionPanel
            eyebrow="Bank transfer"
            title={headerTitle}
            supportingText={lifecycle.message}
            primaryLabel={lifecycle.isSuccess ? 'Recipient received' : lifecycle.isFailure ? 'Transfer outcome' : 'Transfer amount'}
            primaryValue={formatNaira(Number(payload.amount || 0))}
            statusLabel={badge.text}
            statusTone={badge.tone}
            summaryTitle="Settlement summary"
            summaryRows={summaryRows}
            primaryActionLabel={lifecycle.isTerminal && hasTransferReference ? 'View receipt' : 'Track transfer'}
            onPrimaryAction={() => {
              if (lifecycle.isTerminal && hasTransferReference) {
                router.replace({ pathname: '/transaction/receipt', params: { reference: String(payload.transfer_reference || '') } })
                return
              }
              router.replace('/(tabs)/timeline')
            }}
            secondaryActionLabel="Done"
            onSecondaryAction={() => router.replace('/(tabs)/wallet')}
          />

          {showEnableCard ? (
            <View className="rounded-[28px] bg-[#14161B] px-5 py-5 border border-white/6">
              <Text className="text-white text-sm font-semibold">Use Face ID / Fingerprint for future transfers</Text>
              <Text className="text-[#A9AFB8] text-xs mt-2 leading-5">
                {transferBiometricState === 'failed'
                  ? getTransferBiometricFailureMessage(transferBiometricCode, transferBiometricMessage)
                  : 'Enable a faster, device-bound confirmation option for future transfers on this device.'}
              </Text>
              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  disabled={transferBiometricState === 'enabling'}
                  onPress={handleEnableNow}
                  className={`${transferBiometricState === 'enabling' ? 'bg-gray-700' : 'bg-theme-primary'} flex-1 py-3 rounded-[18px]`}
                >
                  <Text className="text-alt text-center font-semibold">
                    {transferBiometricState === 'enabling' ? 'Enabling...' : 'Enable now'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={transferBiometricState === 'enabling'}
                  onPress={handleLater}
                  className="flex-1 py-3 rounded-[18px] bg-[#1A1D24]"
                >
                  <Text className="text-white text-center font-semibold">Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {biometricNotice ? (
            <View className={`rounded-[22px] px-4 py-4 border ${biometricNotice.error ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <Text className={`${biometricNotice.error ? 'text-red-100' : 'text-emerald-100'} text-xs leading-5`}>
                {biometricNotice.message}
              </Text>
              {transferBiometricCode ? <Text className="text-[#B5BAC4] text-[10px] mt-2">Debug code: {transferBiometricCode}</Text> : null}
              {transferBiometricDetails ? <Text className="text-[#8D94A0] text-[10px] mt-1">Debug details: {transferBiometricDetails}</Text> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

export default SuccessScreen

