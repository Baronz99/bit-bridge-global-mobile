import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import ReviewSummaryCard from '@/components/bankTransfer/ReviewSummaryCard'
import { createCounterParty, initiateFundTransfer, resolveAccountName } from '@/api/account'
import { useAuth } from '@/services/useAuth'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { log, warn } from '@/utils/logger'
import {
  BANK_TRANSFER_TIER_REQUIREMENT_COPY,
  buildPinLockoutMessage,
  buildTransferReference,
  computeDailyRemainingAfterTransfer,
  getTierFromProfile,
  isLikelyNetworkTimeout,
  isTierEligibleForBankTransfer,
} from '@/utils/bankTransfer'
import { resolveTransferLifecycle } from '@/utils/transferLifecycle'
import ScreenContainer from '@/components/ScreenContainer'

const DEFAULT_TRANSFER_DESCRIPTION = 'Fund Transfer'

type NoticeState = { message: string | null; error: boolean; data: any | null }
type ProcessingStage =
  | null
  | {
      badge: string
      title: string
      message: string
    }
type EnrollmentSummary = {
  status: 'not_attempted' | 'eligible_not_enabled' | 'enabling' | 'enabled' | 'skipped' | 'failed'
  reason?: string
  message?: string
  code?: string
}

type TransferDraft = {
  bank_code: string
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
  fee_estimated?: boolean
  total_debit: number
  inter_bank: boolean
  counter_party_id?: string
  beneficiary_id?: string
  save_beneficiary?: boolean
  description?: string
  daily_remaining_before: number
  transfer_reference?: string
}

const parseDraft = (raw: any): TransferDraft | null => {
  const input = Array.isArray(raw) ? raw[0] : raw
  if (!input) return null
  try {
    const parsed = JSON.parse(String(input))
    if (!parsed?.bank_code || !parsed?.account_number || !parsed?.account_name) return null
    return {
      ...parsed,
      description: String(parsed?.description || '').trim() || DEFAULT_TRANSFER_DESCRIPTION,
    }
  } catch {
    return null
  }
}

const extractCounterPartyId = (payload: any): string => {
  const direct =
    payload?.counter_party_id ||
    payload?.counterPartyId ||
    payload?.id
  if (direct) return String(direct)
  const nested =
    payload?.data?.counter_party_id ||
    payload?.data?.counterPartyId ||
    payload?.data?.id
  return nested ? String(nested) : ''
}

const FORCE_REFRESH_RETRY_DELAY_MS = 1700

const ReviewTransferScreen = () => {
  const router = useRouter()
  const { draft: draftParam } = useLocalSearchParams<{ draft?: string }>()
  const { onLogout, userProfileData, loadProfile } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))
  const [loading, setLoading] = useState(false)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [lastEnteredPin, setLastEnteredPin] = useState<string | null>(null)
  const [showRetrySubmit, setShowRetrySubmit] = useState(false)
  const [showUpgradeCta, setShowUpgradeCta] = useState(false)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(null)

  const draft = useMemo(() => parseDraft(draftParam), [draftParam])
  const transferReferenceRef = useRef<string>('')
  if (!transferReferenceRef.current) {
    transferReferenceRef.current = String(draft?.transfer_reference || buildTransferReference())
  }
  const tierEligible = useMemo(
    () => isTierEligibleForBankTransfer(getTierFromProfile(userProfileData)),
    [userProfileData]
  )
  const [tierGateResolved, setTierGateResolved] = useState(false)
  const [effectiveTierEligible, setEffectiveTierEligible] = useState(tierEligible)
  const dailyRemainingAfter = useMemo(() => {
    if (!draft) return 0
    return computeDailyRemainingAfterTransfer({
      dailyLimitRemaining: Number(draft.daily_remaining_before || 0),
      totalDebit: Number(draft.total_debit || 0),
    })
  }, [draft])
  const isReviewComplete = useMemo(() => {
    if (!draft) return false
    return Boolean(
      String(draft.bank_code || '').trim() &&
      String(draft.bank_name || '').trim() &&
      String(draft.account_number || '').trim().length === 10 &&
      String(draft.account_name || '').trim() &&
      Number(draft.amount || 0) > 0 &&
      Number(draft.total_debit || 0) >= Number(draft.amount || 0)
    )
  }, [draft])

  useEffect(() => {
    let mounted = true
    const resolveTierGate = async () => {
      if (tierEligible) {
        if (mounted) {
          setEffectiveTierEligible(true)
          setTierGateResolved(true)
        }
        return
      }

      let refreshed = await loadProfile({ force: true }).catch(() => userProfileData)
      let eligible = isTierEligibleForBankTransfer(getTierFromProfile(refreshed))
      if (!eligible) {
        await new Promise((resolve) => setTimeout(resolve, FORCE_REFRESH_RETRY_DELAY_MS))
        refreshed = await loadProfile({ force: true }).catch(() => refreshed)
        eligible = isTierEligibleForBankTransfer(getTierFromProfile(refreshed))
      }

      if (mounted) {
        setEffectiveTierEligible(eligible)
        setTierGateResolved(true)
      }
    }

    setTierGateResolved(false)
    void resolveTierGate()
    return () => {
      mounted = false
    }
  }, [tierEligible, loadProfile, userProfileData])

  const resolveInterBankCounterPartyId = async (payload: TransferDraft): Promise<string> => {
    const existing = String(payload?.counter_party_id || '').trim()
    if (existing) return existing

    const resolved = await resolveAccountName({
      account: {
        account_number: payload.account_number,
        bank_code: payload.bank_code,
      },
    })
    const resolvedName = String(resolved?.account_name || '').trim()
    const resolvedCounterPartyId = extractCounterPartyId(resolved)
    if (resolvedCounterPartyId) return resolvedCounterPartyId

    const created = await createCounterParty({
      account: {
        bank_code: payload.bank_code,
        account_number: payload.account_number,
        account_name: resolvedName || payload.account_name,
      },
    })
    return extractCounterPartyId(created)
  }

  const submitTransfer = async (credential: {
    pin?: string
    biometric_approval_token?: string
  }) => {
    if (!effectiveTierEligible) {
      setNotice({ message: 'Bank transfer is available from Tier 2.', error: true, data: null })
      return
    }
    if (!draft) {
      setNotice({ message: 'Missing transfer details. Start again.', error: true, data: null })
      return
    }
    if (loading) return
    const stage: ProcessingStage = credential.biometric_approval_token
      ? {
          badge: 'Face ID / Fingerprint confirmed',
          title: 'Submitting transfer',
          message: 'Your biometric confirmation was approved. Sending this transfer securely now.',
        }
      : {
          badge: 'PIN confirmed',
          title: 'Authorizing transfer',
          message: 'Your transaction PIN was received. Submitting this transfer securely now.',
        }
    setLoading(true)
    setProcessingStage(stage)
    setNotice({ message: null, error: false, data: null })
    setPinError(null)
    setShowRetrySubmit(false)
    setShowUpgradeCta(false)
    setLastEnteredPin(credential.pin || null)

    const transferReference = transferReferenceRef.current
    let navigated = false
    try {
      const counterPartyId = draft.inter_bank
        ? await resolveInterBankCounterPartyId(draft)
        : String(draft.counter_party_id || '').trim()
      if (draft.inter_bank && !counterPartyId) {
        throw new Error('Inter-bank transfer requires a resolved beneficiary.')
      }

      const response = await initiateFundTransfer({
        account: {
          account_number: draft.account_number,
          bank_code: draft.bank_code,
          bank: draft.bank_name,
          account_name: draft.account_name,
          amount: Number(draft.amount || 0),
          inter_bank: !!draft.inter_bank,
          ...(credential.pin ? { pin: credential.pin } : {}),
          ...(credential.biometric_approval_token
            ? { biometric_approval_token: credential.biometric_approval_token }
            : {}),
          transfer_reference: transferReference,
          description: String(draft.description || DEFAULT_TRANSFER_DESCRIPTION).trim() || DEFAULT_TRANSFER_DESCRIPTION,
          counter_party_id: counterPartyId || undefined,
          save_beneficiary: draft.save_beneficiary ? true : undefined,
        },
      })

      const responseData =
        ((response as any)?.data && typeof (response as any).data === 'object' ? (response as any).data : null) ||
        (response && typeof response === 'object' ? response : {})
      const backendFee = Number(
        responseData?.fee ??
          responseData?.fees ??
          responseData?.transfer_fee ??
          responseData?.charges ??
          responseData?.fee_breakdown?.total_fee ??
          draft.fee ??
          0
      )
      const backendFeeBreakdown = responseData?.fee_breakdown || draft.fee_breakdown || {}
      const backendTotalDebit = Number(
        responseData?.total_debit ??
          responseData?.amount_debited ??
          responseData?.wallet_amount_charged ??
          draft.total_debit ??
          Number(draft.amount || 0) + backendFee
      )
      const nextDailyRemaining = computeDailyRemainingAfterTransfer({
        dailyLimitRemaining: Number(draft.daily_remaining_before || 0),
        totalDebit: backendTotalDebit,
      })
      const lifecycle = resolveTransferLifecycle({
        lifecycle_state: responseData?.lifecycle_state,
        status: responseData?.status,
        display_message: responseData?.display_message || responseData?.message || response?.message,
      })
      let enrollmentSummary: EnrollmentSummary = { status: 'not_attempted' }

      setPinModalOpen(false)
      if (credential.pin) {
        log('[BANK_TRANSFER][BIOMETRIC] enrollment:begin_after_success', {
          transferReference,
        })
        const enrollmentResult = await transactionBiometrics.prepareEnrollmentAfterPinSuccess(credential.pin)
        enrollmentSummary = {
          status: enrollmentResult.state,
          code: enrollmentResult.code || '',
          message: enrollmentResult.message || '',
        }
        log('[BANK_TRANSFER][BIOMETRIC] enrollment:completed_after_success', {
          transferReference,
          status: enrollmentResult.state,
          code: enrollmentResult.code || null,
        })
      } else {
        warn('[BANK_TRANSFER][BIOMETRIC] enrollment:not_attempted_after_success', {
          transferReference,
          reason: 'pin_not_used_for_this_submission',
        })
      }

      log('[BANK_TRANSFER][BIOMETRIC] navigation_to_success', {
        transferReference,
        enrollmentStatus: enrollmentSummary.status,
        enrollmentReason: enrollmentSummary.reason || null,
      })
      navigated = true
      router.replace({
        pathname: '/bank-transfer/success',
        params: {
          summary: JSON.stringify({
            ...draft,
            fee: backendFee,
            fee_breakdown: backendFeeBreakdown,
            total_debit: backendTotalDebit,
            transfer_reference: transferReference,
            transfer_id:
              responseData?.transfer_id ||
              responseData?.id ||
              response?.transfer_id ||
              response?.id ||
              '',
            daily_remaining_after: nextDailyRemaining,
            lifecycle_state: lifecycle.state,
            status: responseData?.status || lifecycle.state,
            display_message: lifecycle.message,
            biometric_enrollment_status: enrollmentSummary.status,
            biometric_enrollment_reason: enrollmentSummary.reason || '',
            biometric_enrollment_message: enrollmentSummary.message || '',
            biometric_enrollment_code: enrollmentSummary.code || '',
          }),
        },
      })
    } catch (error: any) {
      const status = error?.response?.status || error?.status
      const responseData = error?.response?.data || {}
      if (isLikelyNetworkTimeout(error)) {
        const timeoutMessage =
          'Network timeout. Retry safely. If charged, this transfer will appear in timeline.'
        setPinError(timeoutMessage)
        setNotice({ message: timeoutMessage, error: true, data: null })
        setShowRetrySubmit(true)
        return
      }
      const messageBase = buildApiErrorMessage({
        status,
        data: responseData,
        fallback: error?.message || 'Transfer failed',
      })

      const attemptsRemaining =
        typeof error?.attempts_remaining === 'number'
          ? error.attempts_remaining
          : responseData?.attempts_remaining
      const retryAfterSeconds =
        typeof error?.retry_after_seconds === 'number'
          ? error.retry_after_seconds
          : responseData?.retry_after_seconds

      const message = buildPinLockoutMessage({
        baseMessage: messageBase,
        attemptsRemaining,
        retryAfterSeconds,
      })

      const messageLower = String(message).toLowerCase()
      if (status === 403 && messageLower.includes('set transaction pin')) {
        setPinModalOpen(false)
        router.push('/settings/pin/set')
        return
      }
      if (status === 401) {
        return
      }
      if (messageLower.includes('tier') || messageLower.includes('kyc')) {
        setShowUpgradeCta(true)
      }

      setPinError(message)
      setNotice({ message, error: true, data: null })
      setProcessingStage(null)
    } finally {
      setLoading(false)
      if (!navigated) {
        setProcessingStage(null)
      }
    }
  }

  const handleSubmit = async (transactionPin: string) =>
    submitTransfer({ pin: transactionPin })

  const handleBiometricSubmit = async () => {
    try {
      const approvalToken = await transactionBiometrics.getApprovalToken()
      await submitTransfer({ biometric_approval_token: approvalToken })
    } catch (error: any) {
      const message = error?.message || 'Biometric confirmation failed. Use your transaction PIN.'
      setPinError(message)
      setNotice({ message, error: true, data: null })
    }
  }

  if (!draft) {
    return (
      <ScreenContainer
        scroll={false}
        includeTopInset={false}
        includeTabBarPadding={false}
        horizontalPadding={16}
        topPadding={16}
        bottomPadding={16}
        className="flex-1 bg-primary"
      >
        <View>
          <Text className="text-red-300">Transfer details are missing. Please restart the flow.</Text>
          <TouchableOpacity
            onPress={() => router.replace('/bank-transfer')}
            className="bg-gray-900 border border-gray-800 rounded-xl py-4 mt-4"
          >
            <Text className="text-white text-center">Back to transfer</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    )
  }

  if (!tierGateResolved) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  }

  if (!effectiveTierEligible) {
    return (
      <ScreenContainer
        scroll={false}
        includeTopInset={false}
        includeTabBarPadding={false}
        horizontalPadding={16}
        topPadding={16}
        bottomPadding={16}
        className="flex-1 bg-primary"
      >
        <View>
          <Text className="text-gray-300">Bank transfer is available from Tier 2.</Text>
          <TouchableOpacity
            onPress={() => router.replace('/kyc')}
            className="bg-theme-primary py-4 rounded-xl mt-4"
          >
            <Text className="text-alt text-center font-semibold">Upgrade to Tier 2</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer
      scroll={false}
      includeTopInset={false}
      includeTabBarPadding={false}
      horizontalPadding={16}
      topPadding={0}
      bottomPadding={16}
      className="flex-1 bg-primary"
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View className="pt-6">
          <Text className="text-gray-300 mb-4">Step 2 of 3: Confirm details</Text>
          <Text className="text-gray-500 text-xs mb-3">
            If charged, transfer completion will be reflected in timeline automatically.
          </Text>

          <NotificationAlert message={notice.message} error={notice.error} data={notice.data} />

          <ReviewSummaryCard
            recipientName={draft.account_name}
            bankName={draft.bank_name}
            accountNumber={draft.account_number}
            amount={Number(draft.amount || 0)}
            fee={Number(draft.fee || 0)}
            feeBreakdown={draft.fee_breakdown}
            totalDebit={Number(draft.total_debit || 0)}
            description={draft.description}
            dailyRemainingAfter={dailyRemainingAfter}
          />
          <Text className="text-gray-500 text-xs mt-2">
            {draft.fee_estimated
              ? 'Estimated fee shown. Final fee is confirmed by backend at submission.'
              : 'Fee confirmed from transfer quote.'}
          </Text>

          {showUpgradeCta ? (
            <TouchableOpacity
              onPress={() => router.push('/kyc')}
              className="bg-gray-900 border border-gray-700 rounded-xl py-4 mt-4"
            >
              <Text className="text-white text-center">Upgrade KYC</Text>
            </TouchableOpacity>
          ) : null}
          <Text className="text-gray-500 text-xs mt-4">{BANK_TRANSFER_TIER_REQUIREMENT_COPY}</Text>

          <TouchableOpacity
            onPress={() => setPinModalOpen(true)}
            disabled={loading || !isReviewComplete}
            className={`${loading || !isReviewComplete ? 'bg-gray-700' : 'bg-theme-primary'} py-5 rounded-xl mt-6`}
          >
            <Text className="text-alt font-semibold text-center">
              {loading ? 'Processing...' : 'Confirm & enter PIN'}
            </Text>
          </TouchableOpacity>
          {showRetrySubmit && lastEnteredPin ? (
            <TouchableOpacity
              onPress={() => handleSubmit(lastEnteredPin)}
              disabled={loading}
              className="bg-gray-900 border border-gray-700 py-4 rounded-xl mt-3"
            >
              <Text className="text-white text-center">Retry transfer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handleSubmit}
        onBiometricSubmit={handleBiometricSubmit}
        loading={loading}
        biometricLoading={transactionBiometrics.biometricLoading}
        biometricAvailable={transactionBiometrics.biometricAvailable}
        biometricEnabled={transactionBiometrics.biometricEnabled}
        errorMessage={pinError}
        title="Enter PIN to complete transfer"
        helperActionLabel="Forgot PIN? Reset PIN"
        onHelperAction={() => {
          setPinModalOpen(false)
          router.push('/settings/pin/reset')
        }}
      />
      {loading && processingStage ? (
        <View className="absolute inset-0 bg-primary/85 items-center justify-center px-6">
          <View className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-gray-950 px-5 py-6">
            <View className="self-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 mb-4">
              <Text className="text-amber-200 text-[11px] font-semibold">{processingStage.badge}</Text>
            </View>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text className="text-white text-center text-xl font-semibold mt-4">
              {processingStage.title}
            </Text>
            <Text className="text-gray-300 text-center text-sm mt-2">
              {processingStage.message}
            </Text>
            <Text className="text-gray-500 text-center text-xs mt-4">
              This usually takes only a few seconds.
            </Text>
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  )
}

export default ReviewTransferScreen


