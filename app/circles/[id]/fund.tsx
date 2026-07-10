import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import CompletionPanel from '@/components/finance/CompletionPanel'
import FinancialSummaryCard from '@/components/finance/FinancialSummaryCard'
import { paymentItemIdentityLabel } from '@/components/circles/rebuild'
import { fundCircle, getCircle, getCirclePaymentItems, quoteCircleDuePlan } from '@/api/circles'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import moneyFormat from '@/utils/moneyFormat'
import { backOrFallback, normalizeRouteParam } from '@/utils/navigationRecovery'
import { error as logError, log } from '@/utils/logger'
import ScreenContainer from '@/components/ScreenContainer'

type NoticeState = { message: string | null; error: boolean; data: any | null }
type PaymentItemRecord = Record<string, any>

const getTierRank = (value: unknown) => {
  const normalized = String(value || 'tier_0').toLowerCase()
  if (normalized.includes('tier_4')) return 4
  if (normalized.includes('tier_3')) return 3
  if (normalized.includes('tier_2')) return 2
  if (normalized.includes('tier_1')) return 1
  return 0
}

const formatTime = (value?: string) => {
  if (!value) return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const cadenceUnit = (cadence?: string) => {
  switch (String(cadence || 'monthly').toLowerCase()) {
    case 'weekly':
      return 'week'
    case 'yearly':
      return 'year'
    default:
      return 'month'
  }
}

const formatPeriodCountLabel = (count: number, cadence?: string) => {
  const total = Math.max(Number(count || 0), 0)
  const unit = cadenceUnit(cadence)
  return `${total} ${unit}${total === 1 ? '' : 's'}`
}

const paymentPurposeLabel = (item?: PaymentItemRecord | null) => {
  const title = String(item?.title || '').trim()
  const normalizedType = String(item?.type || '').toLowerCase()
  const checkoutMode = String(item?.payment_item_kind || item?.checkout_mode || item?.item_type || '').toLowerCase()

  if (item?.linked_reference_type === 'CircleDuePlan' || normalizedType === 'dues' || checkoutMode === 'recurring') return 'dues'
  if (normalizedType === 'treasury_topup' || item?.support_fallback) return 'shared fund'
  if (/fine|penalt/i.test(title)) return 'fine'
  if (/event|goal|collection/i.test(title)) return 'collection'
  if (/support|special|one[- ]off|emergency|welfare|contribution/i.test(title)) return 'collection'
  return 'contribution'
}

const paymentTypeLabel = (item?: PaymentItemRecord | null) => {
  const purpose = paymentPurposeLabel(item)
  if (purpose === 'dues') return 'Dues'
  if (purpose === 'fine') return 'Fine'
  if (purpose === 'collection') return 'Collection'
  if (purpose === 'shared fund') return 'Shared Fund'
  return 'Money option'
}

const getPaymentItemActivityId = (item?: PaymentItemRecord | null) => {
  const activityId = String(item?.activity_id || '').trim()
  if (activityId) return activityId
  if (String(item?.linked_reference_type || '').trim() === 'CircleActivity') {
    return String(item?.linked_reference_id || '').trim()
  }
  return ''
}

const CircleFundScreen = () => {
  const { id, dueId, dueAmountCents, dueMode: dueModeParam, dueMonthsOpen: dueMonthsOpenParam, paymentItemKey: paymentItemKeyParam } = useLocalSearchParams<{
    id?: string | string[]
    dueId?: string | string[]
    dueAmountCents?: string | string[]
    dueMode?: string | string[]
    dueMonthsOpen?: string | string[]
    paymentItemKey?: string | string[]
  }>()
  const circleId = normalizeRouteParam(id)
  const dueObligationId = normalizeRouteParam(dueId)
  const prefetchedDueAmountCents = Number(Array.isArray(dueAmountCents) ? dueAmountCents[0] : dueAmountCents || 0)
  const dueMode = normalizeRouteParam(dueModeParam)
  const dueMonthsOpen = Number(Array.isArray(dueMonthsOpenParam) ? dueMonthsOpenParam[0] : dueMonthsOpenParam || 1)
  const preselectedPaymentItemKey = normalizeRouteParam(paymentItemKeyParam)
  const isMonthlyDueFlow = dueMode === 'monthly' || !!dueObligationId
  const router = useRouter()
  const { userProfileData } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))
  const [loading, setLoading] = useState(false)
  const [circle, setCircle] = useState<Record<string, any> | null>(null)
  const [dueQuoteLoading, setDueQuoteLoading] = useState(false)
  const [dueMonths, setDueMonths] = useState(1)
  const [dueQuote, setDueQuote] = useState<Record<string, any> | null>(null)
  const [paymentItems, setPaymentItems] = useState<PaymentItemRecord[]>([])
  const [paymentItemsLoading, setPaymentItemsLoading] = useState(false)
  const [selectedPaymentItemKey, setSelectedPaymentItemKey] = useState('')
  const [selectedSource, setSelectedSource] = useState('personal_wallet')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    amount: prefetchedDueAmountCents > 0 ? String(prefetchedDueAmountCents / 100) : '',
    description: '',
  })
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })

  useEffect(() => {
    if (!circleId) return
    getCircle(circleId)
      .then((payload) => setCircle(((payload?.data ?? payload) as Record<string, any>) || null))
      .catch(() => {})
  }, [circleId])

  useEffect(() => {
    if (!circleId || isMonthlyDueFlow) return

    let cancelled = false
    setPaymentItemsLoading(true)
    getCirclePaymentItems(circleId)
      .then((payload) => {
        if (cancelled) return
        const items = Array.isArray(payload?.data ?? payload) ? (payload?.data ?? payload) : []
        setPaymentItems(items)
        if (preselectedPaymentItemKey) {
          const matched = items.find((item: PaymentItemRecord) => String(item?.key || item?.id || '') === String(preselectedPaymentItemKey))
          if (matched) {
            setSelectedPaymentItemKey(String(matched.key || matched.id || ''))
          }
        }
      })
      .catch(() => {
        if (!cancelled) setPaymentItems([])
      })
      .finally(() => {
        if (!cancelled) setPaymentItemsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [circleId, isMonthlyDueFlow, preselectedPaymentItemKey])

  const selectedPaymentItem = useMemo(
    () => paymentItems.find((item) => String(item.key || item.id || '') === String(selectedPaymentItemKey || '')) || null,
    [paymentItems, selectedPaymentItemKey]
  )
  const selectedPaymentItemIdentity = paymentItemIdentityLabel(selectedPaymentItem)
  const selectedPaymentItemType = String(selectedPaymentItem?.type || selectedPaymentItem?.item_type || '').toLowerCase()
  const selectedIsDueItem =
    selectedPaymentItem?.linked_reference_type === 'CircleDuePlan' ||
    selectedPaymentItemType === 'dues' ||
    (selectedPaymentItem?.checkout_mode === 'recurring' && selectedPaymentItem?.linked_reference_type === 'CircleDuePlan')
  const selectedIsQuantityItem = selectedPaymentItemType === 'quantity'
  const activePaymentItem = isMonthlyDueFlow ? null : selectedPaymentItem
  const activePaymentItemActivityId = getPaymentItemActivityId(activePaymentItem)
  const activeDueMonthsOpen = isMonthlyDueFlow
    ? Math.max(dueMonthsOpen || 1, 1)
    : Math.max(Number(selectedPaymentItem?.payable_periods_count || 1), 1)
  const recurringMonthChoices = [1, 3, 6, 12].filter((value) => value <= Math.max(activeDueMonthsOpen, value))
  const activeDueLabel = String(selectedPaymentItem?.title || 'Dues').trim()
  const activeDueCadence = String(selectedPaymentItem?.cadence || circle?.monthly_due_plan?.cadence || 'monthly').trim()
  const itemPickerVisible = !isMonthlyDueFlow && !selectedPaymentItem

  useEffect(() => {
    if (!(isMonthlyDueFlow || selectedIsDueItem)) return
    setDueMonths(Math.max(1, Math.min(activeDueMonthsOpen || 1, 12)))
  }, [activeDueMonthsOpen, isMonthlyDueFlow, selectedIsDueItem])

  useEffect(() => {
    if (!circleId || !(isMonthlyDueFlow || selectedIsDueItem)) return

    let cancelled = false
    setDueQuoteLoading(true)
    quoteCircleDuePlan(circleId, { periods_count: dueMonths })
      .then((payload) => {
        if (cancelled) return
        const data = (payload?.data ?? payload) as Record<string, any>
        setDueQuote(data)
        const totalAmount = Number(data?.total_amount || 0)
        setFormData((current) => ({
          ...current,
          amount: totalAmount > 0 ? String(totalAmount) : current.amount,
        }))
      })
      .catch((error: any) => {
        if (cancelled) return
        setDueQuote(null)
        const message = buildApiErrorMessage({
          status: error?.response?.status,
          data: error?.response?.data,
          fallback: 'Unable to calculate the due total right now.',
        })
        setNotice({ message, error: true, data: null })
      })
      .finally(() => {
        if (!cancelled) setDueQuoteLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [circleId, dueMonths, isMonthlyDueFlow, selectedIsDueItem])

  const profileRoot = (userProfileData?.data ?? userProfileData) || {}
  const tierRank = getTierRank(profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level)
  const isTier1User = tierRank === 1
  const isStandardCircle = circle?.circle_type !== 'official'
  const isFlexibleOfficial = circle?.circle_type === 'official' && circle?.kyc_mode === 'flexible'
  const maxContributionCents = Number(circle?.max_contribution_cents || 0)
  const standardDailyCapCents = 10000000
  const selectedQuantityUnitPriceCents = Number(
    selectedPaymentItem?.unit_price_cents || selectedPaymentItem?.amount_cents || selectedPaymentItem?.suggested_amount_cents || 0
  )
  const [quantity, setQuantity] = useState(1)
  const manualAmountCents = useMemo(
    () => Math.round(Number(String(formData.amount).replace(/[^0-9.]/g, '')) * 100) || 0,
    [formData.amount]
  )
  const quotedAmountCents = Number(dueQuote?.total_amount_cents || 0)
  const quantityAmountCents = selectedIsQuantityItem ? selectedQuantityUnitPriceCents * Math.max(quantity, 1) : 0
  const amountCents =
    (isMonthlyDueFlow || selectedIsDueItem) && quotedAmountCents > 0
      ? quotedAmountCents
      : selectedIsQuantityItem
        ? quantityAmountCents
        : manualAmountCents
  const overCap = isFlexibleOfficial && isTier1User && maxContributionCents > 0 && amountCents > maxContributionCents
  const quotedObligationIds = Array.isArray(dueQuote?.obligation_ids) ? dueQuote?.obligation_ids : []
  const coveredPeriods = Array.isArray(dueQuote?.covered_periods) ? dueQuote?.covered_periods : []
  const coveredPeriodKeys = Array.isArray(dueQuote?.covered_period_keys) ? dueQuote?.covered_period_keys : []
  const coveredStart = String(dueQuote?.covered_due_range?.start || '')
  const coveredEnd = String(dueQuote?.covered_due_range?.end || '')
  const circleName = String(circle?.name || circle?.circle_name || 'Circle').trim()
  const successData = (notice.data && !notice.error ? notice.data : null) as Record<string, any> | null
  const successReference = String(successData?.reference || successData?.transaction_reference || successData?.transfer_reference || '').trim()
  const successTimestamp = String(successData?.created_at || successData?.occurred_at || '').trim()
  const successStatus = String(successData?.status || 'successful').trim()
  const selectedItemTitle = isMonthlyDueFlow ? activeDueLabel : String(activePaymentItem?.title || 'Shared Fund').trim()
  const selectedItemTypeLabel = isMonthlyDueFlow || selectedIsDueItem ? 'Dues' : paymentTypeLabel(activePaymentItem)
  const ctaLabel =
    isMonthlyDueFlow || selectedIsDueItem
      ? `Pay ${formatPeriodCountLabel(dueMonths, activeDueCadence)} dues`
      : paymentPurposeLabel(activePaymentItem) === 'fine'
        ? 'Pay fine'
        : paymentPurposeLabel(activePaymentItem) === 'collection'
          ? 'Contribute to Collection'
          : paymentPurposeLabel(activePaymentItem) === 'shared fund'
            ? 'Add to Shared Fund'
            : 'Pay now'
  const sourceWalletBalanceValue = Number(profileRoot?.wallet?.available_balance ?? profileRoot?.wallet?.balance ?? 0)
  const sourceWalletBalanceLabel = profileRoot?.wallet
    ? moneyFormat(Number.isFinite(sourceWalletBalanceValue) ? sourceWalletBalanceValue : 0)
    : '--'
  const sourceOptions = [
    {
      label: profileRoot?.wallet
        ? `Personal wallet · ${sourceWalletBalanceLabel} available`
        : 'Personal wallet',
      value: 'personal_wallet',
    },
  ]
  const selectedSourceLabel = sourceOptions.find((option) => option.value === selectedSource)?.label || 'Personal wallet'
  const paymentsFallbackRoute = circleId ? `/circles/${circleId}/pay` : '/circles'

  useEffect(() => {
    if (!selectedIsQuantityItem) return
    setQuantity(1)
    if (selectedQuantityUnitPriceCents > 0) {
      setFormData((current) => ({
        ...current,
        amount: String(selectedQuantityUnitPriceCents / 100),
      }))
    }
  }, [selectedIsQuantityItem, selectedPaymentItemKey, selectedQuantityUnitPriceCents])

  useEffect(() => {
    if (!selectedIsQuantityItem) return
    if (quantityAmountCents > 0) {
      setFormData((current) => ({
        ...current,
        amount: String(quantityAmountCents / 100),
      }))
    }
  }, [quantityAmountCents, selectedIsQuantityItem])

  useEffect(() => {
    if (isMonthlyDueFlow || !selectedPaymentItem) return

    if (String(selectedPaymentItem?.checkout_mode || '').toLowerCase() === 'quantity') {
      setQuantity(1)
      const unitPrice = Number(
        selectedPaymentItem?.unit_price_cents || selectedPaymentItem?.amount_cents || selectedPaymentItem?.suggested_amount_cents || 0
      )
      setFormData((current) => ({
        ...current,
        amount: unitPrice > 0 ? String(unitPrice / 100) : '',
      }))
      return
    }

    if (Number(selectedPaymentItem?.amount_cents || 0) > 0 && selectedPaymentItem?.checkout_mode === 'fixed') {
      setFormData((current) => ({
        ...current,
        amount: String(Number(selectedPaymentItem.amount_cents) / 100),
      }))
      return
    }

    if (Number(selectedPaymentItem?.suggested_amount_cents || 0) > 0) {
      setFormData((current) => ({
        ...current,
        amount: current.amount || String(Number(selectedPaymentItem.suggested_amount_cents) / 100),
      }))
    }
  }, [isMonthlyDueFlow, selectedPaymentItem, selectedPaymentItemKey])

  const handleSelectPaymentItem = (item: PaymentItemRecord) => {
    setSelectedPaymentItemKey(String(item.key || item.id || ''))
    setNotice({ message: null, error: false, data: null })
    if (String(item?.checkout_mode || '').toLowerCase() === 'quantity') {
      setQuantity(1)
      const unitPrice = Number(item?.unit_price_cents || item?.amount_cents || item?.suggested_amount_cents || 0)
      setFormData((current) => ({
        ...current,
        amount: unitPrice > 0 ? String(unitPrice / 100) : '',
      }))
      return
    }
    if (Number(item?.amount_cents || 0) > 0 && item?.checkout_mode === 'fixed') {
      setFormData((current) => ({
        ...current,
        amount: String(Number(item.amount_cents) / 100),
      }))
      return
    }
    setFormData((current) => ({
      ...current,
      amount: '',
    }))
  }

  const handleOpenPin = async () => {
    const amountValue = amountCents / 100
    if (!circleId) {
      setNotice({ message: 'Missing circle ID.', error: true, data: null })
      return
    }
    if (!isMonthlyDueFlow && !selectedPaymentItem) {
      setNotice({ message: 'Select a money option first.', error: true, data: null })
      return
    }
    if ((isMonthlyDueFlow || selectedIsDueItem) && quotedObligationIds.length === 0) {
      setNotice({ message: 'Unable to load the due total right now.', error: true, data: null })
      return
    }
    if (selectedIsQuantityItem && (!quantity || quantity < 1)) {
      setNotice({ message: 'Enter a valid quantity.', error: true, data: null })
      return
    }
    if (!amountValue || Number.isNaN(amountValue)) {
      setNotice({ message: 'Amount is required.', error: true, data: null })
      return
    }
    if (overCap) {
      setNotice({ message: 'Complete verification to contribute above your current limit.', error: true, data: null })
      return
    }

    try {
      const status = await getTransactionPinStatus()
      const payload = status?.data ?? status
      const hasPin = payload?.has_pin === true || payload?.status === 'set' || payload?.pin_set === true
      if (!hasPin) {
        setNotice({ message: 'Set your transaction PIN to continue.', error: true, data: null })
        router.push('/settings/pin/set')
        return
      }
    } catch (error: any) {
      const statusCode = error?.response?.status
      if (statusCode === 401) return
    }

    setPinError(null)
    setPinModalOpen(true)
  }

  const submitFunding = async (credential: { transaction_pin?: string; biometric_approval_token?: string }) => {
    const amountValue = amountCents / 100
    if (!circleId || !amountValue || Number.isNaN(amountValue)) {
      setNotice({ message: 'Amount is required.', error: true, data: null })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await fundCircle(circleId, {
        amount_cents: amountCents,
        note: formData.description.trim() || undefined,
        circle_due_obligation_id: !isMonthlyDueFlow && !selectedIsDueItem ? dueObligationId || undefined : undefined,
        circle_due_obligation_ids: isMonthlyDueFlow || selectedIsDueItem ? quotedObligationIds : undefined,
        circle_activity_id: activePaymentItemActivityId || undefined,
        payment_item_quantity: selectedIsQuantityItem ? quantity : undefined,
        payment_item_unit_price_cents: selectedIsQuantityItem ? selectedQuantityUnitPriceCents : undefined,
        payment_purpose:
          activePaymentItem?.type === 'activity_goal'
            ? 'activity_goal'
            : activePaymentItem?.type === 'treasury_topup'
              ? 'treasury_topup'
              : (isMonthlyDueFlow || selectedIsDueItem)
                ? 'dues'
                : undefined,
        payment_item_title: selectedItemTitle || undefined,
        ...credential,
      })
      const payload: any = response
      setPinModalOpen(false)
      setFormData({ amount: '', description: '' })
      setDueQuote(null)
      setNotice({ message: payload?.message || 'Circle funded successfully.', error: false, data: payload?.data || null })
      if (credential.transaction_pin) {
        log('[CIRCLE_FUND][BIOMETRIC] enrollment:begin_after_success')
        try {
          const enrollmentResult = await transactionBiometrics.maybeEnrollAfterPinSuccess(credential.transaction_pin)
          log('[CIRCLE_FUND][BIOMETRIC] enrollment:completed_after_success', enrollmentResult)
          if (enrollmentResult.status === 'enrolled') {
            setNotice({
              message: 'Circle funded successfully. Face ID / Fingerprint is now enabled for future transfer confirmations on this device.',
              error: false,
              data: payload?.data || null,
            })
          } else if (enrollmentResult.status === 'skipped') {
            setNotice({
              message: 'Circle funded successfully. Set up device biometrics to enable faster transfer confirmations next time.',
              error: false,
              data: payload?.data || null,
            })
          }
        } catch (enrollmentError: any) {
          logError('[CIRCLE_FUND][BIOMETRIC] enrollment:failed_after_success', enrollmentError)
          setNotice({
            message:
              enrollmentError?.message ||
              'Circle funding succeeded, but biometric confirmation could not be enabled on this device yet.',
            error: true,
            data: null,
          })
        }
      }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) return

      const errors = error?.response?.data?.errors
      const messageFromErrors =
        Array.isArray(errors) && errors.length > 0 ? errors.join('\n') : typeof errors === 'string' ? errors : error?.response?.data?.message

      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: messageFromErrors || error?.message || 'Something went wrong',
      })

      setPinError(message)
      setNotice({ message, error: true, data: null })
      Alert.alert('Payment failed', message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (transactionPin: string) => submitFunding({ transaction_pin: transactionPin })

  const handleBiometricSubmit = async () => {
    try {
      const approvalToken = await transactionBiometrics.getApprovalToken()
      await submitFunding({ biometric_approval_token: approvalToken })
    } catch (error: any) {
      const message = error?.message || 'Biometric confirmation failed. Use your transaction PIN.'
      setPinError(message)
      setNotice({ message, error: true, data: null })
    }
  }

  const preflightRows = [
    { label: 'Circle', value: circleName, emphasis: true },
    { label: 'Payment', value: selectedItemTitle || '--' },
    !isMonthlyDueFlow && selectedPaymentItemIdentity ? { label: 'Item', value: selectedPaymentItemIdentity } : null,
    { label: 'Source', value: selectedSourceLabel },
    { label: 'You pay', value: amountCents > 0 ? moneyFormat(amountCents / 100) : '--' },
    selectedIsQuantityItem ? { label: 'Quantity', value: String(quantity) } : null,
    selectedIsQuantityItem ? { label: 'Unit price', value: moneyFormat(selectedQuantityUnitPriceCents / 100) } : null,
    (isMonthlyDueFlow || selectedIsDueItem) ? { label: 'Covered periods', value: quotedObligationIds.length > 0 ? String(quotedObligationIds.length) : '--' } : null,
    coveredPeriods.length > 0 ? { label: 'Coverage', value: coveredStart === coveredEnd ? coveredStart : `${coveredStart} to ${coveredEnd}` } : null,
    formData.description.trim() ? { label: 'Note', value: formData.description.trim() } : null,
  ].filter(Boolean) as { label: string; value: string; emphasis?: boolean }[]

  const completionRows = [
    { label: 'Circle', value: circleName, emphasis: true },
    { label: 'Payment', value: selectedItemTitle || '--' },
    { label: 'Source', value: selectedSourceLabel },
    { label: 'Amount paid', value: amountCents > 0 ? moneyFormat(amountCents / 100) : '--' },
    selectedIsQuantityItem ? { label: 'Quantity', value: String(quantity) } : null,
    { label: 'Payment type', value: selectedItemTypeLabel || '--' },
    !isMonthlyDueFlow && selectedPaymentItemIdentity ? { label: 'Item', value: selectedPaymentItemIdentity } : null,
    successReference ? { label: 'Transaction ID', value: successReference, mono: true } : null,
    successTimestamp ? { label: 'Timestamp', value: formatTime(successTimestamp) } : null,
    { label: 'Status', value: successStatus || 'successful' },
  ].filter(Boolean) as { label: string; value: string; emphasis?: boolean; mono?: boolean }[]

  const isSuccessState = Boolean(successData)

  return (
    <ScreenContainer
      scroll={false}
      includeTopInset
      includeTabBarPadding={false}
      horizontalPadding={16}
      topPadding={16}
      bottomPadding={16}
      className="flex-1 bg-primary"
    >
      <KeyboardAvoidWrapper>
        <View className="flex-1 gap-4">
          <TouchableOpacity accessibilityLabel="Back to Payments" onPress={() => backOrFallback(router, paymentsFallbackRoute)} className="self-start rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
            <Text className="text-white text-[11px] font-semibold">Back to Payments</Text>
          </TouchableOpacity>
          {isSuccessState ? (
            <CompletionPanel
              eyebrow="Money"
              title="Payment completed"
              supportingText={notice.message || 'Your payment has been recorded.'}
              primaryLabel="Circle received"
              primaryValue={amountCents > 0 ? moneyFormat(amountCents / 100) : '--'}
              statusLabel="Successful"
              statusTone="success"
              summaryTitle="Payment receipt"
              summaryRows={completionRows}
              primaryActionLabel={successReference ? 'View proof' : 'Done'}
              onPrimaryAction={() => {
                if (successReference) {
                  router.push({ pathname: '/transaction/receipt', params: { reference: successReference } } as any)
                  return
                }
                router.replace(`/circles/${circleId}` as any)
              }}
              secondaryActionLabel="Back to circle"
              onSecondaryAction={() => router.replace(`/circles/${circleId}` as any)}
            />
          ) : (
            <>
              <View className="rounded-[30px] bg-[#0F1115] px-5 py-5 border border-white/6">
                <Text className="text-[#D49A3A] text-[10px] uppercase tracking-[3px]">Money</Text>
                <Text className="text-white text-[28px] font-semibold mt-2">Pay into {circleName}</Text>
                {!itemPickerVisible ? (
                  <Text className="text-[#A9AFB8] text-[13px] leading-5 mt-2">
                    {(isMonthlyDueFlow || selectedIsDueItem)
                      ? 'Choose periods, review the total, and confirm.'
                      : `Review this ${selectedItemTypeLabel.toLowerCase()} and confirm.`}
                  </Text>
                ) : null}
              </View>

              {itemPickerVisible ? (
                <View className="rounded-[24px] bg-[#16181D] px-4 py-4 border border-white/6">
                  <Text className="text-white text-base font-semibold">Ways to pay</Text>
                  {paymentItemsLoading ? (
                    <Text className="text-[#A9AFB8] text-xs mt-3">Loading items...</Text>
                  ) : paymentItems.length === 0 ? (
                    <Text className="text-[#A9AFB8] text-xs mt-3">No money options are open right now.</Text>
                  ) : (
                    <View className="mt-3 gap-3">
                      {paymentItems.map((item) => (
                        <TouchableOpacity
                          key={String(item.key || item.id)}
                          onPress={() => handleSelectPaymentItem(item)}
                          className="rounded-[20px] border border-white/8 bg-[#0F1115] px-4 py-4"
                        >
                          <View className="flex-row items-center justify-between gap-3">
                            <View className="flex-1">
                              <Text className="text-white text-sm font-semibold">{String(item.title || 'Money option')}</Text>
                              <Text className="text-[#A9AFB8] text-[11px] mt-1">
                                {String(item.checkout_mode === 'recurring'
                                  ? 'Recurring'
                                  : item.checkout_mode === 'quantity'
                                    ? 'Quantity'
                                    : item.checkout_mode === 'fixed'
                                      ? 'Fixed'
                                      : item.type === 'treasury_topup'
                                        ? 'Optional'
                                        : 'Open'
                                )}{item.due_on ? ` · Next ${formatTime(String(item.due_on))}` : ''}
                              </Text>
                              {paymentItemIdentityLabel(item) ? (
                                <Text className="text-[#7B8391] text-[11px] mt-1">{paymentItemIdentityLabel(item)}</Text>
                              ) : null}
                            </View>
                            <View className="items-end">
                              <View className="rounded-full border border-white/10 bg-white/5 px-2 py-1 mb-2">
                                <Text className="text-[10px] text-white">
                                  {String(
                                    item.status === 'overdue' || item.status === 'payable_overdue'
                                      ? 'Overdue'
                                      : item.is_payable_now
                                        ? 'Due now'
                                        : item.status === 'current' || item.status === 'paid' || item.status === 'configured'
                                          ? 'Paid up'
                                          : item.type === 'treasury_topup' || item.required === false
                                            ? 'Optional'
                                            : 'Upcoming'
                                  )}
                                </Text>
                              </View>
                              <Text className="text-white text-sm font-semibold">
                                {item.amount_cents !== null && item.amount_cents !== undefined ? moneyFormat(Number(item.amount_cents) / 100) : 'Open'}
                              </Text>
                              <View className="mt-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                                <Text className="text-white text-[11px] font-semibold">
                                  {item.support_fallback ? 'Add to Shared Fund' : item.is_payable_now === false ? 'Review' : 'Open'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}

              {!itemPickerVisible ? (
                <>
              {!isMonthlyDueFlow && selectedPaymentItem ? (
                <TouchableOpacity
                  onPress={() => setSelectedPaymentItemKey('')}
                  className="self-start rounded-full border border-white/10 bg-white/5 px-4 py-2"
                >
                  <Text className="text-white text-[11px] font-semibold">Choose another option</Text>
                </TouchableOpacity>
              ) : null}

              {circle?.circle_type === 'official' ? (
                <View className="rounded-[24px] bg-[#16181D] px-4 py-4 border border-amber-500/20">
                  <Text className="text-amber-200 text-[10px] uppercase tracking-[2px]">Official BitBridge Circle</Text>
                  {circle?.badge_label ? <Text className="text-white text-sm font-semibold mt-2">{String(circle.badge_label)}</Text> : null}
                </View>
              ) : null}

              {(isMonthlyDueFlow || selectedIsDueItem) ? (
                <View className="rounded-[24px] bg-[#16181D] px-4 py-4 border border-sky-500/20">
                  <Text className="text-sky-200 text-[10px] uppercase tracking-[2px]">Dues</Text>
                  {dueQuoteLoading ? (
                    <Text className="text-white text-sm font-semibold mt-2">Calculating total...</Text>
                  ) : quotedAmountCents > 0 ? (
                  <Text className="text-white text-sm font-semibold mt-2">
                      Pay {moneyFormat(quotedAmountCents / 100)} for {formatPeriodCountLabel(quotedObligationIds.length, activeDueCadence)}.
                    </Text>
                  ) : prefetchedDueAmountCents > 0 ? (
                    <Text className="text-white text-sm font-semibold mt-2">
                      Pay exactly {moneyFormat(prefetchedDueAmountCents / 100)} for this due period.
                    </Text>
                  ) : null}
                  {coveredPeriods.length > 0 || coveredPeriodKeys.length > 0 ? (
                    <Text className="text-sky-100 text-xs mt-2">
                      Covers {coveredStart === coveredEnd ? coveredStart : `${coveredStart} to ${coveredEnd}`}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

              {!itemPickerVisible ? (
                <View className="rounded-[24px] bg-[#16181D] px-4 py-4 border border-white/6">
                  <FormSelect
                    label="Pay from"
                    selectedValue={selectedSource}
                    onValueChange={(value: string) => setSelectedSource(String(value || 'personal_wallet'))}
                    options={sourceOptions}
                    placeholder="Personal wallet"
                  />
                </View>
              ) : null}

              {!itemPickerVisible ? (
                <FinancialSummaryCard
                  title="Payment summary"
                  rows={preflightRows}
                  footer="Final amount is confirmed before execution."
                />
              ) : null}

              {(isMonthlyDueFlow || selectedIsDueItem) ? (
                <View className="rounded-[24px] bg-[#151515] px-4 py-4">
                  <Text className="text-white text-sm font-semibold">Pay for</Text>
                  <Text className="text-[#A9AFB8] text-xs mt-1">Choose how many {cadenceUnit(activeDueCadence)}s to cover now.</Text>
                  <View className="flex-row flex-wrap gap-2 mt-4">
                    {recurringMonthChoices.map((value) => {
                      const active = Number(dueMonths) === Number(value)
                      return (
                        <TouchableOpacity
                          key={value}
                          onPress={() => setDueMonths(value)}
                          className={`rounded-full border px-4 py-3 ${active ? 'border-cyan-400 bg-cyan-400/15' : 'border-white/10 bg-white/5'}`}
                        >
                          <Text className="text-white text-sm font-semibold">
                            {formatPeriodCountLabel(value, activeDueCadence)}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                  <View className="mt-4 flex-row items-center justify-between">
                    <Text className="text-[#8D94A0] text-xs">Or adjust the number of periods</Text>
                    <View className="flex-row items-center gap-3">
                      <TouchableOpacity
                        onPress={() => setDueMonths((current) => Math.max(1, current - 1))}
                        className="h-11 w-11 items-center justify-center rounded-full bg-[#1D2128]"
                      >
                        <Text className="text-white text-lg font-semibold">-</Text>
                      </TouchableOpacity>
                      <Text className="text-white text-2xl font-semibold min-w-[2.5rem] text-center">{dueMonths}</Text>
                      <TouchableOpacity
                        onPress={() => setDueMonths((current) => Math.min(Math.max(activeDueMonthsOpen, 1), current + 1))}
                        className="h-11 w-11 items-center justify-center rounded-full bg-[#1D2128]"
                      >
                        <Text className="text-white text-lg font-semibold">+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : null}

              {selectedIsQuantityItem ? (
                <View className="rounded-[24px] bg-[#151515] px-4 py-4">
                  <Text className="text-white mb-3 text-sm font-semibold">Quantity</Text>
                  <View className="flex-row items-center justify-between">
                    <TouchableOpacity
                      onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                      className="h-11 w-11 items-center justify-center rounded-full bg-[#1D2128]"
                    >
                      <Text className="text-white text-lg font-semibold">-</Text>
                    </TouchableOpacity>
                    <View className="items-center">
                      <Text className="text-white text-2xl font-semibold">{quantity}</Text>
                      <Text className="text-[#8D94A0] text-xs mt-1">
                        {selectedQuantityUnitPriceCents > 0 ? `${moneyFormat(selectedQuantityUnitPriceCents / 100)} per unit` : 'Unit price unavailable'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setQuantity((current) => current + 1)}
                      className="h-11 w-11 items-center justify-center rounded-full bg-[#1D2128]"
                    >
                      <Text className="text-white text-lg font-semibold">+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <FormInput
                label={selectedIsQuantityItem ? 'Total' : 'Amount'}
                value={formData.amount}
                name="amount"
                keyboardType="numeric"
                onChangeText={(text: string) => setFormData({ ...formData, amount: text })}
                editable={!isMonthlyDueFlow && !selectedIsDueItem && activePaymentItem?.checkout_mode !== 'fixed' && !selectedIsQuantityItem}
              />

              <FormInput
                label="Description (optional)"
                value={formData.description}
                name="description"
                onChangeText={(text: string) => setFormData({ ...formData, description: text })}
              />

              {isFlexibleOfficial && isTier1User && maxContributionCents > 0 ? (
                <View className={`rounded-[22px] px-4 py-3 ${overCap ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-sky-500/10 border border-sky-500/20'}`}>
                  <Text className={`text-xs ${overCap ? 'text-amber-100' : 'text-sky-100'}`}>
                    You can contribute up to {moneyFormat(maxContributionCents / 100)} with your current verification level.
                  </Text>
                  <Text className="text-[#A9AFB8] text-[10px] mt-1">Complete verification to unlock higher contributions.</Text>
                </View>
              ) : null}

              {isStandardCircle && isTier1User ? (
                <View className="rounded-[22px] bg-sky-500/10 border border-sky-500/20 px-4 py-3">
                  <Text className="text-xs text-sky-100">
                    Tier 1 users can contribute up to {moneyFormat(standardDailyCapCents / 100)} per day across standard circles.
                  </Text>
                  <Text className="text-[#A9AFB8] text-[10px] mt-1">Complete Tier 2 verification to unlock higher contributions.</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleOpenPin}
                className={`py-5 rounded-[20px] ${overCap || dueQuoteLoading ? 'bg-gray-700' : 'bg-theme-primary'}`}
                disabled={dueQuoteLoading || itemPickerVisible}
              >
                <Text className="text-alt font-semibold text-center">
                  {dueQuoteLoading ? 'Checking total...' : ctaLabel}
                </Text>
              </TouchableOpacity>
                </>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidWrapper>

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
        title="Enter PIN to Pay"
      />

      <Loader open={loading} />
    </ScreenContainer>
  )
}

export default CircleFundScreen


