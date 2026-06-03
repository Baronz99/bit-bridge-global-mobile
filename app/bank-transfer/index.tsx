import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import NotificationAlert from '@/components/notification'
import SearchablePicker from '@/components/bankTransfer/SearchablePicker'
import BankPickerSheet from '@/components/bankTransfer/BankPickerSheet'
import RecipientVerificationState from '@/components/bankTransfer/RecipientVerificationState'
import TierGateCard from '@/components/bankTransfer/TierGateCard'
import TransactionPinModal from '@/components/TransactionPinModal'
import ReviewSummaryCard from '@/components/bankTransfer/ReviewSummaryCard'
import { createCounterParty, getBanks, getBeneficiaries, initiateFundTransfer, resolveAccountName } from '@/api/account'
import { getWallet } from '@/api/wallet'
import { getTransferQuoteSnapshot } from '@/services/bankTransfer'
import { useAuth } from '@/services/useAuth'
import { useActiveAccount } from '@/services/useActiveAccount'
import { invalidateFetchQueries } from '@/services/useFetch'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { log, warn } from '@/utils/logger'
import {
  BANK_TRANSFER_TIER_REQUIREMENT_COPY,
  buildPinLockoutMessage,
  buildTransferReference,
  computeDailyRemainingAfterTransfer,
  formatNaira,
  getTierDailyLimit,
  getTierFromProfile,
  isLikelyNetworkTimeout,
  isTierEligibleForBankTransfer,
  parseAmountInput,
  validateTransferAmount,
} from '@/utils/bankTransfer'
import { resolveTransferLifecycle } from '@/utils/transferLifecycle'

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
  save_beneficiary: boolean
  description: string
  daily_limit: number
  today_spent: number
  daily_remaining_before: number
  transfer_reference: string
}

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000]
const MIN_TRANSFER_AMOUNT = 150
const FORCE_REFRESH_RETRY_DELAY_MS = 1700
const DEFAULT_TRANSFER_DESCRIPTION = 'Fund Transfer'

const sanitizeDigits = (value: string) => String(value || '').replace(/\D/g, '')
const formatWholeNairaInput = (value: string) => {
  const digits = sanitizeDigits(value)
  if (!digits) return ''
  return digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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

const isWalletQueryKey = (queryKey: unknown[]) => queryKey[0] === 'wallet'

type LooseRecord = Record<string, unknown>

const readPath = (payload: unknown, path: string[]) => {
  let current: unknown = payload
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as LooseRecord)[key]
  }
  return current
}

const extractBalanceSnapshot = (payload: unknown): number | null => {
  const candidates = [
    readPath(payload, ['balance_snapshot', 'bridge', 'balance']),
    readPath(payload, ['balance_snapshot', 'bridge', 'amount']),
    readPath(payload, ['balance_snapshot', 'wallet', 'available_balance']),
    readPath(payload, ['balance_snapshot', 'wallet', 'balance']),
    readPath(payload, ['wallet', 'available_balance']),
    readPath(payload, ['wallet', 'balance']),
    readPath(payload, ['bridge', 'balance']),
    readPath(payload, ['bridge', 'amount']),
    readPath(payload, ['available_balance']),
    readPath(payload, ['wallet_balance_after']),
    readPath(payload, ['balance_after']),
    readPath(payload, ['new_balance']),
    readPath(payload, ['remaining_balance']),
  ]

  for (const value of candidates) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const BankTransferScreen = () => {
  const router = useRouter()
  const { userProfileData, loadProfile } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))
  const { activeAccount } = useActiveAccount()
  const isCircleAccount = activeAccount?.type === 'circle'
  const scrollRef = useRef<ScrollView | null>(null)
  const accountNumberRef = useRef<TextInput | null>(null)
  const amountRef = useRef<TextInput | null>(null)
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastLookupKeyRef = useRef('')
  const lastQuoteAmountRef = useRef<number | null>(null)
  const transferReferenceRef = useRef<string>(buildTransferReference())

  const [banksLoading, setBanksLoading] = useState(true)
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(true)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [lastEnteredPin, setLastEnteredPin] = useState<string | null>(null)
  const [showRetrySubmit, setShowRetrySubmit] = useState(false)
  const [showUpgradeCta, setShowUpgradeCta] = useState(false)
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(null)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
  const [banks, setBanks] = useState<any[]>([])
  const [beneficiaries, setBeneficiaries] = useState<any[]>([])
  const [availableBalance, setAvailableBalance] = useState(0)
  const [todaySpent, setTodaySpent] = useState(0)
  const [saveBeneficiary, setSaveBeneficiary] = useState(false)
  const [showBeneficiaryPicker, setShowBeneficiaryPicker] = useState(false)
  const [selectedBeneficiary, setSelectedBeneficiary] = useState('')
  const [recentBankCodes, setRecentBankCodes] = useState<string[]>([])
  const [formData, setFormData] = useState({
    bank_code: '',
    bank_name: '',
    account_number: '',
    account_name: '',
    beneficiary_name: '',
    amount: '',
    inter_bank: true,
    description: '',
    counter_party_id: '',
  })
  const [accountLookupStatus, setAccountLookupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [accountLookupError, setAccountLookupError] = useState<string | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quotedFee, setQuotedFee] = useState(0)
  const [quotedFeeBreakdown, setQuotedFeeBreakdown] = useState<{ platform_fee: number; stamp_duty_fee: number; total_fee: number } | null>(null)
  const [quotedDailyLimit, setQuotedDailyLimit] = useState(0)
  const [quotedDailySpent, setQuotedDailySpent] = useState(0)
  const [quotedAmount, setQuotedAmount] = useState(0)
  const [feeEstimated, setFeeEstimated] = useState(true)
  const [flowStep, setFlowStep] = useState<1 | 2>(1)

  const tier = useMemo(() => getTierFromProfile(userProfileData), [userProfileData])
  const tierEligible = isTierEligibleForBankTransfer(tier)
  const [tierGateResolved, setTierGateResolved] = useState(false)
  const [effectiveTierEligible, setEffectiveTierEligible] = useState(tierEligible)
  const dailyLimit = quotedDailyLimit > 0 ? quotedDailyLimit : getTierDailyLimit(tier)
  const effectiveTodaySpent = quotedDailySpent > 0 ? quotedDailySpent : todaySpent
  const dailyLimitRemaining = Math.max(0, dailyLimit - effectiveTodaySpent)
  const beneficiaryLocked = Boolean(selectedBeneficiary)

  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        label: bank?.name || bank?.bank_name || bank?.label || 'Unknown bank',
        value: String(bank?.code || bank?.bank_code || bank?.value || bank?.id || bank?.name || ''),
        data: bank,
      })),
    [banks]
  )

  const beneficiaryOptions = useMemo(
    () =>
      beneficiaries.map((item) => ({
        label: `${item?.account_name || item?.name || 'Beneficiary'} - ${item?.bank_name || item?.bank || 'Bank'}`,
        value: String(item?.id || item?.beneficiary_id || item?.counter_party_id || ''),
        data: item,
      })),
    [beneficiaries]
  )

  const selectedBankLabel = useMemo(() => {
    const selected = bankOptions.find((item) => String(item.value) === String(formData.bank_code))
    return selected?.label || formData.bank_name || ''
  }, [bankOptions, formData.bank_code, formData.bank_name])

  const amountValue = parseAmountInput(formData.amount)
  const fee = quotedFee
  const amountValidation = validateTransferAmount({
    amount: amountValue,
    fee,
    availableBalance,
    dailyLimitRemaining,
    minAmount: MIN_TRANSFER_AMOUNT,
  })
  const amountValidationMessage =
    amountValidation.message === 'Enter an amount greater than 0.'
      ? 'Enter amount in whole naira.'
      : amountValidation.message

  const narrationValue = formData.description.trim()
  const resolvedNarration = narrationValue || DEFAULT_TRANSFER_DESCRIPTION
  const dailyRemainingAfterTransfer = computeDailyRemainingAfterTransfer({
    dailyLimitRemaining,
    totalDebit: amountValidation.totalDebit,
  })

  const canResolve =
    sanitizeDigits(formData.account_number).length === 10 &&
    !!formData.bank_code
  const quoteVisible =
    amountValue > 0 &&
    canResolve &&
    quotedAmount === amountValue
  const quoteReadyForAmount = amountValue <= 0 || (quotedAmount === amountValue && !quoteLoading)

  const canContinue =
    effectiveTierEligible &&
    !!formData.bank_code &&
    sanitizeDigits(formData.account_number).length === 10 &&
    accountLookupStatus === 'success' &&
    amountValidation.valid &&
    quoteReadyForAmount &&
    !balanceLoading
  const draft = useMemo<TransferDraft>(() => ({
    bank_code: formData.bank_code,
    bank_name: selectedBankLabel || formData.bank_name,
    account_number: sanitizeDigits(formData.account_number),
    account_name: formData.account_name,
    amount: amountValue,
    fee,
    fee_breakdown: quotedFeeBreakdown || undefined,
    fee_estimated: feeEstimated,
    total_debit: amountValidation.totalDebit,
    inter_bank: formData.inter_bank,
    counter_party_id: formData.counter_party_id || undefined,
    beneficiary_id: selectedBeneficiary || undefined,
    save_beneficiary: saveBeneficiary,
    description: resolvedNarration,
    daily_limit: dailyLimit,
    today_spent: effectiveTodaySpent,
    daily_remaining_before: dailyLimitRemaining,
    transfer_reference: transferReferenceRef.current,
  }), [
    amountValidation.totalDebit,
    amountValue,
    dailyLimit,
    dailyLimitRemaining,
    effectiveTodaySpent,
    fee,
    feeEstimated,
    formData.account_name,
    formData.account_number,
    formData.bank_code,
    formData.bank_name,
    formData.counter_party_id,
    formData.inter_bank,
    quotedFeeBreakdown,
    resolvedNarration,
    saveBeneficiary,
    selectedBankLabel,
    selectedBeneficiary,
  ])

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

  useEffect(() => {
    let mounted = true
    const fallbackBalance = Number(userProfileData?.wallet?.balance ?? 0)
    if (Number.isFinite(fallbackBalance)) {
      setAvailableBalance(fallbackBalance)
    }

    const loadBanks = async () => {
      setBanksLoading(true)
      try {
        const bankList = await getBanks()
        if (mounted) setBanks(Array.isArray(bankList) ? bankList : [])
      } catch (error: unknown) {
        const parsedError = error as { response?: { status?: number; data?: unknown }; message?: string }
        const status = parsedError?.response?.status
        if (status !== 401 && mounted) {
          setNotice({
            message: buildApiErrorMessage({
              status,
              data: parsedError?.response?.data,
              fallback: parsedError?.message || 'Unable to load bank list. You can keep entering details while it retries on reopen.',
            }),
            error: true,
            data: null,
          })
        }
      } finally {
        if (mounted) setBanksLoading(false)
      }
    }

    const loadBeneficiaries = async () => {
      setBeneficiariesLoading(true)
      try {
        const beneficiaryList = await getBeneficiaries()
        if (!mounted) return
        const safeBeneficiaries = Array.isArray(beneficiaryList) ? beneficiaryList : []
        setBeneficiaries(safeBeneficiaries)
        setRecentBankCodes(safeBeneficiaries
          .map((item: any) => String(item?.bank_code || '').trim())
          .filter(Boolean)
          .slice(0, 4))
      } catch {
        if (mounted) setBeneficiaries([])
      } finally {
        if (mounted) setBeneficiariesLoading(false)
      }
    }

    const loadBalance = async () => {
      setBalanceLoading(true)
      try {
        const walletResult = await getWallet(activeAccount)
        if (!mounted) return
        const walletBalance =
          walletResult?.data?.bridge?.balance ??
          walletResult?.data?.bridge?.amount ??
          userProfileData?.wallet?.balance ??
          0
        setAvailableBalance(Number(walletBalance || 0))
      } catch {
        if (mounted && Number.isFinite(fallbackBalance)) setAvailableBalance(fallbackBalance)
      } finally {
        if (mounted) setBalanceLoading(false)
      }
    }

    void loadBanks()
    void loadBeneficiaries()
    void loadBalance()

    return () => {
      mounted = false
    }
  }, [activeAccount, userProfileData?.wallet?.balance])

  useEffect(() => {
    const quoteAmount = amountValue > 0 ? amountValue : MIN_TRANSFER_AMOUNT
    if (lastQuoteAmountRef.current === quoteAmount) return

    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    quoteTimerRef.current = setTimeout(async () => {
      setQuoteLoading(true)
      try {
        const quote = await getTransferQuoteSnapshot(quoteAmount)
        setQuotedFee(Number(quote.fee || 0))
        setQuotedFeeBreakdown({
          platform_fee: Number(quote?.feeBreakdown?.platform_fee ?? quote?.feeBreakdown?.platformFee ?? 0),
          stamp_duty_fee: Number(quote?.feeBreakdown?.stamp_duty_fee ?? quote?.feeBreakdown?.stampDutyFee ?? 0),
          total_fee: Number(quote?.feeBreakdown?.total_fee ?? quote?.fee ?? 0),
        })
        setFeeEstimated(quote.feeIsEstimate === true)
        setQuotedDailyLimit(Number(quote.dailyLimit || 0))
        setQuotedDailySpent(Number(quote.dailySpent || 0))
        setTodaySpent(Number(quote.dailySpent || 0))
        setQuotedAmount(quoteAmount)
        lastQuoteAmountRef.current = quoteAmount
      } finally {
        setQuoteLoading(false)
      }
    }, 400)

    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    }
  }, [amountValue])

  const runResolveAccount = async (force = false) => {
    if (!canResolve) return
    const lookupKey = `${formData.bank_code}:${sanitizeDigits(formData.account_number)}`
    if (!force && accountLookupStatus === 'success' && lastLookupKeyRef.current === lookupKey) return

    try {
      setAccountLookupStatus('loading')
      setAccountLookupError(null)
      const response = await resolveAccountName({
        account: {
          account_number: sanitizeDigits(formData.account_number),
          bank_code: formData.bank_code,
        },
      })
      const accountName = String(response?.account_name || '').trim()
      if (!accountName) {
        setAccountLookupStatus('error')
        setAccountLookupError('Recipient verification failed. Confirm account number and bank.')
        return
      }
      const counterPartyId = extractCounterPartyId(response)
      setFormData((prev) => ({
        ...prev,
        account_name: accountName,
        counter_party_id: counterPartyId || prev.counter_party_id,
      }))
      setAccountLookupStatus('success')
      lastLookupKeyRef.current = lookupKey
      amountRef.current?.focus()
    } catch {
      setAccountLookupStatus('error')
      setAccountLookupError('Recipient verification failed. Confirm account number and bank.')
    }
  }

  useEffect(() => {
    if (!canResolve) {
      setAccountLookupStatus('idle')
      setAccountLookupError(null)
      return
    }

    if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current)
    resolveTimerRef.current = setTimeout(() => {
      runResolveAccount()
    }, 550)

    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current)
    }
  }, [formData.bank_code, formData.account_number, canResolve])

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
    if (!canContinue) {
      setNotice({ message: 'Complete the transfer details and wait for recipient verification before confirming.', error: true, data: null })
      return
    }
    if (submitting) return

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

    setSubmitting(true)
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
      const balanceSnapshot = extractBalanceSnapshot(responseData)
      if (balanceSnapshot !== null) {
        setAvailableBalance(balanceSnapshot)
      }
      void invalidateFetchQueries(isWalletQueryKey)
      const lifecycle = resolveTransferLifecycle({
        lifecycle_state: responseData?.lifecycle_state,
        status: responseData?.status,
        display_message: responseData?.display_message || responseData?.message || (response as any)?.message,
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
      setFlowStep(1)
      transferReferenceRef.current = buildTransferReference()
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
              (response as any)?.transfer_id ||
              (response as any)?.id ||
              '',
            balance_after: balanceSnapshot,
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
          ? error?.retry_after_seconds
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
      setSubmitting(false)
      if (!navigated) {
        setProcessingStage(null)
      }
    }
  }

  const handleContinue = () => {
    if (!canContinue) return
    setFlowStep(2)
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

  const focusField = (ref: React.RefObject<TextInput | null>, y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: true })
      setTimeout(() => ref.current?.focus(), 120)
    })
  }

  if (!tierGateResolved) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  }

  if (isCircleAccount) {
    return (
      <View className="flex-1 bg-primary px-4">
        <View className="pt-10">
          <View className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-5">
            <Text className="text-white text-xl font-semibold">Bank transfer is unavailable in circle context</Text>
            <Text className="text-gray-300 text-sm mt-3">
              Bank transfer is still a wallet feature for personal and business accounts. Use the current circle account for contributions, dues, and activity.
            </Text>

            <TouchableOpacity
              onPress={() => router.replace(`/circles/${activeAccount.circleId}` as any)}
              className="bg-app-primary py-4 rounded-xl mt-5"
            >
              <Text className="text-alt font-semibold text-center">Open circle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push(`/circles/${activeAccount.circleId}/pay` as any)}
              className="border border-gray-700 py-4 rounded-xl mt-3"
            >
              <Text className="text-white font-semibold text-center">Contribute to circle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  if (!effectiveTierEligible) {
    return (
      <View className="flex-1 bg-primary px-4">
        <View className="pt-10">
          <TierGateCard onUpgrade={() => router.replace('/kyc')} />
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 86 : 0}
    >
      <View className="flex-1 bg-primary px-4">
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View className="pt-10">
            <Text className="text-white text-xl font-semibold">Transfer setup</Text>
            <Text className="text-gray-400 text-xs mt-1 mb-4">
              {flowStep === 1 ? 'Step 1 of 2: Transfer details' : 'Step 2 of 2: Confirm details'}
            </Text>
            <View className="flex-row items-center mb-4">
              {[
                { id: 1, label: 'Details' },
                { id: 2, label: 'Review' },
              ].map((item, index, arr) => {
                const completed = flowStep > item.id
                const current = flowStep === item.id
                return (
                  <View key={item.label} className={`flex-1 ${index === arr.length - 1 ? '' : 'mr-2'}`}>
                    <View
                      className={`rounded-lg border px-2 py-2 ${
                        current
                          ? 'border-app-primary bg-app-primary/15'
                          : completed
                          ? 'border-emerald-600/50 bg-emerald-900/15'
                          : 'border-gray-800 bg-gray-900'
                      }`}
                    >
                      <Text
                        className={`text-[11px] text-center font-semibold ${
                          current ? 'text-app-primary' : completed ? 'text-emerald-300' : 'text-gray-500'
                        }`}
                      >
                        {item.id}. {item.label}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>

            <NotificationAlert message={notice.message} error={notice.error} data={notice.data} />

            <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
              <Text className="text-gray-400 text-xs uppercase tracking-widest">Available Balance</Text>
              <Text className="text-white text-2xl font-semibold mt-2">{formatNaira(availableBalance)}</Text>
              {balanceLoading ? <Text className="text-gray-500 text-[11px] mt-1">Refreshing balance...</Text> : null}
              <Text className="text-gray-300 text-xs mt-2">
                Daily limit remaining: {formatNaira(dailyLimitRemaining)}
              </Text>
              <Text className="text-gray-500 text-xs mt-1">Daily limit: {dailyLimit.toLocaleString('en-NG')}</Text>
              <Text className="text-gray-500 text-[11px] mt-1">
                {quoteLoading && quotedDailySpent <= 0 ? 'Loading today spent...' : `Today spent: ${formatNaira(effectiveTodaySpent)}`}
              </Text>
            </View>

            {flowStep === 1 ? (
              <>
                <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text className="text-white text-base font-semibold">Recipient</Text>
                      <Text className="text-gray-500 text-xs mt-1">Enter account details and verify recipient.</Text>
                    </View>
                    {beneficiaryLocked ? (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedBeneficiary('')
                          setFormData((prev) => ({ ...prev, counter_party_id: '', beneficiary_name: '' }))
                          setAccountLookupStatus('idle')
                        }}
                      >
                        <Text className="text-app-primary text-xs">Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Text className="text-white mb-2">Account Number</Text>
                  <TextInput
                    ref={accountNumberRef}
                    value={formData.account_number}
                    onChangeText={(text) => {
                      const next = sanitizeDigits(text).slice(0, 10)
                      setFormData((prev) => ({
                        ...prev,
                        account_number: next,
                        beneficiary_name: '',
                        account_name: '',
                        counter_party_id: '',
                      }))
                      setAccountLookupStatus('idle')
                      setAccountLookupError(null)
                      lastLookupKeyRef.current = ''
                    }}
                    keyboardType="numeric"
                    maxLength={10}
                    editable={!beneficiaryLocked}
                    placeholder="Enter or paste 10-digit account number"
                    placeholderTextColor="gray"
                    onFocus={() => scrollRef.current?.scrollTo({ y: 240, animated: true })}
                    className={`${beneficiaryLocked ? 'bg-gray-900' : 'bg-gray-950'} border border-gray-800 rounded-xl px-4 py-4 text-white`}
                  />
                  <Text className="text-gray-500 text-[11px] mt-2">
                    Enter account number, choose bank, then we verify recipient before you continue.
                  </Text>

                  <View className="mt-4">
                    <BankPickerSheet
                      selectedValue={formData.bank_code}
                      options={bankOptions}
                      recentValues={recentBankCodes}
                      disabled={beneficiaryLocked}
                      onSelect={(option) => {
                        setFormData((prev) => ({
                          ...prev,
                          bank_code: option.value,
                          bank_name: option.label,
                          account_name: '',
                          counter_party_id: '',
                        }))
                        setRecentBankCodes((prev) => [option.value, ...prev.filter((item) => item !== option.value)].slice(0, 6))
                        setAccountLookupStatus('idle')
                        setAccountLookupError(null)
                        lastLookupKeyRef.current = ''
                        focusField(accountNumberRef, 240)
                      }}
                    />
                    {banksLoading ? <Text className="text-gray-500 text-[11px] mt-2">Loading bank list...</Text> : null}
                    {!banksLoading && bankOptions.length < 1 ? (
                      <Text className="text-yellow-300 text-[11px] mt-2">
                        Bank list is not available yet. Reopen this screen or try again shortly.
                      </Text>
                    ) : null}
                  </View>

                  <View className="mt-4 border border-gray-800 rounded-xl bg-gray-950/40">
                    <TouchableOpacity
                      onPress={() => setShowBeneficiaryPicker((prev) => !prev)}
                      className="flex-row items-center justify-between px-4 py-3"
                    >
                      <View>
                        <Text className="text-white text-sm font-semibold">Use saved beneficiary (optional)</Text>
                        <Text className="text-gray-500 text-[11px] mt-1">
                          Quick-fill recipient details from your saved list.
                        </Text>
                      </View>
                      <Text className="text-gray-400 text-lg">{showBeneficiaryPicker ? '-' : '+'}</Text>
                    </TouchableOpacity>
                    {showBeneficiaryPicker ? (
                      <View className="px-4 pb-4">
                        <SearchablePicker
                          label="Saved beneficiary"
                          selectedValue={selectedBeneficiary}
                          options={beneficiaryOptions}
                          placeholder="Select beneficiary"
                          onSelect={(option) => {
                            const data = option.data || {}
                            const bankCode = String(data?.bank_code || data?.bankCode || '').trim()
                            const bankName = String(data?.bank_name || data?.bankName || data?.bank || '').trim()
                            const accountNumber = sanitizeDigits(String(data?.account_number || data?.accountNumber || '')).slice(0, 10)
                            const beneficiaryName = String(data?.account_name || data?.beneficiary_name || data?.name || '').trim()
                            const selectedValue = String(
                              option.value ||
                                data?.id ||
                                data?.beneficiary_id ||
                                data?.counter_party_id ||
                                `${bankCode}:${accountNumber}`
                            )
                            setSelectedBeneficiary(selectedValue)
                            setFormData((prev) => ({
                              ...prev,
                              bank_code: bankCode || prev.bank_code,
                              bank_name: bankName || prev.bank_name,
                              account_number: accountNumber || prev.account_number,
                              account_name: beneficiaryName || '',
                              beneficiary_name: beneficiaryName || '',
                              counter_party_id: extractCounterPartyId(data),
                            }))
                            if (bankCode) {
                              setRecentBankCodes((prev) => [bankCode, ...prev.filter((item) => item !== bankCode)].slice(0, 6))
                            }
                            setAccountLookupStatus('idle')
                            setAccountLookupError(null)
                            lastLookupKeyRef.current = ''
                          }}
                        />
                        {beneficiariesLoading ? (
                          <Text className="text-gray-500 text-[11px] mt-2">Loading saved beneficiaries...</Text>
                        ) : null}
                        {!beneficiariesLoading && beneficiaryOptions.length < 1 ? (
                          <Text className="text-gray-500 text-[11px] mt-2">No saved beneficiaries yet.</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {accountLookupStatus === 'loading' ? (
                    <Text className="text-gray-400 text-xs mt-2">Verifying recipient...</Text>
                  ) : null}
                  {accountLookupStatus === 'error' ? (
                    <View className="flex-row items-center justify-between mt-2">
                      <Text className="text-red-300 text-xs flex-1 pr-3">
                        Verification failed. Confirm bank and account, then retry.
                      </Text>
                      <TouchableOpacity onPress={() => runResolveAccount(true)}>
                        <Text className="text-app-primary text-xs">Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <RecipientVerificationState
                    status={accountLookupStatus}
                    accountName={formData.account_name}
                    bankName={selectedBankLabel}
                    accountNumber={formData.account_number}
                    error={accountLookupError}
                  />

                  <View className="flex-row items-center justify-between mt-4">
                    <Text className="text-white text-sm">Save beneficiary</Text>
                    <Switch value={saveBeneficiary} onValueChange={setSaveBeneficiary} />
                  </View>

                  <View className="mt-5 border-t border-gray-800 pt-5">
                    <Text className="text-white text-base font-semibold mb-3">Transfer details</Text>
                  </View>
                  <Text className="text-white mb-2">Amount (NGN)</Text>
                  <View className="flex-row items-center border border-gray-800 rounded-xl bg-gray-950 px-4">
                    <Text className="text-gray-300 mr-2">N</Text>
                    <TextInput
                      ref={amountRef}
                      value={formData.amount}
                      onChangeText={(text) => setFormData((prev) => ({ ...prev, amount: formatWholeNairaInput(text) }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="gray"
                      onFocus={() => scrollRef.current?.scrollTo({ y: 520, animated: true })}
                      className="flex-1 py-4 text-white"
                    />
                  </View>

                  <View className="flex-row flex-wrap mt-3 gap-2">
                    {QUICK_AMOUNTS.map((quick) => (
                      <TouchableOpacity
                        key={`quick-${quick}`}
                        onPress={() => setFormData((prev) => ({ ...prev, amount: formatWholeNairaInput(String(quick)) }))}
                        className="bg-gray-950 border border-gray-800 rounded-full px-3 py-2"
                      >
                        <Text className="text-white text-xs">{formatNaira(quick)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {!amountValidation.valid && formData.amount ? (
                    <Text className="text-red-300 text-xs mt-3">{amountValidationMessage}</Text>
                  ) : null}

                  {quoteVisible ? (
                    <View className="mt-4 bg-gray-950 border border-gray-800 rounded-xl p-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-gray-400 text-xs">
                          Fee ({feeEstimated ? 'Estimated' : 'Confirmed'})
                        </Text>
                        <Text className="text-white text-xs">{formatNaira(fee)}</Text>
                      </View>
                      <Text className="text-gray-500 text-[10px] mt-1">
                        {feeEstimated ? 'Final fee is confirmed on review.' : 'Fee sourced from transfer quote.'}
                      </Text>
                      <View className="flex-row items-center justify-between mt-2">
                        <Text className="text-gray-400 text-xs">Total debit</Text>
                        <Text className="text-white text-sm font-semibold">{formatNaira(amountValidation.totalDebit)}</Text>
                      </View>
                      <View className="flex-row items-center justify-between mt-2">
                        <Text className="text-gray-400 text-xs">Daily remaining after transfer</Text>
                        <Text className="text-white text-sm">{formatNaira(dailyRemainingAfterTransfer)}</Text>
                      </View>
                      {quoteLoading ? <Text className="text-gray-600 text-[10px] mt-2">Refreshing quote...</Text> : null}
                    </View>
                  ) : amountValue > 0 && canResolve && quoteLoading ? (
                    <View className="mt-4 bg-gray-950 border border-gray-800 rounded-xl p-3">
                      <Text className="text-gray-400 text-xs">Getting fees and daily limit...</Text>
                    </View>
                  ) : null}

                  <View className="flex-row items-center justify-between mt-5">
                    <Text className="text-white text-base font-semibold">Narration</Text>
                    <Text className="text-gray-400 text-xs">{formData.description.length}/50</Text>
                  </View>
                  <TextInput
                    value={formData.description}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text.slice(0, 50) }))}
                    placeholder="Narration for this transfer (optional)"
                    placeholderTextColor="gray"
                    onFocus={() => scrollRef.current?.scrollTo({ y: 760, animated: true })}
                    className="border border-gray-800 rounded-xl px-4 py-4 text-white bg-gray-950 mt-3"
                    maxLength={50}
                  />
                  <Text className="text-gray-500 text-xs mt-2">
                    If left blank, we&apos;ll use &quot;{DEFAULT_TRANSFER_DESCRIPTION}&quot;.
                  </Text>
                </View>
              </>
            ) : null}

            {flowStep === 2 ? (
              <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                <Text className="text-gray-500 text-xs mb-3">
                  If charged, transfer completion will be reflected in timeline automatically.
                </Text>

                <ReviewSummaryCard
                  recipientName={draft.account_name}
                  bankName={draft.bank_name}
                  accountNumber={draft.account_number}
                  amount={Number(draft.amount || 0)}
                  fee={Number(draft.fee || 0)}
                  feeBreakdown={draft.fee_breakdown}
                  totalDebit={Number(draft.total_debit || 0)}
                  description={draft.description}
                  dailyRemainingAfter={dailyRemainingAfterTransfer}
                />
                <Text className="text-gray-500 text-xs mt-2">
                  {draft.fee_estimated
                    ? 'Estimated fee shown. Final fee is confirmed by backend at submission.'
                    : 'Fee confirmed from transfer quote.'}
                </Text>
              </View>
            ) : null}

            <Text className="text-gray-500 text-xs mb-3">{BANK_TRANSFER_TIER_REQUIREMENT_COPY}</Text>
            {flowStep === 1 ? (
              <TouchableOpacity
                onPress={handleContinue}
                disabled={!canContinue || submitting}
                className={`${canContinue ? 'bg-theme-primary' : 'bg-gray-700'} py-5 rounded-xl`}
              >
                <Text className="text-alt font-semibold text-center">Continue to review</Text>
              </TouchableOpacity>
            ) : null}

            {flowStep === 2 ? (
              <View>
                {showUpgradeCta ? (
                  <TouchableOpacity
                    onPress={() => router.push('/kyc')}
                    className="bg-gray-900 border border-gray-700 rounded-xl py-4 mb-3"
                  >
                    <Text className="text-white text-center">Upgrade KYC</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => setPinModalOpen(true)}
                  disabled={submitting || !canContinue}
                  className={`${submitting || !canContinue ? 'bg-gray-700' : 'bg-theme-primary'} py-5 rounded-xl`}
                >
                  <Text className="text-alt font-semibold text-center">
                    {submitting ? 'Processing...' : 'Confirm & enter PIN'}
                  </Text>
                </TouchableOpacity>
                {showRetrySubmit && lastEnteredPin ? (
                  <TouchableOpacity
                    onPress={() => handleSubmit(lastEnteredPin)}
                    disabled={submitting}
                    className="bg-gray-900 border border-gray-700 py-4 rounded-xl mt-3"
                  >
                    <Text className="text-white text-center">Retry transfer</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setFlowStep(1)} className="py-4">
                  <Text className="text-app-primary text-center">Back to transfer form</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handleSubmit}
        onBiometricSubmit={handleBiometricSubmit}
        loading={submitting}
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
      {submitting && processingStage ? (
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
    </KeyboardAvoidingView>
  )
}

export default BankTransferScreen
