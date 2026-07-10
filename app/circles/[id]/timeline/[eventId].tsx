import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import {
  assignCircleTreasuryInflow,
  previewCircleTreasuryInflowDues,
  settleCircleTreasuryInflowDues,
  getCirclePaymentItems,
  getCircleWorkspace,
  listCirclePeople,
} from '@/api/circles'
import {
  CircleShell,
  circleBucketLabel,
  circleTitle,
  activitySentence,
  paymentEventLabel,
  recordAmountLabel,
  recordDirection,
  recordStatusLabel,
  recordSubtitle,
  recordTimeLabel,
  recordTitle,
} from '@/components/circles/rebuild'
import SearchablePicker from '@/components/bankTransfer/SearchablePicker'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { canAccessManageCircle, canViewSharedFundTab, extractCircleRecentActivity } from '@/utils/circleWorkspace'
import { extractReceiptReference } from '@/utils/timelineRefs'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import moneyFormat from '@/utils/moneyFormat'
import HiddenHeaderRecovery from '@/components/navigation/HiddenHeaderRecovery'
import { CIRCLES_FALLBACK_LABEL, CIRCLES_FALLBACK_ROUTE } from '@/components/navigation/recoveryDefaults'

const findRecord = (records: any[], eventId: string) => {
  const target = String(eventId || '').trim()
  if (!target) return null

  return (
    records.find((record) => String(record?.id || '').trim() === target) ||
    records.find((record) => String(record?.uuid || '').trim() === target) ||
    records.find((record) => String(record?.reference || '').trim() === target) ||
    null
  )
}

const actorName = (record: Record<string, any>) => {
  const actor = record?.actor && typeof record.actor === 'object' && !Array.isArray(record.actor) ? record.actor : {}
  return String(
    actor.display_name || actor.name || actor.fallback_name || record?.actor_name || record?.user_name || 'Member'
  ).trim()
}

const beneficiaryLabel = (record: Record<string, any>) => {
  const meta = record?.meta && typeof record.meta === 'object' && !Array.isArray(record.meta) ? record.meta : {}
  const accountName = String(meta.account_name || meta.destination_account_name || '').trim()
  if (accountName) return accountName
  if (String(record?.activity_type || '').toLowerCase() === 'approval' || String(record?.activity_type || '').toLowerCase() === 'withdrawal') {
    return `${actorName(record)} wallet`
  }
  return ''
}

const cleanText = (value: unknown) => String(value || '').trim()
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1)

const formatCents = (value: unknown) => {
  const cents = Number(value)
  if (!Number.isFinite(cents)) return 'Unavailable'
  return moneyFormat(cents / 100)
}

const humanize = (value: unknown) =>
  cleanText(value).replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const getTreasuryInflowId = (record: Record<string, any> | null) => {
  const meta = asRecord(record?.meta)
  return String(
    meta.circle_treasury_inflow_id ||
      record?.circle_treasury_inflow_id ||
      meta.treasury_inflow_id ||
      record?.treasury_inflow_id ||
      ''
  ).trim()
}

const getAssignedPurposeLabel = (record: Record<string, any> | null) => {
  const meta = asRecord(record?.meta)
  return cleanText(
    meta.purpose_label ||
      record?.purpose_label ||
      meta.assignment_label ||
      record?.assignment_label ||
      meta.payment_purpose_label ||
      record?.payment_purpose_label
  )
}

const getAssignedPurposeReferenceId = (record: Record<string, any> | null) => {
  const meta = asRecord(record?.meta)
  return String(
    meta.purpose_reference_id ||
      record?.purpose_reference_id ||
      meta.assignment_reference_id ||
      record?.assignment_reference_id ||
      ''
  ).trim()
}

const getAssignedCirclePersonId = (record: Record<string, any> | null) => {
  const meta = asRecord(record?.meta)
  return String(
    meta.circle_person_id ||
      record?.circle_person_id ||
      meta.assignment_circle_person_id ||
      record?.assignment_circle_person_id ||
      ''
  ).trim()
}

const isCircleActivityPaymentItem = (item: Record<string, any>) => {
  const linkedReferenceType = String(item?.linked_reference_type || '').trim()
  const type = String(item?.type || item?.item_type || '').toLowerCase()
  const checkoutMode = String(item?.checkout_mode || item?.payment_item_kind || '').toLowerCase()

  if (linkedReferenceType === 'CircleDuePlan' || type === 'dues' || checkoutMode === 'recurring') return false
  if (linkedReferenceType === 'CircleActivity') return true

  return Boolean(item?.linked_reference_id || item?.activity_id)
}

const getCircleActivityPurposeId = (item: Record<string, any>) =>
  String(item?.linked_reference_id || item?.activity_id || '').trim()

const getCirclePersonOptionValue = (item: Record<string, any>) =>
  String(item?.id || item?.person_id || '').trim()

const getCirclePersonLabel = (item: Record<string, any>) => {
  const displayName = cleanText(item?.display_name || item?.linked_membership?.display_name)
  const username = cleanText(item?.linked_membership?.username)
  const extra = [username ? `@${username}` : '', cleanText(item?.status)].filter(Boolean).join(' | ')
  return [displayName || 'Circle person', extra].filter(Boolean).join(' - ')
}

const formatShortDate = (value: Date | string | number | null | undefined) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const endOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth() + 1, 0)

const maskedDestination = (record: Record<string, any>, meta: Record<string, any>, canShowUnmasked: boolean) => {
  const destination = record?.destination && typeof record.destination === 'object' && !Array.isArray(record.destination)
    ? record.destination
    : {}
  const bank = cleanText(meta.beneficiary_bank_name || destination.bank_name)
  const maskedAccount = cleanText(meta.beneficiary_account_number_masked)
  const account = maskedAccount || (canShowUnmasked ? cleanText(destination.account_number || record?.beneficiary_account_number) : '')
  return [bank, account].filter(Boolean).join(' - ')
}

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  if (!String(value || '').trim()) return null
  return (
    <View className="mt-4">
      <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">{label}</Text>
      <Text className="mt-1 text-sm text-gray-200">{value}</Text>
    </View>
  )
}

const CircleTimelineEventDetailScreen = () => {
  const { id, eventId } = useLocalSearchParams<{ id?: string | string[]; eventId?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const resolvedEventId = Array.isArray(eventId) ? eventId[0] : eventId
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [paymentItems, setPaymentItems] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [assignmentNotice, setAssignmentNotice] = useState('')
  const [people, setPeople] = useState<Record<string, any>[]>([])
  const [selectedPurposeKey, setSelectedPurposeKey] = useState('')
  const [selectedPersonKey, setSelectedPersonKey] = useState('')
  const [assignmentNote, setAssignmentNote] = useState('')
  const [duesPersonKey, setDuesPersonKey] = useState('')
  const [duesSettlementKind, setDuesSettlementKind] = useState<'dues' | 'outstanding_dues'>('dues')
  const [duesCoverageMode, setDuesCoverageMode] = useState<'through_date' | 'period_count'>('through_date')
  const [duesPeriodsCount, setDuesPeriodsCount] = useState(1)
  const [duesThroughDate, setDuesThroughDate] = useState(() => endOfMonth(new Date()))
  const [showDuesDatePicker, setShowDuesDatePicker] = useState(false)
  const [duesPreview, setDuesPreview] = useState<Record<string, any> | null>(null)
  const [duesPreviewLoading, setDuesPreviewLoading] = useState(false)
  const [duesPreviewError, setDuesPreviewError] = useState('')
  const [duesSettlementSaving, setDuesSettlementSaving] = useState(false)
  const [duesSettlementNotice, setDuesSettlementNotice] = useState('')
  const [duesSettlementError, setDuesSettlementError] = useState('')
  const [duesNote, setDuesNote] = useState('')

  const loadEvent = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    setError('')
    try {
      const [workspaceResponse, paymentItemsResponse, peopleResponse] = await Promise.all([
        getCircleWorkspace(circleId),
        getCirclePaymentItems(circleId).catch(() => null),
        listCirclePeople(circleId).catch(() => null),
      ])
      const itemsRoot = paymentItemsResponse?.data ?? paymentItemsResponse
      const peopleRoot = peopleResponse?.data?.people ?? peopleResponse?.data ?? peopleResponse
      setWorkspace(workspaceResponse || {})
      setPaymentItems((Array.isArray(itemsRoot) ? itemsRoot : []).map(asRecord))
      setPeople((Array.isArray(peopleRoot) ? peopleRoot : []).map(asRecord))
    } catch {
      setError('Unable to load this circle event right now.')
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useFocusEffect(
    useCallback(() => {
      loadEvent()
    }, [loadEvent])
  )

  const records = useMemo(() => extractCircleRecentActivity(workspace), [workspace])
  const record = useMemo(() => findRecord(records, String(resolvedEventId || '')), [records, resolvedEventId])
  const showAdminTab = canAccessManageCircle(workspace)
  const showTreasuryTab = canViewSharedFundTab(workspace)
  const currentRole = String(workspace?.current_user_role || workspace?.role || '').toLowerCase()
  const canAssignTreasuryInflow = ['owner', 'admin', 'treasurer'].includes(currentRole)
  const receiptReference = useMemo(() => extractReceiptReference(record || undefined, { allowWalletTx: true }), [record])
  const title = record ? recordTitle(record) : 'Circle event'
  const subtitle = record ? recordSubtitle(record) : ''
  const socialNarration = record ? activitySentence(record) : ''
  const direction = record ? recordDirection(record) : 'credit'
  const requestedBy = record ? actorName(record) : ''
  const destination = record ? beneficiaryLabel(record) : ''
  const meta = record?.meta && typeof record.meta === 'object' && !Array.isArray(record.meta) ? record.meta : {}
  const itemRule = String(record?.payment_item_kind || meta.payment_item_kind || '').trim()
  const quantity = Number(record?.payment_item_quantity || meta.payment_item_quantity || 0)
  const narration = cleanText(meta.narration || record?.narration)
  const note = cleanText(meta.note || meta.description || record?.note)
  const receiptCategory = cleanText(meta.receipt_category || record?.receipt_category)
  const inflowId = getTreasuryInflowId(record || null)
  const assignedPurposeLabel = getAssignedPurposeLabel(record || null)
  const assignedPurposeReferenceId = getAssignedPurposeReferenceId(record || null)
  const reconciliationLabel = cleanText(meta.reconciliation_label || record?.reconciliation_label)
  const reconciliationPersonLabel = cleanText(meta.reconciliation_person_label || record?.reconciliation_person_label)
  const reconciliationPurposeLabel = cleanText(meta.reconciliation_purpose_label || record?.reconciliation_purpose_label)
  const reconciliationContext = [reconciliationPersonLabel, reconciliationPurposeLabel].filter(Boolean).join(' for ')
  const proofAvailable = Boolean(meta.proof_available)
  const proofRoute = cleanText(meta.proof_route)
  const proofReference = cleanText(meta.proof_reference)
  const proofLabelText = cleanText(meta.proof_label) || 'Audit proof'
  const destinationAccountName = cleanText(meta.account_name || meta.destination_account_name)
  const destinationBankAccount = record ? maskedDestination(record, meta, showAdminTab) : ''
  const assignablePaymentItems = useMemo(
    () => paymentItems.filter((item) => isCircleActivityPaymentItem(item) && getCircleActivityPurposeId(item)),
    [paymentItems]
  )
  const assignablePeople = useMemo(
    () => people.filter((item) => getCirclePersonOptionValue(item)),
    [people]
  )
  const selectedPurposeOptions = useMemo(
    () =>
      assignablePaymentItems.map((item) => ({
        label: String(item.title || item.name || 'Payment item'),
        value: String(item.key || item.id || getCircleActivityPurposeId(item)),
        data: item,
      })),
    [assignablePaymentItems]
  )
  const selectedPersonOptions = useMemo(
    () =>
      assignablePeople.map((item) => ({
        label: getCirclePersonLabel(item),
        value: getCirclePersonOptionValue(item),
        data: item,
      })),
    [assignablePeople]
  )
  const selectedPurposeItem = useMemo(
    () =>
      assignablePaymentItems.find(
        (item) => String(item.key || item.id || getCircleActivityPurposeId(item)) === String(selectedPurposeKey || '')
      ) || null,
    [assignablePaymentItems, selectedPurposeKey]
  )
  const selectedPersonItem = useMemo(
    () =>
      assignablePeople.find((item) => getCirclePersonOptionValue(item) === String(selectedPersonKey || '')) || null,
    [assignablePeople, selectedPersonKey]
  )
  const duesPersonItem = useMemo(
    () =>
      assignablePeople.find((item) => getCirclePersonOptionValue(item) === String(duesPersonKey || '')) || null,
    [assignablePeople, duesPersonKey]
  )
  const currentAssignedItem = useMemo(
    () =>
      assignablePaymentItems.find(
        (item) => getCircleActivityPurposeId(item) === assignedPurposeReferenceId
      ) || null,
    [assignablePaymentItems, assignedPurposeReferenceId]
  )
  const assignedCirclePersonId = getAssignedCirclePersonId(record || null)
  const currentAssignedPerson = useMemo(
    () => assignablePeople.find((item) => getCirclePersonOptionValue(item) === assignedCirclePersonId) || null,
    [assignablePeople, assignedCirclePersonId]
  )
  const duesPreviewData = duesPreview?.preview && typeof duesPreview.preview === 'object' ? duesPreview.preview : null
  const duesPreviewCoverage = duesPreviewData?.covered_due_range && typeof duesPreviewData.covered_due_range === 'object'
    ? duesPreviewData.covered_due_range
    : {}
  const duesPreviewAllocations = Array.isArray(duesPreviewData?.suggested_allocations) ? duesPreviewData.suggested_allocations : []
  const duesPreviewSuggestedTotal = Number(duesPreviewData?.suggested_total_amount_cents || 0)
  const duesPreviewSuggestedRemaining = Number(
    duesPreviewData?.suggested_remaining_after_apply_cents ?? duesPreviewData?.inflow_remaining_amount_cents ?? 0
  )
  const isOutstandingDuesSettlement = duesSettlementKind === 'outstanding_dues'
  const shouldShowAssignmentSection = Boolean(inflowId && canAssignTreasuryInflow)
  const shouldShowDuesSection = Boolean(inflowId && canAssignTreasuryInflow)
  const detailRows = [
    { label: 'Requested by', value: requestedBy },
    { label: 'Paid to', value: destination || destinationAccountName },
    { label: 'Destination account', value: destinationAccountName },
    { label: 'Bank destination', value: destinationBankAccount },
    { label: 'Type', value: humanize(record?.activity_type || record?.kind) },
    { label: 'Receipt category', value: humanize(receiptCategory) },
    { label: 'Contribution type', value: humanize(itemRule) },
    { label: 'Quantity', value: quantity > 0 ? String(quantity) : '' },
    { label: 'Reconciled to', value: reconciliationLabel },
    { label: 'Reconciled person', value: reconciliationPersonLabel },
    { label: 'Reconciled purpose', value: reconciliationPurposeLabel },
    { label: 'Social narration', value: socialNarration },
    { label: 'Reconciliation context', value: reconciliationContext },
    { label: 'Assigned purpose', value: assignedPurposeLabel || String(currentAssignedItem?.title || '') },
    { label: 'Assigned person', value: cleanText(currentAssignedPerson?.display_name || currentAssignedPerson?.linked_membership?.display_name) },
    { label: 'Narration', value: narration },
    { label: 'Note', value: note },
    { label: proofAvailable ? 'Proof reference' : 'Record reference', value: String(proofReference || receiptReference || record?.reference || record?.id || '') },
  ].filter((row) => cleanText(row.value))

  const handleAssignPurpose = useCallback(async () => {
    if (!circleId || !inflowId || !selectedPurposeItem || assignmentSaving) return

    const purposeReferenceId = getCircleActivityPurposeId(selectedPurposeItem)
    if (!purposeReferenceId) {
      setAssignmentError('Select a valid payment purpose.')
      return
    }

    setAssignmentSaving(true)
    setAssignmentError('')
    setAssignmentNotice('')
    try {
      await assignCircleTreasuryInflow(circleId, inflowId, {
        purpose_reference_type: 'CircleActivity',
        purpose_reference_id: purposeReferenceId,
        circle_person_id: selectedPersonItem ? getCirclePersonOptionValue(selectedPersonItem) : undefined,
        assignment_note: cleanText(assignmentNote) || undefined,
      })
      setAssignmentNotice('Reconciliation saved.')
      await loadEvent()
    } catch (requestError: any) {
      const status = requestError?.response?.status
      const data = requestError?.response?.data
      const message =
        cleanText(data?.message) ||
        cleanText(requestError?.message) ||
        (status ? `Unable to save reconciliation (${status}).` : 'Unable to save reconciliation right now.')
      setAssignmentError(message)
    } finally {
      setAssignmentSaving(false)
    }
  }, [assignmentNote, assignmentSaving, circleId, inflowId, loadEvent, selectedPersonItem, selectedPurposeItem])

  const duesPreviewParams = useMemo(
    () => ({
      settlement_kind: duesSettlementKind,
      circle_person_id: duesPersonItem ? getCirclePersonOptionValue(duesPersonItem) : undefined,
      periods_count: !isOutstandingDuesSettlement && duesCoverageMode === 'period_count' ? duesPeriodsCount : undefined,
      through_on: !isOutstandingDuesSettlement && duesCoverageMode === 'through_date' ? duesThroughDate.toISOString().slice(0, 10) : undefined,
    }),
    [duesCoverageMode, duesPersonItem, duesPeriodsCount, duesSettlementKind, duesThroughDate, isOutstandingDuesSettlement]
  )

  const refreshDuesPreview = useCallback(async () => {
    if (!circleId || !inflowId || !duesPersonItem) {
      setDuesPreview(null)
      return
    }

    setDuesPreviewLoading(true)
    setDuesPreviewError('')
    try {
      const response = await previewCircleTreasuryInflowDues(circleId, inflowId, duesPreviewParams)
      const payload = response?.data ?? response ?? null
      setDuesPreview(payload)
    } catch (requestError: any) {
      setDuesPreview(null)
      setDuesPreviewError(
        buildApiErrorMessage({
          status: requestError?.response?.status,
          data: requestError?.response?.data,
          fallback: 'Unable to preview dues reconciliation right now.',
        })
      )
    } finally {
      setDuesPreviewLoading(false)
    }
  }, [circleId, duesPersonItem, duesPreviewParams, inflowId])

  useEffect(() => {
    if (selectedPersonKey && selectedPersonKey !== duesPersonKey) {
      setDuesPersonKey(selectedPersonKey)
    }
  }, [duesPersonKey, selectedPersonKey])

  useEffect(() => {
    if (!duesPersonKey && !selectedPersonKey && assignablePeople.length > 0) {
      setDuesPersonKey(getCirclePersonOptionValue(assignablePeople[0]))
    }
  }, [assignablePeople, duesPersonKey, selectedPersonKey])

  useEffect(() => {
    if (!duesPersonItem) {
      setDuesPreview(null)
      return
    }

    void refreshDuesPreview()
  }, [duesPersonItem, duesCoverageMode, duesPeriodsCount, duesThroughDate, refreshDuesPreview])

  useEffect(() => {
    setDuesSettlementNotice('')
    setDuesSettlementError('')
  }, [duesPersonItem, duesCoverageMode, duesPeriodsCount, duesThroughDate])

  const handleSettleDues = useCallback(async () => {
    if (!circleId || !inflowId || !duesPersonItem || duesSettlementSaving) return

    setDuesSettlementSaving(true)
    setDuesSettlementError('')
    setDuesSettlementNotice('')
    try {
      const response = await settleCircleTreasuryInflowDues(circleId, inflowId, {
        ...duesPreviewParams,
        note: cleanText(duesNote) || undefined,
      })
      setDuesSettlementNotice(isOutstandingDuesSettlement ? 'Outstanding dues settled.' : 'Dues settled.')
      setDuesNote('')
      await loadEvent()
      setDuesPreview((response?.data ?? response ?? null) as Record<string, any> | null)
    } catch (requestError: any) {
      setDuesSettlementError(
        buildApiErrorMessage({
          status: requestError?.response?.status,
          data: requestError?.response?.data,
          fallback: 'Unable to settle dues right now.',
        })
      )
    } finally {
      setDuesSettlementSaving(false)
    }
  }, [circleId, duesPersonItem, duesPreviewParams, duesSettlementSaving, inflowId, isOutstandingDuesSettlement, loadEvent])

  useEffect(() => {
    if (!currentAssignedItem) return
    const optionKey = String(
      currentAssignedItem.key || currentAssignedItem.id || getCircleActivityPurposeId(currentAssignedItem)
    )
    if (!optionKey || selectedPurposeKey === optionKey) return
    setSelectedPurposeKey(optionKey)
  }, [currentAssignedItem, selectedPurposeKey])

  useEffect(() => {
    if (!assignedCirclePersonId) return
    if (selectedPersonKey === assignedCirclePersonId) return
    setSelectedPersonKey(assignedCirclePersonId)
  }, [assignedCirclePersonId, selectedPersonKey])

  if (!circleId || !resolvedEventId) {
    return (
      <HiddenHeaderRecovery
        title="Activity unavailable"
        message="We couldn't open this activity from here. Return to your circles list and try again."
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

  if (error || !workspace) {
    return (
      <HiddenHeaderRecovery
        title="Activity unavailable"
        message={error || 'We could not load this Circle activity right now.'}
        fallbackRoute={CIRCLES_FALLBACK_ROUTE}
        fallbackLabel={CIRCLES_FALLBACK_LABEL}
        onRetry={loadEvent}
      />
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CircleShell
        circleId={String(circleId)}
        title={circleTitle(workspace)}
        logoUrl={String(workspace?.logo_url || '')}
        roleLabel={getCircleRoleLabel(workspace)}
        bucketLabel={circleBucketLabel(workspace)}
        active="timeline"
        showAdminTab={showAdminTab}
        onHome={() => router.replace(`/circles/${circleId}` as any)}
        onPay={() => router.push(`/circles/${circleId}/pay` as any)}
        onManage={() => router.push(`/circles/${circleId}/members` as any)}
        onTreasury={() => router.push(`/circles/${circleId}/treasury` as any)}
        onTimeline={() => router.replace(`/circles/${circleId}/timeline` as any)}
        showTreasuryTab={showTreasuryTab}
      >
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32, gap: 16 }}>
          {!record ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-6">
              <Text className="text-lg font-semibold text-white">Event not found</Text>
              <Text className="mt-2 text-sm text-gray-400">
                This record is no longer present in the current circle feed.
              </Text>
              <TouchableOpacity
                onPress={() => router.replace(`/circles/${circleId}/timeline` as any)}
                className="mt-5 rounded-2xl bg-cyan-400 px-4 py-4"
              >
                <Text className="text-center text-sm font-semibold text-slate-950">Back to Timeline</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Summary</Text>
                <Text className="mt-2 text-2xl font-semibold text-white">{title}</Text>
                <Text className="mt-1 text-sm text-gray-400">{socialNarration || subtitle}</Text>
                <Text className={`mt-4 text-[30px] font-semibold ${direction === 'debit' ? 'text-amber-200' : 'text-emerald-200'}`}>
                  {recordAmountLabel(record)}
                </Text>
                <Text className="mt-2 text-sm text-gray-400">
                  {[recordStatusLabel(record), recordTimeLabel(record)].filter(Boolean).join(' ï¿½ ')}
                </Text>
              </View>

              {shouldShowAssignmentSection ? (
                <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                  <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Reconcile inflow</Text>
                  <Text className="mt-2 text-sm text-gray-300">
                    Match this treasury inflow to a payment purpose and, if applicable, a registry person.
                  </Text>
                  <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Current purpose</Text>
                    <Text className="mt-2 text-sm text-white">
                      {assignedPurposeLabel || String(currentAssignedItem?.title || 'Not assigned')}
                    </Text>
                    <Text className="mt-2 text-xs text-gray-400">
                      {currentAssignedPerson ? `Person: ${getCirclePersonLabel(currentAssignedPerson)}` : 'Person not assigned'}
                    </Text>
                    {reconciliationLabel ? (
                      <Text className="mt-2 text-xs text-cyan-200">
                        {`Reconciled to ${reconciliationLabel}`}
                      </Text>
                    ) : null}
                  </View>
                  <View className="mt-4 gap-4">
                    {selectedPurposeOptions.length === 0 ? (
                      <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
                        <Text className="text-sm text-gray-400">
                          No Circle activity payment items are available for assignment.
                        </Text>
                      </View>
                    ) : (
                      <SearchablePicker
                        label="Payment purpose"
                        selectedValue={selectedPurposeKey}
                        options={selectedPurposeOptions}
                        placeholder="Search payment items"
                        onSelect={(option) => setSelectedPurposeKey(String(option.value))}
                      />
                    )}

                    {selectedPersonOptions.length === 0 ? (
                      <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
                        <Text className="text-sm text-gray-400">
                          No circle people are available for matching yet.
                        </Text>
                      </View>
                    ) : (
                      <SearchablePicker
                        label="Matched person"
                        selectedValue={selectedPersonKey}
                        options={selectedPersonOptions}
                        placeholder="Search people"
                        onSelect={(option) => setSelectedPersonKey(String(option.value))}
                      />
                    )}
                  </View>
                  <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Review</Text>
                    <Text className="mt-2 text-sm text-white">
                      {selectedPurposeItem ? String(selectedPurposeItem.title || 'Payment item') : 'Select a payment purpose'}
                    </Text>
                    <Text className="mt-2 text-xs text-gray-400">
                      {selectedPersonItem ? `Matched person: ${getCirclePersonLabel(selectedPersonItem)}` : 'Matched person: optional'}
                    </Text>
                    {reconciliationPurposeLabel ? (
                      <Text className="mt-2 text-xs text-cyan-200">
                        {`Current match: ${reconciliationLabel || [reconciliationPersonLabel, reconciliationPurposeLabel].filter(Boolean).join(' for ')}`}
                      </Text>
                    ) : null}
                  </View>
                  <View className="mt-4">
                    <Text className="text-sm text-gray-300">Note (optional)</Text>
                    <TextInput
                      value={assignmentNote}
                      onChangeText={setAssignmentNote}
                      placeholder="Why this inflow belongs to this payment purpose"
                      placeholderTextColor="#64748b"
                      className="mt-2 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4 text-sm text-white"
                      multiline
                    />
                  </View>
                  {assignmentNotice ? (
                    <View className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                      <Text className="text-sm text-emerald-100">{assignmentNotice}</Text>
                    </View>
                  ) : null}
                  {assignmentError ? (
                    <View className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-4">
                      <Text className="text-sm text-red-100">{assignmentError}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => {
                      void handleAssignPurpose()
                    }}
                    disabled={!selectedPurposeItem || assignmentSaving}
                    className={`mt-4 rounded-2xl px-4 py-4 ${
                      !selectedPurposeItem || assignmentSaving ? 'bg-gray-800' : 'bg-cyan-400'
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        !selectedPurposeItem || assignmentSaving ? 'text-gray-500' : 'text-slate-950'
                      }`}
                    >
                      {assignmentSaving ? 'Saving...' : 'Save reconciliation'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {shouldShowDuesSection ? (
                <View className="rounded-[28px] border border-cyan-400/20 bg-[#06111e] px-5 py-5">
                  <Text className="text-[11px] uppercase tracking-[2px] text-cyan-200">{isOutstandingDuesSettlement ? 'Settle outstanding dues' : 'Settle dues'}</Text>
                  <Text className="mt-2 text-sm text-gray-300">
                    {isOutstandingDuesSettlement
                      ? 'Pick a registry person and BitBridge will preview the exact carried-over balances that can be cleared with this inflow.'
                      : 'Pick a registry person, preview the exact dues periods, then settle this inflow against those due periods.'}
                  </Text>

                  <View className="mt-4 gap-4">
                    <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                      <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Settlement target</Text>
                      <View className="mt-3 flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => setDuesSettlementKind('dues')}
                          className={`flex-1 rounded-2xl border px-3 py-3 ${duesSettlementKind === 'dues' ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-800 bg-gray-900'}`}
                        >
                          <Text className="text-center text-sm font-semibold text-white">Monthly dues</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setDuesSettlementKind('outstanding_dues')}
                          className={`flex-1 rounded-2xl border px-3 py-3 ${duesSettlementKind === 'outstanding_dues' ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-800 bg-gray-900'}`}
                        >
                          <Text className="text-center text-sm font-semibold text-white">Outstanding dues</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {selectedPersonOptions.length === 0 ? (
                      <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
                        <Text className="text-sm text-gray-400">
                          No registry people are available for dues reconciliation yet.
                        </Text>
                      </View>
                    ) : (
                      <SearchablePicker
                        label="Dues person"
                        selectedValue={duesPersonKey}
                        options={selectedPersonOptions}
                        placeholder="Search people"
                        onSelect={(option) => setDuesPersonKey(String(option.value))}
                      />
                    )}

                    {isOutstandingDuesSettlement ? (
                      <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                        <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Coverage</Text>
                        <Text className="mt-2 text-sm text-white">Oldest outstanding balances first</Text>
                        <Text className="mt-1 text-xs text-gray-400">
                          BitBridge will apply this inflow to the oldest recorded carried-over dues for the selected person.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                          <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Coverage mode</Text>
                          <View className="mt-3 flex-row gap-2">
                            <TouchableOpacity
                              onPress={() => setDuesCoverageMode('through_date')}
                              className={`flex-1 rounded-2xl border px-3 py-3 ${
                                duesCoverageMode === 'through_date' ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-800 bg-gray-900'
                              }`}
                            >
                              <Text className="text-center text-sm font-semibold text-white">Through date</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setDuesCoverageMode('period_count')}
                              className={`flex-1 rounded-2xl border px-3 py-3 ${
                                duesCoverageMode === 'period_count' ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-800 bg-gray-900'
                              }`}
                            >
                              <Text className="text-center text-sm font-semibold text-white">Period count</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {duesCoverageMode === 'through_date' ? (
                      <TouchableOpacity
                        onPress={() => setShowDuesDatePicker(true)}
                        className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4"
                      >
                        <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Cover through</Text>
                        <Text className="mt-2 text-sm text-white">
                          {formatShortDate(duesThroughDate) || 'Pick a coverage date'}
                        </Text>
                        <Text className="mt-1 text-xs text-gray-400">
                          This will cover every dues period ending on or before that date.
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                        <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Periods</Text>
                        <View className="mt-3 flex-row flex-wrap gap-2">
                          {MONTH_OPTIONS.map((value) => (
                            <TouchableOpacity
                              key={value}
                              onPress={() => setDuesPeriodsCount(value)}
                              className={`rounded-full border px-4 py-2 ${
                                duesPeriodsCount === value ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-800 bg-gray-900'
                              }`}
                            >
                              <Text className="text-sm font-semibold text-white">{value} month{value === 1 ? '' : 's'}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                      </>
                    )}

                    <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                      <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Preview</Text>
                      {duesPreviewLoading ? (
                        <Text className="mt-2 text-sm text-gray-300">Calculating dues settlement...</Text>
                      ) : duesPreviewError ? (
                        <Text className="mt-2 text-sm text-red-200">{duesPreviewError}</Text>
                      ) : duesPreviewData ? (
                        <>
                        <Text className="mt-2 text-sm font-semibold text-white">
                          {duesPreviewData.total_amount_cents ? `NGN ${(Number(duesPreviewData.total_amount_cents) / 100).toLocaleString()}` : 'No amount previewed yet'}
                        </Text>
                        <Text className="mt-1 text-xs text-gray-400">
                          {duesPreviewSuggestedTotal > 0
                            ? isOutstandingDuesSettlement
                              ? `This inflow will settle ${formatCents(duesPreviewSuggestedTotal)} of outstanding dues`
                              : `This inflow will settle ${formatCents(duesPreviewSuggestedTotal)} of dues`
                            : isOutstandingDuesSettlement
                              ? 'No outstanding dues amount can be settled yet'
                              : 'No dues amount can be settled yet'}
                        </Text>
                        <Text className="mt-1 text-xs text-gray-400">
                          {isOutstandingDuesSettlement
                            ? `${Number(duesPreviewData?.balance_items_count || 0)} outstanding balance item${Number(duesPreviewData?.balance_items_count || 0) === 1 ? '' : 's'}`
                            : `${duesPreviewData?.periods_count || 0} month${Number(duesPreviewData?.periods_count || 0) === 1 ? '' : 's'}`}
                          {duesPreviewCoverage?.start && duesPreviewCoverage?.end
                            ? ` - ${String(duesPreviewCoverage.start)} to ${String(duesPreviewCoverage.end)}`
                            : ''}
                        </Text>
                        <Text className="mt-1 text-xs text-gray-400">
                          {duesPreviewSuggestedRemaining > 0
                            ? `${formatCents(duesPreviewSuggestedRemaining)} will remain after this allocation`
                            : 'No balance will remain after this allocation'}
                        </Text>
                        <Text className="mt-1 text-xs text-gray-400">
                          {duesPreviewAllocations.length > 0
                            ? isOutstandingDuesSettlement
                              ? `${duesPreviewAllocations.length} outstanding balance item${duesPreviewAllocations.length === 1 ? '' : 's'} will be settled`
                              : `${duesPreviewAllocations.length} due period${duesPreviewAllocations.length === 1 ? '' : 's'} will be settled`
                            : isOutstandingDuesSettlement
                              ? 'No outstanding dues balances available to settle'
                              : 'No dues periods available to settle'}
                        </Text>
                        {duesPreviewSuggestedTotal > 0 && duesPreviewSuggestedRemaining > 0 ? (
                          <Text className="mt-2 text-xs text-amber-200">
                            Partial settlement. The allocation will clear part of the dues and leave a balance owing.
                          </Text>
                        ) : null}
                        {duesPreviewData.reason ? (
                          <Text className="mt-2 text-xs text-amber-200">{String(duesPreviewData.reason)}</Text>
                        ) : null}
                        </>
                      ) : (
                        <Text className="mt-2 text-sm text-gray-400">Select a person and coverage rule to preview dues.</Text>
                      )}
                    </View>

                    <View>
                      <Text className="text-sm text-gray-300">Dues note (optional)</Text>
                      <TextInput
                        value={duesNote}
                        onChangeText={setDuesNote}
                        placeholder="Why this inflow settles these dues"
                        placeholderTextColor="#64748b"
                        className="mt-2 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4 text-sm text-white"
                        multiline
                      />
                    </View>

                    {duesSettlementNotice ? (
                      <View className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                        <Text className="text-sm text-emerald-100">{duesSettlementNotice}</Text>
                      </View>
                    ) : null}
                    {duesSettlementError ? (
                      <View className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-4">
                        <Text className="text-sm text-red-100">{duesSettlementError}</Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      onPress={() => {
                        void handleSettleDues()
                      }}
                      disabled={!duesPersonItem || duesPreviewLoading || duesSettlementSaving || !duesPreviewData || duesPreviewAllocations.length === 0}
                      className={`rounded-2xl px-4 py-4 ${
                        !duesPersonItem || duesPreviewLoading || duesSettlementSaving || !duesPreviewData || duesPreviewAllocations.length === 0
                          ? 'bg-gray-800'
                          : 'bg-cyan-400'
                      }`}
                    >
                      <Text
                        className={`text-center text-sm font-semibold ${
                          !duesPersonItem || duesPreviewLoading || duesSettlementSaving || !duesPreviewData || duesPreviewAllocations.length === 0
                            ? 'text-gray-500'
                            : 'text-slate-950'
                        }`}
                      >
                        {duesSettlementSaving
                          ? 'Settling...'
                          : duesPreviewAllocations.length === 0
                            ? isOutstandingDuesSettlement
                              ? 'No outstanding dues to settle'
                              : 'No dues to settle'
                            : isOutstandingDuesSettlement
                              ? 'Settle outstanding dues'
                              : 'Settle dues now'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">
                  {proofAvailable ? proofLabelText : 'Activity record'}
                </Text>
                <Text className="mt-2 text-sm text-gray-300">
                  {proofAvailable ? (socialNarration || paymentEventLabel(record)) : 'This activity does not have audit proof attached.'}
                </Text>
                <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                  <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Details</Text>
                  <View className="mt-1">
                    {detailRows.map((row) => (
                      <DetailRow key={row.label} label={row.label} value={row.value} />
                    ))}
                  </View>
                </View>
                {proofAvailable && (proofRoute || proofReference || receiptReference) ? (
                  <TouchableOpacity
                    onPress={() =>
                      proofRoute
                        ? router.push(proofRoute as any)
                        : router.push({
                            pathname: '/transaction/receipt',
                            params: { reference: proofReference || receiptReference },
                          } as any)
                    }
                    className="mt-5 rounded-2xl bg-cyan-400 px-4 py-4"
                  >
                    <Text className="text-center text-sm font-semibold text-slate-950">View proof</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => router.replace(`/circles/${circleId}/timeline` as any)}
                  className="mt-3 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4"
                >
                  <Text className="text-center text-sm font-semibold text-white">Back to Timeline</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </CircleShell>
      {showDuesDatePicker && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowDuesDatePicker(false)}>
          <Pressable onPress={() => setShowDuesDatePicker(false)} className="flex-1 justify-end bg-black/50">
            <Pressable onPress={() => {}} className="rounded-t-[28px] border border-white/8 bg-[#0f172a] px-4 pt-4 pb-6">
              <Text className="text-center text-base font-semibold text-white">Select dues coverage date</Text>
              <Text className="mt-2 text-center text-xs text-slate-400">Choose the date, then confirm.</Text>
              <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/50 px-3 py-2">
                <DateTimePicker
                  value={duesThroughDate}
                  mode="date"
                  display="spinner"
                  onChange={(_, selected) => {
                    if (selected) setDuesThroughDate(selected)
                  }}
                />
              </View>
              <View className="mt-4 flex-row gap-3">
                <TouchableOpacity onPress={() => setShowDuesDatePicker(false)} className="flex-1 items-center rounded-2xl border border-gray-700 px-4 py-4">
                  <Text className="text-sm font-semibold text-white">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowDuesDatePicker(false)} className="flex-1 items-center rounded-2xl bg-[#22d3ee] px-4 py-4">
                  <Text className="text-sm font-semibold text-slate-950">Use date</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {showDuesDatePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={duesThroughDate}
          mode="date"
          display="default"
          onChange={(_, selected) => {
            setShowDuesDatePicker(false)
            if (selected) setDuesThroughDate(selected)
          }}
        />
      ) : null}
    </>
  )
}

export default CircleTimelineEventDetailScreen

