import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import TransactionPinModal from '@/components/TransactionPinModal'
import BankPickerSheet from '@/components/bankTransfer/BankPickerSheet'
import RecipientVerificationState from '@/components/bankTransfer/RecipientVerificationState'
import { createBusinessTransfer, getBusinessTransactions } from '@/api/business'
import { getBanks, resolveAccountName } from '@/api/account'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import { getTransferQuoteSnapshot } from '@/services/bankTransfer'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { parseAmountInput } from '@/utils/bankTransfer'
import { useActiveAccount } from '@/services/useActiveAccount'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'

const formatNgn = (value: any) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value || 0))

const sanitizeDigits = (value: string) => String(value || '').replace(/\D/g, '')

const extractCounterPartyId = (payload: any): string => {
  const direct = payload?.counter_party_id || payload?.counterPartyId || payload?.id
  if (direct) return String(direct)
  const nested = payload?.data?.counter_party_id || payload?.data?.counterPartyId || payload?.data?.id
  return nested ? String(nested) : ''
}

const BusinessTransfersScreen = () => {
  const router = useRouter()
  const { activeAccount } = useActiveAccount()
  const { userProfileData } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Record<string, any>[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [recentBankCodes, setRecentBankCodes] = useState<string[]>([])
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quotedFee, setQuotedFee] = useState(0)
  const [quotedFeeBreakdown, setQuotedFeeBreakdown] = useState<{ platform_fee: number; stamp_duty_fee: number; total_fee: number } | null>(null)
  const [flowStep, setFlowStep] = useState<1 | 2>(1)
  const [accountLookupStatus, setAccountLookupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [accountLookupError, setAccountLookupError] = useState<string | null>(null)
  const [form, setForm] = useState({
    bank_code: '',
    bank_name: '',
    account_number: '',
    account_name: '',
    amount: '',
    narration: '',
    counter_party_id: '',
  })

  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null

  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        label: String(bank?.name || bank?.bank_name || bank?.label || 'Unknown bank'),
        value: String(bank?.code || bank?.bank_code || bank?.value || bank?.id || ''),
      })),
    [banks]
  )

  const amountValue = parseAmountInput(form.amount)
  const totalDebit = amountValue + quotedFee
  const canResolve = Boolean(form.bank_code) && sanitizeDigits(form.account_number).length === 10
  const canContinue =
    canResolve &&
    accountLookupStatus === 'success' &&
    amountValue > 0 &&
    String(form.narration || '').trim().length > 0

  const transferItems = useMemo(() => transactions.filter((item) => item?.meta?.transfer_reference), [transactions])

  const loadTransfers = useCallback(async () => {
    if (!businessId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)
    try {
      const [transactionsResponse, bankList] = await Promise.all([
        getBusinessTransactions(businessId, { limit: 40 }),
        getBanks().catch(() => []),
      ])
      const items = Array.isArray(transactionsResponse?.data?.items) ? transactionsResponse.data.items : []
      setTransactions(items)
      setBanks(Array.isArray(bankList) ? bankList : [])
      const recentCodes = items
        .map((item) => String(item?.meta?.bank_code || item?.meta?.beneficiary_bank_code || '').trim())
        .filter(Boolean)
        .slice(0, 4)
      setRecentBankCodes(recentCodes)
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to load business transfers right now.',
      })
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadTransfers()
  }, [loadTransfers])

  useEffect(() => {
    if (!amountValue || amountValue <= 0) {
      setQuotedFee(0)
      setQuotedFeeBreakdown(null)
      return
    }

    let cancelled = false
    setQuoteLoading(true)
    getTransferQuoteSnapshot(amountValue)
      .then((quote) => {
        if (cancelled) return
        setQuotedFee(Number(quote?.fee || 0))
        setQuotedFeeBreakdown({
          platform_fee: Number(quote?.feeBreakdown?.platform_fee ?? quote?.feeBreakdown?.platformFee ?? 0),
          stamp_duty_fee: Number(quote?.feeBreakdown?.stamp_duty_fee ?? quote?.feeBreakdown?.stampDutyFee ?? 0),
          total_fee: Number(quote?.feeBreakdown?.total_fee ?? quote?.fee ?? 0),
        })
      })
      .catch(() => {
        if (cancelled) return
        setQuotedFee(0)
        setQuotedFeeBreakdown(null)
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [amountValue])

  const runResolveAccount = useCallback(async () => {
    if (!canResolve) return
    try {
      setAccountLookupStatus('loading')
      setAccountLookupError(null)
      const response = await resolveAccountName({
        account: {
          account_number: sanitizeDigits(form.account_number),
          bank_code: form.bank_code,
        },
      })
      const accountName = String(response?.account_name || '').trim()
      if (!accountName) {
        setAccountLookupStatus('error')
        setAccountLookupError('Recipient verification failed. Confirm the bank and account number.')
        return
      }
      const counterPartyId = extractCounterPartyId(response)
      setForm((current) => ({
        ...current,
        account_name: accountName,
        counter_party_id: counterPartyId || current.counter_party_id,
      }))
      setAccountLookupStatus('success')
    } catch {
      setAccountLookupStatus('error')
      setAccountLookupError('Recipient verification failed. Confirm the bank and account number.')
    }
  }, [canResolve, form.account_number, form.bank_code])

  useEffect(() => {
    if (!canResolve) {
      setAccountLookupStatus('idle')
      setAccountLookupError(null)
      setForm((current) => ({ ...current, account_name: '', counter_party_id: '' }))
      return
    }

    if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current)
    resolveTimerRef.current = setTimeout(() => {
      void runResolveAccount()
    }, 500)

    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current)
    }
  }, [canResolve, runResolveAccount])

  const handleChange = (field: string, value: string) => {
    if (field === 'account_number') {
      const digits = sanitizeDigits(value).slice(0, 10)
      setForm((current) => ({
        ...current,
        account_number: digits,
        account_name: '',
        counter_party_id: '',
      }))
      return
    }
    if (field === 'amount') {
      setForm((current) => ({ ...current, amount: value }))
      return
    }
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleOpenPin = async () => {
    if (!businessId) return
    if (!canContinue) {
      setErrorMessage('Complete the transfer details and wait for recipient verification before confirming.')
      return
    }

    try {
      const status = await getTransactionPinStatus()
      const payload = status?.data ?? status
      const hasPin =
        payload?.has_pin === true ||
        payload?.status === 'set' ||
        payload?.pin_set === true
      if (!hasPin) {
        setErrorMessage('Set your transaction PIN to continue.')
        router.push('/settings/pin/set' as any)
        return
      }
    } catch (error: any) {
      if (error?.response?.status === 401) return
    }

    setPinError(null)
    setPinModalOpen(true)
  }

  const submitTransfer = async (credential: { transaction_pin?: string; biometric_approval_token?: string }) => {
    if (!businessId) return
    setSubmitting(true)
    setPinError(null)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const response = await createBusinessTransfer(businessId, {
        transfer: {
          amount: amountValue,
          bank: form.bank_name,
          bank_code: form.bank_code,
          account_number: sanitizeDigits(form.account_number),
          account_name: form.account_name,
          narration: String(form.narration || '').trim(),
          counter_party_id: form.counter_party_id || undefined,
          ...(credential.transaction_pin ? { pin: credential.transaction_pin } : {}),
          ...(credential.biometric_approval_token ? { biometric_approval_token: credential.biometric_approval_token } : {}),
        },
      })
      const payload = response?.data || response
      const transferReference = String(payload?.transfer_reference || '').trim()
      setSuccessMessage(payload?.message || 'Business transfer submitted.')
      setPinModalOpen(false)
      setFlowStep(1)
      setForm({
        bank_code: '',
        bank_name: '',
        account_number: '',
        account_name: '',
        amount: '',
        narration: '',
        counter_party_id: '',
      })
      setAccountLookupStatus('idle')
      setAccountLookupError(null)
      if (credential.transaction_pin) {
        await transactionBiometrics.maybeEnrollAfterPinSuccess(credential.transaction_pin).catch(() => null)
      }
      await loadTransfers()
      if (transferReference) {
        router.push(`/business/transfer-status/${encodeURIComponent(transferReference)}` as any)
      }
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to create the business transfer right now.',
      })
      setPinError(message)
      setErrorMessage(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (transactionPin: string) => submitTransfer({ transaction_pin: transactionPin })

  const handleBiometricSubmit = async () => {
    try {
      const approvalToken = await transactionBiometrics.getApprovalToken()
      await submitTransfer({ biometric_approval_token: approvalToken })
    } catch (error: any) {
      const message = error?.message || 'Biometric confirmation failed. Use your transaction PIN.'
      setPinError(message)
      setErrorMessage(message)
    }
  }

  return (
    <ScreenContainer topPadding={20}>
      <View className="rounded-[28px] border border-[#FF7A18]/40 bg-[#151A22] p-5">
        <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">Transfers and receipts</Text>
        <Text className="text-white text-2xl font-semibold mt-3">Business account</Text>
        <Text className="text-gray-300 text-sm mt-2">
          Choose the bank, verify the beneficiary automatically, then review the transfer before confirmation.
        </Text>
      </View>

      {errorMessage ? (
        <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <Text className="text-red-100 text-sm">{errorMessage}</Text>
        </View>
      ) : null}
      {successMessage ? (
        <View className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
          <Text className="text-emerald-100 text-sm">{successMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="py-10 items-center justify-center">
          <ActivityIndicator size="small" color="#FFB05A" />
          <Text className="text-white mt-3">Loading business transfers...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-white text-base font-semibold">
                  {flowStep === 1 ? 'New business transfer' : 'Review business transfer'}
                </Text>
                <Text className="text-gray-400 text-sm mt-2">
                  {flowStep === 1
                    ? 'Select the destination bank, enter the account number, and wait for the beneficiary to be verified.'
                    : 'Check the verified recipient, amount, fees, and narration before you confirm.'}
                </Text>
              </View>
              {flowStep === 2 ? (
                <TouchableOpacity onPress={() => setFlowStep(1)} className="rounded-full border border-gray-700 px-3 py-2">
                  <Text className="text-gray-200 text-xs">Edit</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {flowStep === 1 ? (
              <>
                <View className="mt-5">
                  <BankPickerSheet
                    selectedValue={form.bank_code}
                    options={bankOptions}
                    recentValues={recentBankCodes}
                    onSelect={(option) => {
                      setForm((current) => ({
                        ...current,
                        bank_code: option.value,
                        bank_name: option.label,
                        account_name: '',
                        counter_party_id: '',
                      }))
                      setAccountLookupStatus('idle')
                      setAccountLookupError(null)
                    }}
                  />
                </View>

                <View className="mt-4">
                  <Text className="text-gray-400 text-xs">Account number</Text>
                  <TextInput
                    value={form.account_number}
                    onChangeText={(value) => handleChange('account_number', value)}
                    keyboardType="numeric"
                    placeholder="Enter 10-digit account number"
                    placeholderTextColor="#6B7280"
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                  />
                </View>

                <RecipientVerificationState
                  status={accountLookupStatus}
                  accountName={form.account_name}
                  bankName={form.bank_name}
                  accountNumber={form.account_number}
                  error={accountLookupError}
                />

                <View className="mt-4">
                  <Text className="text-gray-400 text-xs">Amount (NGN)</Text>
                  <TextInput
                    value={form.amount}
                    onChangeText={(value) => handleChange('amount', value)}
                    keyboardType="numeric"
                    placeholder="Enter transfer amount"
                    placeholderTextColor="#6B7280"
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                  />
                </View>

                <View className="mt-4">
                  <Text className="text-gray-400 text-xs">Narration</Text>
                  <TextInput
                    value={form.narration}
                    onChangeText={(value) => handleChange('narration', value)}
                    placeholder="What is this payment for?"
                    placeholderTextColor="#6B7280"
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                  />
                </View>

                <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                  <Text className="text-gray-400 text-xs">Estimated total debit</Text>
                  <Text className="text-white text-lg font-semibold mt-2">
                    {quoteLoading ? 'Calculating...' : formatNgn(totalDebit)}
                  </Text>
                  <Text className="text-gray-500 text-xs mt-2">
                    Amount {formatNgn(amountValue)} {quotedFee > 0 ? `+ fee ${formatNgn(quotedFee)}` : ''}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setFlowStep(2)}
                  disabled={!canContinue}
                  className={`mt-6 rounded-2xl px-4 py-4 items-center ${canContinue ? 'bg-[#FFB05A]' : 'bg-gray-700'}`}
                >
                  <Text className={`text-sm font-semibold ${canContinue ? 'text-black' : 'text-gray-300'}`}>
                    Continue to review
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                  <Text className="text-gray-400 text-xs">Verified recipient</Text>
                  <Text className="text-white text-base font-semibold mt-2">{form.account_name || 'Not verified'}</Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    {form.bank_name || 'Bank'} • {sanitizeDigits(form.account_number)}
                  </Text>
                </View>

                <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                  <Text className="text-gray-400 text-xs">Transfer amount</Text>
                  <Text className="text-white text-2xl font-semibold mt-2">{formatNgn(amountValue)}</Text>
                  <View className="mt-4 gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-gray-400 text-sm">Transfer fee</Text>
                      <Text className="text-white text-sm">{formatNgn(quotedFee)}</Text>
                    </View>
                    {quotedFeeBreakdown?.stamp_duty_fee ? (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-gray-500 text-xs">Stamp duty</Text>
                        <Text className="text-gray-300 text-xs">{formatNgn(quotedFeeBreakdown.stamp_duty_fee)}</Text>
                      </View>
                    ) : null}
                    <View className="flex-row items-center justify-between">
                      <Text className="text-gray-400 text-sm">Total debit</Text>
                      <Text className="text-white text-sm font-semibold">{formatNgn(totalDebit)}</Text>
                    </View>
                  </View>
                </View>

                <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                  <Text className="text-gray-400 text-xs">Narration</Text>
                  <Text className="text-white text-sm mt-2">{String(form.narration || '').trim() || 'Not provided'}</Text>
                </View>

                <TouchableOpacity onPress={handleOpenPin} disabled={submitting || !canContinue} className="mt-6 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
                  {submitting ? <ActivityIndicator size="small" color="#111827" /> : <Text className="text-black text-sm font-semibold">Confirm and enter PIN</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Recent transfer activity</Text>
            <View className="mt-4 gap-3">
              {transferItems.length ? transferItems.map((item) => (
                <TouchableOpacity key={String(item.id)} onPress={() => router.push(`/business/transfer-status/${encodeURIComponent(String(item?.meta?.transfer_reference || item.id))}` as any)} className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                  <Text className="text-white text-sm font-semibold">{item.label || 'Business transfer'}</Text>
                  <Text className="text-gray-300 text-sm mt-1">{formatNgn((Number(item?.amount_cents || 0) || 0) / 100)}</Text>
                  <Text className="text-gray-400 text-xs mt-1">{item?.meta?.status_label || item?.status || 'posted'}</Text>
                  <Text className="text-gray-500 text-xs mt-2">{item?.meta?.transfer_reference || 'Pending reference'}</Text>
                </TouchableOpacity>
              )) : (
                <Text className="text-gray-400 text-sm">No business transfer activity yet.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}

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
        title="Confirm business transfer"
        helperActionLabel="Forgot PIN? Reset PIN"
        onHelperAction={() => {
          setPinModalOpen(false)
          router.push('/settings/pin/reset' as any)
        }}
      />
    </ScreenContainer>
  )
}

export default BusinessTransfersScreen
