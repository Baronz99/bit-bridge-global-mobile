/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import SearchablePicker from '@/components/bankTransfer/SearchablePicker'
import TransactionPinModal from '@/components/TransactionPinModal'
import {
  approveCircleTreasuryPayoutRequest,
  createCircleTreasuryPayoutRequest,
  getCircleTreasuryPayoutRequest,
  getCircleTreasury,
  getCircleWorkspace,
  listCircleTreasuryPayoutRequests,
  rejectCircleTreasuryPayoutRequest,
} from '@/api/circles'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { getBanks, resolveAccountName } from '@/api/account'
import { CircleShell, circleBucketLabel, circleTitle } from '@/components/circles/rebuild'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'
import { useAuth } from '@/services/useAuth'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'
import moneyFormat from '@/utils/moneyFormat'
import HiddenHeaderRecovery from '@/components/navigation/HiddenHeaderRecovery'
import { CIRCLES_FALLBACK_LABEL, CIRCLES_FALLBACK_ROUTE } from '@/components/navigation/recoveryDefaults'

type TreasuryPayoutRequest = Record<string, any>

const inputClass = 'rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4 text-sm text-white'

const statusToneClass = (status: string) => {
  switch (String(status || '').toLowerCase()) {
    case 'completed':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
    case 'approved':
    case 'pending':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-100'
    case 'rejected':
    case 'failed':
      return 'border-red-400/20 bg-red-400/10 text-red-100'
    default:
      return 'border-gray-800 bg-gray-950 text-gray-300'
  }
}

const formatStatus = (status: string) =>
  String(status || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const sanitizeDigits = (value: string) => String(value || '').replace(/\D/g, '')

const CircleTreasuryPayoutsScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { userProfileData } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))

  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [treasury, setTreasury] = useState<Record<string, any> | null>(null)
  const [payouts, setPayouts] = useState<TreasuryPayoutRequest[]>([])
  const [selectedPayout, setSelectedPayout] = useState<TreasuryPayoutRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)
  const [approvalPinModalOpen, setApprovalPinModalOpen] = useState(false)
  const [approvalPinError, setApprovalPinError] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({
    amount_ngn: '',
    beneficiary_name: '',
    beneficiary_account_number: '',
    beneficiary_bank_code: '',
    note: '',
  })
  const [banks, setBanks] = useState<any[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [accountLookupStatus, setAccountLookupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [accountLookupError, setAccountLookupError] = useState('')
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastLookupKeyRef = useRef('')

  const currentRole = String(workspace?.current_user_role || '').toLowerCase()
  const canManage = ['owner', 'admin', 'treasurer'].includes(currentRole)
  const transferSourceReady = treasury?.transfer_source_ready !== false

  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        label: bank?.name || bank?.bank_name || bank?.label || 'Unknown bank',
        value: String(bank?.code || bank?.bank_code || bank?.value || bank?.id || bank?.name || ''),
        data: bank,
      })),
    [banks]
  )

  const selectedBankLabel = useMemo(() => {
    const selected = bankOptions.find((item) => String(item.value) === String(form.beneficiary_bank_code))
    return selected?.label || ''
  }, [bankOptions, form.beneficiary_bank_code])

  const canResolveAccount = useMemo(
    () => sanitizeDigits(form.beneficiary_account_number).length === 10 && Boolean(form.beneficiary_bank_code),
    [form.beneficiary_account_number, form.beneficiary_bank_code]
  )

  const loadPayouts = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const [workspaceResponse, treasuryResponse, payoutsResponse] = await Promise.all([
        getCircleWorkspace(circleId),
        getCircleTreasury(circleId).catch(() => null),
        listCircleTreasuryPayoutRequests(circleId).catch(() => ({ data: [] })),
      ])

      const workspaceData = workspaceResponse || {}
      const treasuryData = treasuryResponse?.data || treasuryResponse || null
      const payoutsData = Array.isArray(payoutsResponse?.data)
        ? payoutsResponse.data
        : Array.isArray(payoutsResponse)
          ? payoutsResponse
          : []

      setWorkspace(workspaceData)
      setTreasury(treasuryData)
      setPayouts(payoutsData)
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Unable to load treasury payouts right now.'
      )
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [circleId])

  const openApprovalGate = useCallback(async () => {
    if (!selectedPayout?.id || !selectedPayout?.available_actions?.can_approve || actionLoading !== null) return

    try {
      const statusResponse = await getTransactionPinStatus()
      const statusPayload = statusResponse?.data ?? statusResponse
      const hasPin = statusPayload?.has_pin === true || statusPayload?.status === 'set' || statusPayload?.pin_set === true
      if (!hasPin) {
        setError('Set a transaction PIN before approving treasury payouts.')
        router.push('/settings/pin/set' as any)
        return
      }
    } catch (requestError: any) {
      if (requestError?.response?.status === 401) return
      setError('Unable to verify transaction PIN status right now.')
      return
    }

    setApprovalPinError(null)
    setApprovalPinModalOpen(true)
  }, [actionLoading, router, selectedPayout?.available_actions?.can_approve, selectedPayout?.id])

  const loadRequestDetail = useCallback(async (payoutRequestId: string) => {
    if (!circleId || !payoutRequestId) return
    setDetailLoading(true)
    setError('')
    try {
      const response = await getCircleTreasuryPayoutRequest(circleId, payoutRequestId)
      setSelectedPayout(response?.data || response || null)
    } catch (requestError: any) {
      setError(
        buildApiErrorMessage({
          status: requestError?.response?.status,
          data: requestError?.response?.data,
          fallback: 'Unable to load treasury payout details right now.',
        })
      )
    } finally {
      setDetailLoading(false)
    }
  }, [circleId])

  useFocusEffect(
    useCallback(() => {
      void loadPayouts(false)
    }, [loadPayouts])
  )

  useEffect(() => {
    let mounted = true
    const loadBanks = async () => {
      setBankLoading(true)
      try {
        const response = await getBanks()
        const raw = Array.isArray(response)
          ? response
          : Array.isArray(response?.data?.banks)
            ? response.data.banks
            : Array.isArray(response?.data?.data)
              ? response.data.data
              : Array.isArray(response?.banks)
                ? response.banks
                : []
        if (mounted) setBanks(raw)
      } catch {
        if (mounted) setBanks([])
      } finally {
        if (mounted) setBankLoading(false)
      }
    }

    void loadBanks()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!canResolveAccount) {
      setAccountLookupStatus('idle')
      setAccountLookupError('')
      return
    }

    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    lookupTimerRef.current = setTimeout(() => {
      const lookupKey = `${form.beneficiary_bank_code}:${sanitizeDigits(form.beneficiary_account_number)}`
      if (lastLookupKeyRef.current === lookupKey && accountLookupStatus === 'success') return

      setAccountLookupStatus('loading')
      setAccountLookupError('')
      resolveAccountName({
        account: {
          bank_code: form.beneficiary_bank_code,
          account_number: sanitizeDigits(form.beneficiary_account_number),
        },
      })
        .then((response) => {
          const accountName = String(response?.account_name || '').trim()
          if (!accountName) {
            setAccountLookupStatus('error')
            setAccountLookupError('Unable to verify this account. Check the bank and account number.')
            return
          }

          setForm((prev) => ({
            ...prev,
            beneficiary_name: accountName,
          }))
          lastLookupKeyRef.current = lookupKey
          setAccountLookupStatus('success')
        })
        .catch(() => {
          setAccountLookupStatus('error')
          setAccountLookupError('Unable to verify this account. Check the bank and account number.')
        })
    }, 550)

    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    }
  }, [accountLookupStatus, canResolveAccount, form.beneficiary_account_number, form.beneficiary_bank_code])

  const formPayload = useMemo(() => ({
    amount_cents: Math.max(0, Math.round(Number(form.amount_ngn || 0) * 100)),
    beneficiary_name: String(form.beneficiary_name || '').trim(),
    beneficiary_account_number: String(form.beneficiary_account_number || '').trim(),
    beneficiary_bank_name: selectedBankLabel,
    beneficiary_bank_code: String(form.beneficiary_bank_code || '').trim(),
    note: String(form.note || '').trim(),
  }), [form, selectedBankLabel])

  const formValid = useMemo(
    () =>
      formPayload.amount_cents > 0 &&
      formPayload.beneficiary_name.length > 0 &&
      formPayload.beneficiary_account_number.length > 0 &&
      formPayload.beneficiary_bank_code.length > 0 &&
      accountLookupStatus === 'success',
    [accountLookupStatus, formPayload]
  )

  const handleCreate = useCallback(async () => {
    if (!circleId || !canManage || submitting) return
    if (!formValid) {
      setError('Complete the payout form before submitting.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setNotice('')
      const response = await createCircleTreasuryPayoutRequest(circleId, formPayload)
      const created = response?.data || response || null
      setNotice(response?.message || 'Treasury payout request created.')
      setForm((prev) => ({ ...prev, note: '' }))
      await loadPayouts(true)
      if (created?.id) {
        await loadRequestDetail(String(created.id))
      }
    } catch (requestError: any) {
      setError(
        buildApiErrorMessage({
          status: requestError?.response?.status,
          data: requestError?.response?.data,
          fallback: 'Unable to create treasury payout right now.',
        })
      )
    } finally {
      setSubmitting(false)
    }
  }, [canManage, circleId, formPayload, formValid, loadPayouts, loadRequestDetail, submitting])

  const submitApproval = useCallback(async (credential: { pin?: string; biometric_approval_token?: string }) => {
    if (!circleId || !selectedPayout?.id) return
    try {
      setActionLoading('approve')
      setError('')
      setNotice('')
      await approveCircleTreasuryPayoutRequest(circleId, selectedPayout.id, credential)
      setNotice('Treasury payout approved.')
      setApprovalPinModalOpen(false)
      await loadPayouts(true)
      await loadRequestDetail(String(selectedPayout.id))
      if (credential.pin) {
        await transactionBiometrics.maybeEnrollAfterPinSuccess(credential.pin).catch(() => null)
      }
    } catch (requestError: any) {
      setError(
        buildApiErrorMessage({
          status: requestError?.response?.status,
          data: requestError?.response?.data,
          fallback: 'Unable to approve treasury payout right now.',
        })
      )
    } finally {
      setActionLoading(null)
    }
  }, [circleId, loadPayouts, loadRequestDetail, selectedPayout?.id, transactionBiometrics])

  const handleApprove = useCallback(async () => {
    await openApprovalGate()
  }, [openApprovalGate])

  const handleReject = useCallback(async () => {
    if (!circleId || !selectedPayout?.id) return
    try {
      setActionLoading('reject')
      setError('')
      setNotice('')
      await rejectCircleTreasuryPayoutRequest(circleId, selectedPayout.id)
      setNotice('Treasury payout rejected.')
      await loadPayouts(true)
      await loadRequestDetail(String(selectedPayout.id))
    } catch (requestError: any) {
      setError(
        buildApiErrorMessage({
          status: requestError?.response?.status,
          data: requestError?.response?.data,
          fallback: 'Unable to reject treasury payout right now.',
        })
      )
    } finally {
      setActionLoading(null)
    }
  }, [circleId, loadPayouts, loadRequestDetail, selectedPayout])

  if (!circleId) {
    return (
      <HiddenHeaderRecovery
        title="Payouts unavailable"
        message="We couldn't open this payout screen from here. Return to your circles list and try again."
        fallbackRoute={CIRCLES_FALLBACK_ROUTE}
        fallbackLabel={CIRCLES_FALLBACK_LABEL}
      />
    )
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712]">
        <ActivityIndicator color="#22d3ee" />
      </View>
    )
  }

  if (error && !workspace) {
    return (
      <HiddenHeaderRecovery
        title="Payouts unavailable"
        message={error}
        fallbackRoute={CIRCLES_FALLBACK_ROUTE}
        fallbackLabel={CIRCLES_FALLBACK_LABEL}
        onRetry={() => loadPayouts(true)}
      />
    )
  }

  if (!workspace) {
    return (
      <HiddenHeaderRecovery
        title="Payouts unavailable"
        message="We could not load this Circle treasury workspace right now."
        fallbackRoute={CIRCLES_FALLBACK_ROUTE}
        fallbackLabel={CIRCLES_FALLBACK_LABEL}
        onRetry={() => loadPayouts(true)}
      />
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CircleShell
        circleId={String(circleId)}
        title={circleTitle(workspace)}
        roleLabel={String(currentRole || 'member').replace(/\b\w/g, (m) => m.toUpperCase())}
        bucketLabel={circleBucketLabel(workspace)}
        active="manage"
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => replaceCircleWorkspaceSection(router, String(circleId), 'treasury')}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 120, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPayouts(true)} />}
        >
          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Circle Treasury</Text>
            <Text className="mt-2 text-lg font-semibold text-white">Treasury payouts</Text>
            <Text className="mt-2 text-sm text-gray-400">
              Create beneficiary payouts from the circle treasury. Each payout charges a fixed company fee and counts toward the daily principal cap.
            </Text>
            <Text className={`mt-3 text-xs font-medium ${transferSourceReady ? 'text-emerald-300' : 'text-amber-300'}`}>
              {transferSourceReady
                ? 'Treasury payout source is ready.'
                : 'Treasury payout source is not ready yet. Approval is blocked until Anchor source mapping is fixed.'}
            </Text>
            <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
              <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Policy</Text>
              <Text className="mt-2 text-sm text-white">Daily principal cap: â‚¦100,000</Text>
              <Text className="mt-1 text-sm text-white">Company charge per payout: â‚¦100</Text>
              <Text className="mt-1 text-xs text-gray-400">Total debit per payout = payout amount + company charge.</Text>
            </View>
            {notice ? (
              <View className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                <Text className="text-sm text-emerald-100">{notice}</Text>
              </View>
            ) : null}
            {error ? (
              <View className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-4">
                <Text className="text-sm text-red-100">{error}</Text>
              </View>
            ) : null}
          </View>

          {canManage ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Create payout</Text>
              <View className="mt-4 gap-4">
                <View>
                  <Text className="mb-2 text-sm text-gray-300">Amount (NGN)</Text>
                  <TextInput
                    value={form.amount_ngn}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, amount_ngn: value }))}
                    placeholder="100"
                    placeholderTextColor="#64748b"
                    className={inputClass}
                    keyboardType="numeric"
                  />
                </View>
                <View>
                  <Text className="mb-2 text-sm text-gray-300">Account number</Text>
                  <TextInput
                    value={form.beneficiary_account_number}
                    onChangeText={(value) => {
                      lastLookupKeyRef.current = ''
                      setAccountLookupStatus('idle')
                      setAccountLookupError('')
                      setForm((prev) => ({ ...prev, beneficiary_account_number: value, beneficiary_name: '' }))
                    }}
                    placeholder="0113096076"
                    placeholderTextColor="#64748b"
                    className={inputClass}
                    keyboardType="numeric"
                  />
                </View>
                <SearchablePicker
                  label="Bank"
                  selectedValue={form.beneficiary_bank_code}
                  options={bankOptions}
                  placeholder={bankLoading ? 'Loading banks...' : 'Select bank'}
                  onSelect={(option) => {
                    lastLookupKeyRef.current = ''
                    setAccountLookupStatus('idle')
                    setAccountLookupError('')
                    setForm((prev) => ({
                      ...prev,
                      beneficiary_bank_code: String(option.value || ''),
                      beneficiary_name: '',
                    }))
                  }}
                />
                {selectedBankLabel ? (
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-3">
                    <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Selected bank</Text>
                    <Text className="mt-1 text-sm text-white">{selectedBankLabel}</Text>
                    <Text className="mt-1 text-xs text-gray-400">Bank code is held internally for the payout rail.</Text>
                  </View>
                ) : null}
                {accountLookupStatus === 'loading' ? (
                  <Text className="text-xs text-amber-300">Verifying account name...</Text>
                ) : accountLookupStatus === 'success' && form.beneficiary_name ? (
                  <Text className="text-xs text-emerald-300">Verified account: {form.beneficiary_name}</Text>
                ) : accountLookupStatus === 'error' ? (
                  <Text className="text-xs text-red-300">{accountLookupError}</Text>
                ) : null}
                <View>
                  <Text className="mb-2 text-sm text-gray-300">Beneficiary name</Text>
                  <TextInput
                    value={form.beneficiary_name}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, beneficiary_name: value }))}
                    placeholder={accountLookupStatus === 'success' ? 'Resolved beneficiary name' : 'Beneficiary name'}
                    placeholderTextColor="#64748b"
                    className={inputClass}
                    editable={accountLookupStatus !== 'success'}
                  />
                </View>
                <View>
                  <Text className="mb-2 text-sm text-gray-300">Note</Text>
                  <TextInput
                    value={form.note}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, note: value }))}
                    placeholder="Payout for supplies"
                    placeholderTextColor="#64748b"
                    className={inputClass}
                    multiline
                  />
                </View>
                <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Review</Text>
                  <Text className="mt-2 text-sm text-white">
                    {formPayload.amount_cents > 0 ? moneyFormat(formPayload.amount_cents / 100) : 'â‚¦0.00'} payout
                  </Text>
                  <Text className="mt-1 text-xs text-gray-400">{formPayload.beneficiary_name || 'Beneficiary name'}</Text>
                  <Text className="mt-1 text-xs text-gray-400">
                    {formPayload.beneficiary_bank_name || 'Bank name'} • {formPayload.beneficiary_account_number || 'Account number'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={submitting || !transferSourceReady}
                  className={`rounded-2xl px-4 py-4 ${submitting || !transferSourceReady ? 'bg-gray-800' : 'bg-cyan-400'}`}
                >
                  <Text className={`text-center text-sm font-semibold ${submitting ? 'text-gray-500' : 'text-slate-950'}`}>
                    {submitting ? 'Submitting…' : transferSourceReady ? 'Create payout request' : 'Treasury source unavailable'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Payout requests</Text>
            {payouts.length === 0 ? (
              <View className="mt-4 rounded-2xl border border-dashed border-gray-800 px-4 py-5">
                <Text className="text-sm text-gray-400">No treasury payouts yet.</Text>
              </View>
            ) : (
              <View className="mt-4 gap-3">
                {payouts.map((request) => {
                  const isSelected = String(selectedPayout?.id || '') === String(request?.id || '')
                  return (
                    <TouchableOpacity
                      key={String(request?.id || request?.reference)}
                      onPress={() => loadRequestDetail(String(request?.id || ''))}
                      className={`rounded-2xl border px-4 py-4 ${isSelected ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-gray-900 bg-gray-950'}`}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-white">{String(request?.beneficiary_name || 'Beneficiary')}</Text>
                          <Text className="mt-1 text-xs text-gray-400">
                            {String(request?.beneficiary_bank_name || 'Bank')} • {String(request?.beneficiary_account_number || 'Account')}
                          </Text>
                          <Text className="mt-2 text-xs text-gray-500">Ref: {String(request?.reference || '--')}</Text>
                        </View>
                        <View className={`rounded-full border px-3 py-1 ${statusToneClass(String(request?.status || 'pending'))}`}>
                          <Text className="text-[10px] font-semibold uppercase tracking-[1.5px]">
                            {formatStatus(String(request?.status || 'pending'))}
                          </Text>
                        </View>
                      </View>
                      <Text className="mt-3 text-sm text-white">{moneyFormat(Number(request?.amount_cents || 0) / 100)}</Text>
                      <Text className="mt-1 text-xs text-gray-400">
                        {String(request?.execution_state || 'pending_approval').replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>

          {detailLoading ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <ActivityIndicator color="#22d3ee" />
            </View>
          ) : selectedPayout ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Selected payout</Text>
              <Text className="mt-2 text-lg font-semibold text-white">{String(selectedPayout.beneficiary_name || 'Beneficiary')}</Text>
              <Text className="mt-1 text-sm text-gray-400">
                {String(selectedPayout.beneficiary_bank_name || 'Bank')} • {String(selectedPayout.beneficiary_account_number || 'Account number')}
              </Text>
              <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Request</Text>
                <Text className="mt-2 text-sm text-white">{String(selectedPayout.reference || '--')}</Text>
                <Text className="mt-2 text-sm text-white">{moneyFormat(Number(selectedPayout.amount_cents || 0) / 100)}</Text>
                <Text className="mt-2 text-xs text-gray-400">Status: {formatStatus(String(selectedPayout.status || 'pending'))}</Text>
                <Text className="mt-1 text-xs text-gray-400">Execution: {String(selectedPayout.execution_state || 'pending_approval').replace(/_/g, ' ')}</Text>
                {selectedPayout.settlement_message ? (
                  <Text className="mt-2 text-xs text-gray-400">{String(selectedPayout.settlement_message)}</Text>
                ) : null}
              </View>

              {selectedPayout.available_actions?.can_approve || selectedPayout.available_actions?.can_reject ? (
                <View className="mt-4 flex-row gap-3">
                  {selectedPayout.available_actions?.can_approve ? (
                    <TouchableOpacity
                      onPress={handleApprove}
                      disabled={actionLoading !== null}
                      className={`flex-1 rounded-2xl px-4 py-4 ${actionLoading === 'approve' ? 'bg-gray-800' : 'bg-emerald-400'}`}
                    >
                      <Text className={`text-center text-sm font-semibold ${actionLoading === 'approve' ? 'text-gray-500' : 'text-slate-950'}`}>
                        {actionLoading === 'approve' ? 'Approving…' : 'Approve with PIN'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {selectedPayout.available_actions?.can_reject ? (
                    <TouchableOpacity
                      onPress={handleReject}
                      disabled={actionLoading !== null}
                      className={`flex-1 rounded-2xl px-4 py-4 ${actionLoading === 'reject' ? 'bg-gray-800' : 'bg-red-500'}`}
                    >
                      <Text className={`text-center text-sm font-semibold ${actionLoading === 'reject' ? 'text-gray-500' : 'text-white'}`}>
                        {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <Text className="mt-4 text-xs text-gray-500">
                  Approval buttons appear only when the backend marks this request as actionable for the current manager.
                </Text>
              )}
            </View>
          ) : null}
        </ScrollView>
        <TransactionPinModal
          open={approvalPinModalOpen}
          onClose={() => setApprovalPinModalOpen(false)}
          onSubmit={(pin) => submitApproval({ pin })}
          onBiometricSubmit={async () => {
            try {
              const approvalToken = await transactionBiometrics.getApprovalToken()
              await submitApproval({ biometric_approval_token: approvalToken })
            } catch (error: any) {
              const message = error?.message || 'Biometric confirmation failed. Use your transaction PIN.'
              setApprovalPinError(message)
            }
          }}
          loading={actionLoading === 'approve'}
          biometricLoading={transactionBiometrics.biometricLoading}
          biometricAvailable={transactionBiometrics.biometricAvailable}
          biometricEnabled={transactionBiometrics.biometricEnabled}
          errorMessage={approvalPinError}
          title="Confirm treasury payout approval"
          helperActionLabel="Forgot PIN? Reset PIN"
          onHelperAction={() => {
            setApprovalPinModalOpen(false)
            router.push('/settings/pin/reset' as any)
          }}
        />
      </CircleShell>
    </>
  )
}

export default CircleTreasuryPayoutsScreen

