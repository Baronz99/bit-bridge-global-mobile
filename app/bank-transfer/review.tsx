import React, { useMemo, useRef, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import ReviewSummaryCard from '@/components/bankTransfer/ReviewSummaryCard'
import { createCounterParty, initiateFundTransfer, resolveAccountName } from '@/api/account'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import {
  BANK_TRANSFER_TIER_REQUIREMENT_COPY,
  buildPinLockoutMessage,
  buildTransferReference,
  computeDailyRemainingAfterTransfer,
  getTierFromProfile,
  isLikelyNetworkTimeout,
  isTierEligibleForBankTransfer,
} from '@/utils/bankTransfer'

type NoticeState = { message: string | null; error: boolean; data: any | null }

type TransferDraft = {
  bank_code: string
  bank_name: string
  account_number: string
  account_name: string
  amount: number
  fee: number
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
    if (!parsed?.bank_code || !parsed?.account_number || !parsed?.account_name || !parsed?.description) return null
    return parsed
  } catch {
    return null
  }
}

const extractCounterPartyId = (payload: any): string => {
  const direct =
    payload?.counter_party_id ||
    payload?.counterPartyId ||
    payload?.id ||
    payload?.beneficiary_id
  if (direct) return String(direct)
  const nested =
    payload?.data?.counter_party_id ||
    payload?.data?.counterPartyId ||
    payload?.data?.id ||
    payload?.data?.beneficiary_id
  return nested ? String(nested) : ''
}

const ReviewTransferScreen = () => {
  const router = useRouter()
  const { draft: draftParam } = useLocalSearchParams<{ draft?: string }>()
  const { onLogout, userProfileData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [lastEnteredPin, setLastEnteredPin] = useState<string | null>(null)
  const [showRetrySubmit, setShowRetrySubmit] = useState(false)
  const [showUpgradeCta, setShowUpgradeCta] = useState(false)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })

  const draft = useMemo(() => parseDraft(draftParam), [draftParam])
  const transferReferenceRef = useRef<string>('')
  if (!transferReferenceRef.current) {
    transferReferenceRef.current = String(draft?.transfer_reference || buildTransferReference())
  }
  const tierEligible = useMemo(
    () => isTierEligibleForBankTransfer(getTierFromProfile(userProfileData)),
    [userProfileData]
  )
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
      Number(draft.total_debit || 0) >= Number(draft.amount || 0) &&
      String(draft.description || '').trim()
    )
  }, [draft])

  const resolveInterBankCounterPartyId = async (payload: TransferDraft): Promise<string> => {
    const existing = String(payload?.counter_party_id || payload?.beneficiary_id || '').trim()
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

  const handleSubmit = async (transactionPin: string) => {
    if (!tierEligible) {
      setNotice({ message: 'Bank transfer is available from Tier 2.', error: true, data: null })
      return
    }
    if (!draft) {
      setNotice({ message: 'Missing transfer details. Start again.', error: true, data: null })
      return
    }
    if (loading) return
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    setPinError(null)
    setShowRetrySubmit(false)
    setShowUpgradeCta(false)
    setLastEnteredPin(transactionPin)

    const transferReference = transferReferenceRef.current
    try {
      const counterPartyId = draft.inter_bank
        ? await resolveInterBankCounterPartyId(draft)
        : String(draft.counter_party_id || draft.beneficiary_id || '').trim()
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
          pin: transactionPin,
          transfer_reference: transferReference,
          description: String(draft.description || 'Fund Transfer').trim() || 'Fund Transfer',
          counter_party_id: counterPartyId || undefined,
          save_beneficiary: draft.save_beneficiary ? true : undefined,
        },
      })

      const responseData = response?.data || {}
      const backendFee = Number(
        responseData?.fee ??
          responseData?.fees ??
          responseData?.transfer_fee ??
          responseData?.charges ??
          draft.fee ??
          0
      )
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

      setPinModalOpen(false)
      router.replace({
        pathname: '/bank-transfer/success',
        params: {
          summary: JSON.stringify({
            ...draft,
            fee: backendFee,
            total_debit: backendTotalDebit,
            transfer_reference: transferReference,
            transfer_id:
              responseData?.transfer_id ||
              responseData?.id ||
              response?.transfer_id ||
              response?.id ||
              '',
            daily_remaining_after: nextDailyRemaining,
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
        await onLogout().catch(() => {})
        return
      }
      if (messageLower.includes('tier') || messageLower.includes('kyc')) {
        setShowUpgradeCta(true)
      }

      setPinError(message)
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  if (!draft) {
    return (
      <View className="flex-1 bg-primary px-4">
        <View className="pt-10">
          <Text className="text-red-300">Transfer details are missing. Please restart the flow.</Text>
          <TouchableOpacity
            onPress={() => router.replace('/bank-transfer')}
            className="bg-gray-900 border border-gray-800 rounded-xl py-4 mt-4"
          >
            <Text className="text-white text-center">Back to transfer</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (!tierEligible) {
    return (
      <View className="flex-1 bg-primary px-4">
        <View className="pt-10">
          <Text className="text-gray-300">Bank transfer is available from Tier 2.</Text>
          <TouchableOpacity
            onPress={() => router.replace('/kyc')}
            className="bg-theme-primary py-4 rounded-xl mt-4"
          >
            <Text className="text-alt text-center font-semibold">Upgrade to Tier 2</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View className="pt-10">
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
        loading={loading}
        errorMessage={pinError}
        title="Enter PIN to complete transfer"
        helperActionLabel="Forgot PIN? Reset PIN"
        onHelperAction={() => {
          setPinModalOpen(false)
          router.push('/settings/pin/reset')
        }}
      />
    </View>
  )
}

export default ReviewTransferScreen
