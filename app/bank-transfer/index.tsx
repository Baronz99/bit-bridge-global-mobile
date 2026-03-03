import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import NotificationAlert from '@/components/notification'
import SearchablePicker from '@/components/bankTransfer/SearchablePicker'
import BankPickerSheet from '@/components/bankTransfer/BankPickerSheet'
import RecipientVerificationState from '@/components/bankTransfer/RecipientVerificationState'
import TierGateCard from '@/components/bankTransfer/TierGateCard'
import { getBanks, getBeneficiaries, resolveAccountName } from '@/api/account'
import { getUserWallet } from '@/api/wallet'
import { getTodayTransferSpent, getTransferQuoteSnapshot } from '@/services/bankTransfer'
import { useAuth } from '@/services/useAuth'
import {
  BANK_TRANSFER_TIER_REQUIREMENT_COPY,
  buildTransferReference,
  computeDailyRemainingAfterTransfer,
  formatNaira,
  getTierDailyLimit,
  getTierFromProfile,
  isTierEligibleForBankTransfer,
  parseAmountInput,
  validateTransferAmount,
} from '@/utils/bankTransfer'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

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

const sanitizeDigits = (value: string) => String(value || '').replace(/\D/g, '')

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

const BankTransferScreen = () => {
  const router = useRouter()
  const { userProfileData, onLogout, loadProfile } = useAuth()
  const scrollRef = useRef<ScrollView | null>(null)
  const accountNumberRef = useRef<TextInput | null>(null)
  const amountRef = useRef<TextInput | null>(null)
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastLookupKeyRef = useRef('')
  const lastQuoteAmountRef = useRef<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
  const [banks, setBanks] = useState<any[]>([])
  const [beneficiaries, setBeneficiaries] = useState<any[]>([])
  const [availableBalance, setAvailableBalance] = useState(0)
  const [todaySpent, setTodaySpent] = useState(0)
  const [saveBeneficiary, setSaveBeneficiary] = useState(false)
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

  const narrationValue = formData.description.trim()
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

  const canContinue =
    effectiveTierEligible &&
    !!formData.bank_code &&
    sanitizeDigits(formData.account_number).length === 10 &&
    narrationValue.length > 0 &&
    accountLookupStatus === 'success' &&
    amountValidation.valid
  const canContinueRecipient =
    effectiveTierEligible &&
    !!formData.bank_code &&
    sanitizeDigits(formData.account_number).length === 10 &&
    accountLookupStatus === 'success'

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
    const loadData = async () => {
      setLoading(true)
      setNotice({ message: null, error: false, data: null })
      try {
        const [bankList, beneficiaryList, walletResult, todaySpentResult] = await Promise.all([
          getBanks(),
          getBeneficiaries().catch(() => []),
          getUserWallet().catch(() => ({})),
          getTodayTransferSpent().catch(() => 0),
        ])
        setBanks(Array.isArray(bankList) ? bankList : [])
        const safeBeneficiaries = Array.isArray(beneficiaryList) ? beneficiaryList : []
        setBeneficiaries(safeBeneficiaries)
        const seededRecentBanks = safeBeneficiaries
          .map((item: any) => String(item?.bank_code || '').trim())
          .filter(Boolean)
          .slice(0, 4)
        setRecentBankCodes(seededRecentBanks)
        const walletBalance =
          walletResult?.data?.bridge?.balance ??
          walletResult?.data?.bridge?.amount ??
          userProfileData?.wallet?.balance ??
          0
        setAvailableBalance(Number(walletBalance || 0))
        const initialSpent = Number(todaySpentResult || 0)
        setTodaySpent(initialSpent)
        const quote = await getTransferQuoteSnapshot(MIN_TRANSFER_AMOUNT).catch(() => null)
        if (quote) {
          setQuotedFee(Number(quote.fee || 0))
          setQuotedFeeBreakdown({
            platform_fee: Number(quote?.feeBreakdown?.platform_fee ?? quote?.feeBreakdown?.platformFee ?? 0),
            stamp_duty_fee: Number(quote?.feeBreakdown?.stamp_duty_fee ?? quote?.feeBreakdown?.stampDutyFee ?? 0),
            total_fee: Number(quote?.feeBreakdown?.total_fee ?? quote?.fee ?? 0),
          })
          setFeeEstimated(quote.feeIsEstimate === true)
          setQuotedDailyLimit(Number(quote.dailyLimit || 0))
          setQuotedDailySpent(Number(quote.dailySpent || initialSpent))
          setQuotedAmount(MIN_TRANSFER_AMOUNT)
        }
      } catch (error: any) {
        const status = error?.response?.status
        if (status === 401) {
          await onLogout().catch(() => {})
          return
        }
        setNotice({
          message: buildApiErrorMessage({
            status,
            data: error?.response?.data,
            fallback: error?.message || 'Unable to load transfer form',
          }),
          error: true,
          data: null,
        })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [onLogout, userProfileData?.wallet?.balance])

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

  const handleContinue = () => {
    if (!canContinue) return
    const draft: TransferDraft = {
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
      description: narrationValue,
      daily_limit: dailyLimit,
      today_spent: effectiveTodaySpent,
      daily_remaining_before: dailyLimitRemaining,
      transfer_reference: buildTransferReference(),
    }
    router.push({
      pathname: '/bank-transfer/review',
      params: { draft: JSON.stringify(draft) },
    })
  }

  const handleRecipientContinue = () => {
    if (!canContinueRecipient) return
    setFlowStep(2)
  }

  const focusField = (ref: React.RefObject<TextInput>, y: number) => {
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
              {flowStep === 1 ? 'Step 1 of 3: Recipient details' : 'Step 2 of 3: Amount and narration'}
            </Text>
            <View className="flex-row items-center mb-4">
            {[
              { id: 1, label: 'Recipient' },
              { id: 2, label: 'Details' },
              { id: 3, label: 'Review' },
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
              <Text className="text-gray-300 text-xs mt-2">
                Daily limit remaining: {formatNaira(dailyLimitRemaining)}
              </Text>
              <Text className="text-gray-500 text-xs mt-1">Daily limit: {dailyLimit.toLocaleString('en-NG')}</Text>
              <Text className="text-gray-500 text-[11px] mt-1">
                Today spent: {formatNaira(effectiveTodaySpent)}
              </Text>
            </View>

            {flowStep === 1 && (
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

            <SearchablePicker
              label="Saved beneficiary (optional)"
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
              </View>
            )}

            {flowStep === 2 && (
              <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                <Text className="text-white text-base font-semibold mb-3">Recipient summary</Text>
                <View className="bg-gray-950 border border-gray-800 rounded-xl p-3 mb-4">
                  <Text className="text-gray-400 text-xs">Bank</Text>
                  <Text className="text-white text-sm mt-1">{selectedBankLabel || '-'}</Text>
                  <Text className="text-gray-400 text-xs mt-3">Account number</Text>
                  <Text className="text-white text-sm mt-1">{formData.account_number || '-'}</Text>
                  <Text className="text-gray-400 text-xs mt-3">Account name</Text>
                  <Text className="text-white text-sm mt-1">{formData.account_name || '-'}</Text>
                </View>
                <Text className="text-white text-base font-semibold mb-3">Amount</Text>
                <Text className="text-white mb-2">Amount (NGN)</Text>
                <View className="flex-row items-center border border-gray-800 rounded-xl bg-gray-950 px-4">
                  <Text className="text-gray-300 mr-2">N</Text>
                  <TextInput
                    ref={amountRef}
                    value={formData.amount}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, amount: text.replace(/[^0-9.]/g, '') }))}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="gray"
                    onFocus={() => scrollRef.current?.scrollTo({ y: 520, animated: true })}
                    className="flex-1 py-4 text-white"
                  />
                </View>

            <View className="flex-row flex-wrap mt-3 gap-2">
              {QUICK_AMOUNTS.map((quick) => (
                <TouchableOpacity
                  key={`quick-${quick}`}
                  onPress={() => setFormData((prev) => ({ ...prev, amount: String(quick) }))}
                  className="bg-gray-950 border border-gray-800 rounded-full px-3 py-2"
                >
                  <Text className="text-white text-xs">{formatNaira(quick)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!amountValidation.valid && formData.amount ? (
              <Text className="text-red-300 text-xs mt-3">{amountValidation.message}</Text>
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
            ) : null}
              </View>
            )}

            {flowStep === 2 && (
              <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-base font-semibold">Narration</Text>
                  <Text className="text-gray-400 text-xs">{formData.description.length}/50</Text>
                </View>
                <TextInput
                  value={formData.description}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text.slice(0, 50) }))}
                  placeholder="Narration for this transfer"
                  placeholderTextColor="gray"
                  onFocus={() => scrollRef.current?.scrollTo({ y: 760, animated: true })}
                  className="border border-gray-800 rounded-xl px-4 py-4 text-white bg-gray-950 mt-3"
                  maxLength={50}
                />
                {!narrationValue ? <Text className="text-red-300 text-xs mt-2">Narration is required.</Text> : null}
              </View>
            )}

            <Text className="text-gray-500 text-xs mb-3">{BANK_TRANSFER_TIER_REQUIREMENT_COPY}</Text>
          {flowStep === 1 ? (
            <TouchableOpacity
              onPress={handleRecipientContinue}
              disabled={!canContinueRecipient || loading}
              className={`${canContinueRecipient ? 'bg-theme-primary' : 'bg-gray-700'} py-5 rounded-xl`}
            >
              <Text className="text-alt font-semibold text-center">Continue to amount</Text>
            </TouchableOpacity>
          ) : (
            <View>
              <TouchableOpacity
                onPress={handleContinue}
                disabled={!canContinue || loading}
                className={`${canContinue ? 'bg-theme-primary' : 'bg-gray-700'} py-5 rounded-xl`}
              >
                <Text className="text-alt font-semibold text-center">Continue to review</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFlowStep(1)} className="py-4">
                <Text className="text-app-primary text-center">Back to recipient</Text>
              </TouchableOpacity>
            </View>
          )}
          </View>
        </ScrollView>
        </View>
    </KeyboardAvoidingView>
  )
}

export default BankTransferScreen
