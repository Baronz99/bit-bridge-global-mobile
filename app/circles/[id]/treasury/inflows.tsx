import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import SearchablePicker from '@/components/bankTransfer/SearchablePicker'
import {
  assignCircleTreasuryInflow,
  correctCircleTreasuryInflowAssignment,
  getCirclePaymentItems,
  getCircleTreasury,
  getCircleWorkspace,
  listCirclePeople,
  listCircleTreasuryInflows,
  previewCircleTreasuryInflowDues,
  settleCircleTreasuryInflowDues,
} from '@/api/circles'
import { CircleShell, circleBucketLabel, circleTitle } from '@/components/circles/rebuild'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { canAccessManageCircle, canViewSharedFundTab } from '@/utils/circleWorkspace'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import moneyFormat from '@/utils/moneyFormat'

type TreasuryInflow = Record<string, any>

const inputClass = 'rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4 text-sm text-white'
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1)
const OUTSTANDING_DUES_PURPOSE_KEY = '__outstanding_dues__'

const cleanText = (value: unknown) => String(value || '').trim()

const formatStatus = (value: unknown) => {
  const text = cleanText(value)
  return text ? text.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()) : 'Unknown'
}

const formatCents = (value: unknown) => {
  const cents = Number(value)
  if (!Number.isFinite(cents)) return 'Unavailable'
  return moneyFormat(cents / 100)
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

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}

const getCircleActivityPurposeId = (item: Record<string, any>) =>
  String(item?.linked_reference_id || item?.activity_id || '').trim()

const getCirclePersonOptionValue = (item: Record<string, any>) =>
  String(item?.id || item?.person_id || '').trim()

const getCirclePersonLabel = (item: Record<string, any>) => {
  const displayName = cleanText(item?.display_name || item?.linked_membership?.display_name)
  const username = cleanText(item?.linked_membership?.username)
  const status = cleanText(item?.status)
  const parts = [displayName || 'Circle person']
  if (username) parts.push(`@${username}`)
  if (status) parts.push(status)
  return parts.join(' - ')
}

const resolveDuesSettlementKind = (item: Record<string, any> | null | undefined): 'dues' | 'outstanding_dues' | null => {
  if (!item) return null
  if (String(item?.settlement_kind || '').trim() === 'outstanding_dues') return 'outstanding_dues'
  const type = String(item?.type || item?.checkout_mode || '').toLowerCase()
  if (type === 'dues' || String(item?.linked_reference_type || '') === 'CircleDuePlan') return 'dues'
  return null
}

const formatInflowsMeta = (inflow: TreasuryInflow) => {
  const sender = cleanText(inflow.sender_name || 'External transfer')
  const narration = cleanText(inflow.narration)
  return [sender, narration].filter(Boolean).join(' - ')
}

const hasReconciliation = (inflow: TreasuryInflow | null | undefined) =>
  Number(inflow?.active_assignment_count || 0) > 0 || Number(inflow?.active_allocation_count || 0) > 0

const CircleTreasuryInflowsScreen = () => {
  const { id, inflow_id, assignment_id, circle_person_id, purpose_reference_type, purpose_reference_id, assignment_note, correction_reason } = useLocalSearchParams<{
    id?: string | string[]
    inflow_id?: string | string[]
    assignment_id?: string | string[]
    circle_person_id?: string | string[]
    purpose_reference_type?: string | string[]
    purpose_reference_id?: string | string[]
    assignment_note?: string | string[]
    correction_reason?: string | string[]
  }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const correctionInflowId = Array.isArray(inflow_id) ? inflow_id[0] : inflow_id
  const correctionAssignmentId = Array.isArray(assignment_id) ? assignment_id[0] : assignment_id
  const correctionCirclePersonId = Array.isArray(circle_person_id) ? circle_person_id[0] : circle_person_id
  const correctionPurposeReferenceType = Array.isArray(purpose_reference_type) ? purpose_reference_type[0] : purpose_reference_type
  const correctionPurposeReferenceId = Array.isArray(purpose_reference_id) ? purpose_reference_id[0] : purpose_reference_id
  const correctionAssignmentNote = Array.isArray(assignment_note) ? assignment_note[0] : assignment_note
  const correctionReasonParam = Array.isArray(correction_reason) ? correction_reason[0] : correction_reason
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [treasury, setTreasury] = useState<Record<string, any> | null>(null)
  const [paymentItems, setPaymentItems] = useState<Record<string, any>[]>([])
  const [people, setPeople] = useState<Record<string, any>[]>([])
  const [inflows, setInflows] = useState<TreasuryInflow[]>([])
  const [selectedInflowId, setSelectedInflowId] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [assignmentNotice, setAssignmentNotice] = useState('')
  const [duesSaving, setDuesSaving] = useState(false)
  const [duesError, setDuesError] = useState('')
  const [duesNotice, setDuesNotice] = useState('')
  const [selectedPurposeKey, setSelectedPurposeKey] = useState('')
  const [selectedPersonKey, setSelectedPersonKey] = useState('')
  const [assignmentNote, setAssignmentNote] = useState('')
  const [duesPersonKey, setDuesPersonKey] = useState('')
  const [duesCoverageMode, setDuesCoverageMode] = useState<'through_date' | 'period_count'>('through_date')
  const [duesPeriodsCount, setDuesPeriodsCount] = useState(1)
  const [duesThroughDate, setDuesThroughDate] = useState(() => endOfMonth(new Date()))
  const [showDuesDatePicker, setShowDuesDatePicker] = useState(false)
  const [duesPreview, setDuesPreview] = useState<Record<string, any> | null>(null)
  const [duesPreviewLoading, setDuesPreviewLoading] = useState(false)
  const [duesPreviewError, setDuesPreviewError] = useState('')
  const [duesNote, setDuesNote] = useState('')
  const [queueFilter, setQueueFilter] = useState<'all' | 'unassigned' | 'assigned'>('all')
  const [correctionReason, setCorrectionReason] = useState('')
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const previousQueueFilterRef = useRef(queueFilter)

  const loadInflows = useCallback(async (nextPage = 1, replace = true, options?: { background?: boolean }) => {
    if (!circleId) return
    if (replace && !(options?.background && hasLoadedOnce)) setLoading(true)
    else if (!replace) setLoadingMore(true)
    setError('')
    try {
      const [workspaceResponse, treasuryResponse, paymentItemsResponse, peopleResponse, inflowsResponse] = await Promise.all([
        getCircleWorkspace(circleId),
        getCircleTreasury(circleId).catch(() => null),
        getCirclePaymentItems(circleId).catch(() => null),
        listCirclePeople(circleId).catch(() => null),
        listCircleTreasuryInflows(circleId, {
          page: nextPage,
          per_page: 10,
          reconciliation_state: queueFilter === 'all' ? undefined : queueFilter,
        }).catch(() => null),
      ])

      const workspaceData = workspaceResponse || {}
      const treasuryData = treasuryResponse?.data || treasuryResponse || null
      const paymentItemsData = paymentItemsResponse?.data || paymentItemsResponse || []
      const peopleData = peopleResponse?.data?.people ?? peopleResponse?.data ?? peopleResponse ?? []
      const inflowsData = inflowsResponse?.data || []
      const metaData = inflowsResponse?.meta || null

      setWorkspace(workspaceData)
      setTreasury(treasuryData)
      setPaymentItems((Array.isArray(paymentItemsData) ? paymentItemsData : []).map(asRecord))
      setPeople((Array.isArray(peopleData) ? peopleData : []).map(asRecord))
      setTotalPages(Number(metaData?.total_pages || 0))
      setPage(Number(metaData?.page || nextPage))
      setInflows((prev) => (replace ? inflowsData.map(asRecord) : [...prev, ...inflowsData.map(asRecord)]))
      setHasLoadedOnce(true)

      if (replace) {
        const first = inflowsData?.[0]
        const firstId = cleanText(first?.id)
        if (!correctionInflowId) {
          setSelectedInflowId(firstId)
        }
      }
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Unable to load treasury inflows right now.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [circleId, correctionInflowId, hasLoadedOnce, queueFilter])

  useFocusEffect(
    useCallback(() => {
      void loadInflows(1, true, { background: hasLoadedOnce })
    }, [hasLoadedOnce, loadInflows])
  )

  useEffect(() => {
    if (!hasLoadedOnce) {
      previousQueueFilterRef.current = queueFilter
      return
    }

    if (previousQueueFilterRef.current === queueFilter) return
    previousQueueFilterRef.current = queueFilter
    void loadInflows(1, true, { background: true })
  }, [hasLoadedOnce, loadInflows, queueFilter])

  const currentRole = String(workspace?.current_user_role || '').toLowerCase()
  const canView = ['owner', 'admin', 'treasurer'].includes(currentRole)
  const showAdminTab = canAccessManageCircle(workspace)
  const showTreasuryTab = canViewSharedFundTab(workspace)
  const treasuryAccount = treasury?.treasury_account && typeof treasury.treasury_account === 'object' ? treasury.treasury_account : null
  const transferSourceReady = Boolean(treasuryAccount) && treasuryAccount.transfer_source_ready !== false
  const selectedInflow = useMemo(
    () => inflows.find((item) => cleanText(item?.id) === cleanText(selectedInflowId)) || null,
    [inflows, selectedInflowId]
  )
  const displayInflows = useMemo(() => inflows, [inflows])
  const selectedPurposeOptions = useMemo<Array<{ label: string; value: string; data: Record<string, any> }>>(
    () => [
      ...paymentItems.map((item) => ({
        label: String(item.title || item.name || 'Payment item'),
        value: String(item.key || item.id || getCircleActivityPurposeId(item)),
        data: item,
      })),
      {
        label: 'Outstanding dues',
        value: OUTSTANDING_DUES_PURPOSE_KEY,
        data: {
          key: OUTSTANDING_DUES_PURPOSE_KEY,
          title: 'Outstanding dues',
          type: 'dues',
          settlement_kind: 'outstanding_dues',
          linked_reference_type: 'CircleLegacyDueBalance',
          is_synthetic: true,
        },
      },
    ],
    [paymentItems]
  )
  const selectedPersonOptions = useMemo(
    () =>
      people.map((item) => ({
        label: getCirclePersonLabel(item),
        value: getCirclePersonOptionValue(item),
        data: item,
      })),
    [people]
  )
  const selectedPurposeItem = useMemo(
    () =>
      selectedPurposeOptions.find((item) => String(item.value) === String(selectedPurposeKey || ''))?.data || null,
    [selectedPurposeKey, selectedPurposeOptions]
  )
  const selectedPersonItem = useMemo(
    () => people.find((item) => getCirclePersonOptionValue(item) === String(selectedPersonKey || '')) || null,
    [people, selectedPersonKey]
  )
  const duesPersonItem = useMemo(
    () => people.find((item) => getCirclePersonOptionValue(item) === String(duesPersonKey || '')) || null,
    [duesPersonKey, people]
  )
  const selectedDuesSettlementKind = resolveDuesSettlementKind(selectedPurposeItem)
  const isOutstandingDuesPurpose = selectedDuesSettlementKind === 'outstanding_dues'
  const isDuesPurpose = selectedDuesSettlementKind !== null
  const duesPreviewData = duesPreview?.preview && typeof duesPreview.preview === 'object' ? duesPreview.preview : null
  const duesPreviewCoverage = duesPreviewData?.covered_due_range && typeof duesPreviewData.covered_due_range === 'object'
    ? duesPreviewData.covered_due_range
    : {}
  const duesPreviewAllocations = Array.isArray(duesPreviewData?.suggested_allocations) ? duesPreviewData.suggested_allocations : []
  const duesPreviewSuggestedTotal = Number(duesPreviewData?.suggested_total_amount_cents || 0)
  const duesPreviewSuggestedRemaining = Number(duesPreviewData?.suggested_remaining_after_apply_cents ?? selectedInflow?.remaining_amount_cents ?? 0)

  const duesPreviewParams = useMemo(
    () => ({
      settlement_kind: selectedDuesSettlementKind || undefined,
      circle_person_id: duesPersonItem ? getCirclePersonOptionValue(duesPersonItem) : undefined,
      periods_count: !isOutstandingDuesPurpose && duesCoverageMode === 'period_count' ? duesPeriodsCount : undefined,
      through_on: !isOutstandingDuesPurpose && duesCoverageMode === 'through_date' ? duesThroughDate.toISOString().slice(0, 10) : undefined,
    }),
    [duesCoverageMode, duesPersonItem, duesPeriodsCount, duesThroughDate, isOutstandingDuesPurpose, selectedDuesSettlementKind]
  )

  const refreshDuesPreview = useCallback(async () => {
    if (!circleId || !selectedInflowId || !duesPersonItem) {
      setDuesPreview(null)
      return
    }

    setDuesPreviewLoading(true)
    setDuesPreviewError('')
    try {
      const response = await previewCircleTreasuryInflowDues(circleId, selectedInflowId, duesPreviewParams)
      setDuesPreview((response?.data ?? response ?? null) as Record<string, any> | null)
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
  }, [circleId, duesPersonItem, duesPreviewParams, selectedInflowId])

  useEffect(() => {
    if (selectedPersonKey && selectedPersonKey !== duesPersonKey) {
      setDuesPersonKey(selectedPersonKey)
    }
  }, [duesPersonKey, selectedPersonKey])

  useEffect(() => {
    if (!duesPersonKey && !selectedPersonKey && people.length > 0) {
      setDuesPersonKey(getCirclePersonOptionValue(people[0]))
    }
  }, [duesPersonKey, people, selectedPersonKey])

  useEffect(() => {
    if (!duesPersonItem || !isDuesPurpose) {
      setDuesPreview(null)
      return
    }

    void refreshDuesPreview()
  }, [duesPersonItem, duesCoverageMode, duesPeriodsCount, duesThroughDate, isDuesPurpose, refreshDuesPreview])

  useEffect(() => {
    if (!selectedInflowId) return
    setAssignmentNotice('')
    setAssignmentError('')
    setDuesNotice('')
    setDuesError('')
    setDuesPreview(null)
  }, [selectedInflowId])

  useEffect(() => {
    if (selectedInflowId || inflows.length === 0) return
    setSelectedInflowId(cleanText(inflows[0]?.id))
  }, [inflows, selectedInflowId])

  useEffect(() => {
    if (!correctionInflowId || inflows.length === 0) return
    if (selectedInflowId !== cleanText(correctionInflowId)) {
      setSelectedInflowId(cleanText(correctionInflowId))
    }
  }, [correctionInflowId, inflows, selectedInflowId])

  useEffect(() => {
    if (!correctionAssignmentId) return
    if (correctionCirclePersonId && !selectedPersonKey) {
      setSelectedPersonKey(correctionCirclePersonId)
    }
    if (correctionPurposeReferenceId && !selectedPurposeKey) {
      setSelectedPurposeKey(correctionPurposeReferenceId)
    }
    if (correctionAssignmentNote && !assignmentNote) {
      setAssignmentNote(correctionAssignmentNote)
    }
    if (correctionReasonParam && !correctionReason) {
      setCorrectionReason(correctionReasonParam)
    }
  }, [
    assignmentNote,
    correctionAssignmentId,
    correctionAssignmentNote,
    correctionCirclePersonId,
    correctionPurposeReferenceId,
    correctionReason,
    correctionReasonParam,
    selectedPersonKey,
    selectedPurposeKey,
  ])

  const handleSelectInflow = useCallback((inflow: TreasuryInflow) => {
    setSelectedInflowId(cleanText(inflow?.id))
    setSelectedPurposeKey('')
    setSelectedPersonKey('')
    setAssignmentNote('')
    setDuesPersonKey('')
    setDuesCoverageMode('through_date')
    setDuesPeriodsCount(1)
    setDuesThroughDate(endOfMonth(new Date()))
    setDuesPreview(null)
    setDuesPreviewError('')
    setAssignmentError('')
    setDuesError('')
    setAssignmentNotice('')
    setDuesNotice('')
  }, [])

  const openInflowReview = useCallback((inflowId: string) => {
    if (!circleId || !inflowId) return
    router.push(`/circles/${circleId}/treasury/inflows/${inflowId}` as any)
  }, [circleId, router])

  const handleAssignPurpose = useCallback(async () => {
    if (!circleId || !selectedInflowId || !selectedPurposeItem || assignmentSaving) return
    const purposeReferenceId = getCircleActivityPurposeId(selectedPurposeItem)
    if (!purposeReferenceId) {
      setAssignmentError('Select a valid payment purpose.')
      return
    }

    setAssignmentSaving(true)
    setAssignmentError('')
    setAssignmentNotice('')
    try {
      const payload = {
        purpose_reference_type: correctionPurposeReferenceType || 'CircleActivity',
        purpose_reference_id: purposeReferenceId,
        circle_person_id: selectedPersonItem ? getCirclePersonOptionValue(selectedPersonItem) : undefined,
        assignment_note: cleanText(assignmentNote) || undefined,
        correction_reason: cleanText(correctionReason) || undefined,
      }

      if (correctionAssignmentId) {
        await correctCircleTreasuryInflowAssignment(circleId, selectedInflowId, correctionAssignmentId, payload)
      } else {
        await assignCircleTreasuryInflow(circleId, selectedInflowId, payload)
      }
      setAssignmentNotice('Reconciliation saved.')
      await loadInflows(page, true)
    } catch (requestError: any) {
      setAssignmentError(
        buildApiErrorMessage({
          status: requestError?.response?.status,
          data: requestError?.response?.data,
          fallback: 'Unable to save reconciliation right now.',
        })
      )
    } finally {
      setAssignmentSaving(false)
    }
  }, [assignmentNote, assignmentSaving, circleId, correctionAssignmentId, correctionReason, loadInflows, page, selectedInflowId, selectedPersonItem, selectedPurposeItem])

  const handleSettleDues = useCallback(async () => {
    if (!circleId || !selectedInflowId || !duesPersonItem || duesSaving || !isDuesPurpose) return

    setDuesSaving(true)
    setDuesError('')
    setDuesNotice('')
    try {
      await settleCircleTreasuryInflowDues(circleId, selectedInflowId, {
        settlement_kind: selectedDuesSettlementKind || 'dues',
        circle_person_id: getCirclePersonOptionValue(duesPersonItem),
        periods_count: !isOutstandingDuesPurpose && duesCoverageMode === 'period_count' ? duesPeriodsCount : undefined,
        through_on: !isOutstandingDuesPurpose && duesCoverageMode === 'through_date' ? duesThroughDate.toISOString().slice(0, 10) : undefined,
        note: cleanText(duesNote) || undefined,
      })
      setDuesNotice(isOutstandingDuesPurpose ? 'Outstanding dues settled.' : 'Dues settled.')
      setDuesNote('')
      await loadInflows(page, true)
    } catch (requestError: any) {
      setDuesError(
        buildApiErrorMessage({
          status: requestError?.response?.status,
          data: requestError?.response?.data,
          fallback: 'Unable to settle dues right now.',
        })
      )
    } finally {
      setDuesSaving(false)
    }
  }, [circleId, duesCoverageMode, duesNote, duesPersonItem, duesPeriodsCount, duesSaving, isDuesPurpose, isOutstandingDuesPurpose, loadInflows, page, selectedDuesSettlementKind, selectedInflowId, duesThroughDate])

  const handleDuesDateChange = useCallback((_: unknown, selectedDate?: Date) => {
    if (selectedDate) {
      setDuesThroughDate(selectedDate)
      if (Platform.OS === 'android') {
        setShowDuesDatePicker(false)
      }
    }
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    void loadInflows(1, true)
  }, [loadInflows])

  const handleLoadMore = useCallback(() => {
    if (loadingMore) return
    if (totalPages > 0 && page >= totalPages) return
    void loadInflows(page + 1, false)
  }, [loadInflows, loadingMore, page, totalPages])

  if (!circleId) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712]">
        <Text className="text-sm text-red-300">Missing circle.</Text>
      </View>
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
      <View className="flex-1 items-center justify-center bg-[#020712] px-6">
        <Text className="text-center text-sm text-red-300">{error}</Text>
      </View>
    )
  }

  if (!canView) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712] px-6">
        <Text className="text-center text-sm text-red-300">
          Only circle owners, admins, or treasurers can review treasury inflows.
        </Text>
      </View>
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
        active="treasury"
        showAdminTab={showAdminTab}
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => router.push(`/circles/${circleId}/members` as any)}
        onTreasury={() => router.push(`/circles/${circleId}/treasury` as any)}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
        showTreasuryTab={showTreasuryTab}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 120, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Treasury inflows</Text>
            <Text className="mt-2 text-lg font-semibold text-white">Reconciliation queue</Text>
            <Text className="mt-2 text-sm text-gray-400">
              Review incoming transfers, then match them to a person and purpose.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace(`/circles/${circleId}/treasury` as any)}
              className="mt-4 self-start rounded-full border border-white/10 bg-white/[0.04] px-4 py-2"
            >
              <Text className="text-white text-[11px] font-semibold">Back to Treasury</Text>
            </TouchableOpacity>
            {error ? (
              <View className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-4">
                <Text className="text-sm text-red-100">{error}</Text>
              </View>
            ) : null}
            <View className="mt-4 flex-row flex-wrap gap-3">
              <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-[#050b1b] px-4 py-4">
                <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-500">Queue</Text>
                <Text className="mt-2 text-sm font-semibold text-white">{inflows.length}</Text>
              </View>
              <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-[#050b1b] px-4 py-4">
                <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-500">Treasury state</Text>
                <Text className="mt-2 text-sm font-semibold text-white">{formatStatus(treasury?.status || treasury?.treasury_status)}</Text>
              </View>
            </View>
            <View className="mt-4 flex-row flex-wrap gap-2">
              {(['all', 'unassigned', 'assigned'] as const).map((filter) => {
                const active = queueFilter === filter
                const label = filter === 'all' ? 'All' : filter === 'unassigned' ? 'Unassigned' : 'Assigned'
                return (
                  <TouchableOpacity
                    key={filter}
                    onPress={() => setQueueFilter(filter)}
                    className={`rounded-full border px-3 py-2 ${active ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-800 bg-gray-900'}`}
                  >
                    <Text className="text-xs font-semibold text-white">{label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text className="mt-4 text-xs text-gray-500">
              {transferSourceReady ? 'Transfer source ready.' : 'Transfer source not ready yet.'}
            </Text>
          </View>

          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Inflows</Text>
            <Text className="mt-2 text-sm text-gray-400">Newest transfers appear first.</Text>
            <View className="mt-4 gap-3">
              {displayInflows.length === 0 ? (
                <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-5">
                  <Text className="text-sm text-gray-400">{queueFilter === 'all' ? 'No inflows found.' : 'No inflows match this filter.'}</Text>
                </View>
              ) : displayInflows.map((inflow) => {
                const active = cleanText(inflow.id) === cleanText(selectedInflowId)
                return (
                  <TouchableOpacity
                    key={String(inflow.id)}
                    onPress={() => handleSelectInflow(inflow)}
                    className={`rounded-2xl border px-4 py-4 ${active ? 'border-cyan-400/30 bg-cyan-500/10' : 'border-gray-900 bg-gray-950'}`}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-white">
                          {formatCents(inflow.amount_cents)}
                        </Text>
                        <Text className="mt-1 text-xs text-gray-400">
                          {formatInflowsMeta(inflow)}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-[11px] uppercase tracking-[1.2px] text-cyan-100">{formatStatus(inflow.status)}</Text>
                        <Text className="mt-1 text-[11px] uppercase tracking-[1.2px] text-gray-500">
                          {formatStatus(inflow.settlement_status)}
                        </Text>
                      </View>
                    </View>
                      <View className="mt-3 flex-row flex-wrap gap-3">
                        <Text className="text-[11px] text-gray-500">
                          Allocated: {formatCents(inflow.allocated_amount_cents)}
                        </Text>
                        <Text className="text-[11px] text-gray-500">
                          Remaining: {formatCents(inflow.remaining_amount_cents)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation()
                          openInflowReview(String(inflow.id))
                        }}
                        className="mt-3 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"
                      >
                        <Text className="text-[11px] font-semibold text-cyan-100">Open review details</Text>
                      </Pressable>
                      {hasReconciliation(inflow) ? (
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation()
                            openInflowReview(String(inflow.id))
                          }}
                          className="mt-2 self-start rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-2"
                        >
                          <Text className="text-[11px] font-semibold text-amber-100">Correct reconciliation</Text>
                        </Pressable>
                      ) : null}
                    </TouchableOpacity>
                  )
                })}
            </View>
            {totalPages > page ? (
              <TouchableOpacity
                onPress={handleLoadMore}
                disabled={loadingMore}
                className={`mt-4 rounded-2xl px-4 py-4 ${loadingMore ? 'bg-gray-800' : 'bg-cyan-400'}`}
              >
                <Text className={`text-center text-sm font-semibold ${loadingMore ? 'text-gray-500' : 'text-slate-950'}`}>
                  {loadingMore ? 'Loading more...' : 'Load more'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {selectedInflow ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Selected inflow</Text>
              <Text className="mt-2 text-2xl font-semibold text-white">{formatCents(selectedInflow.amount_cents)}</Text>
              <Text className="mt-1 text-sm text-gray-400">{formatInflowsMeta(selectedInflow)}</Text>
              <Text className="mt-2 text-xs text-gray-500">
                {formatStatus(selectedInflow.status)} - {formatStatus(selectedInflow.settlement_status)}
              </Text>
              <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Remaining</Text>
                <Text className="mt-2 text-sm font-semibold text-white">{formatCents(selectedInflow.remaining_amount_cents)}</Text>
              </View>
              {hasReconciliation(selectedInflow) ? (
                <TouchableOpacity
                  onPress={() => openInflowReview(String(selectedInflow.id))}
                  className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-4"
                >
                  <Text className="text-sm font-semibold text-amber-100">Correct this reconciliation</Text>
                  <Text className="mt-1 text-xs text-amber-50/80">
                    Open the review screen to change the person or purpose while preserving audit history.
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View className="mt-4 gap-4">
                {selectedPurposeOptions.length === 0 ? (
                  <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
                    <Text className="text-sm text-gray-400">No payment items are available for reconciliation.</Text>
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
                    <Text className="text-sm text-gray-400">No circle people are available yet.</Text>
                  </View>
                ) : (
                  <SearchablePicker
                    label="Circle person"
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
                  {selectedPurposeItem ? String(selectedPurposeItem.title || selectedPurposeItem.name || 'Payment item') : 'Select a payment purpose'}
                </Text>
                <Text className="mt-2 text-xs text-gray-400">
                  {selectedPersonItem ? `Matched person: ${getCirclePersonLabel(selectedPersonItem)}` : 'Matched person: optional'}
                </Text>
              </View>

              <View className="mt-4">
                <Text className="text-sm text-gray-300">Note (optional)</Text>
                <TextInput
                  value={assignmentNote}
                  onChangeText={setAssignmentNote}
                  placeholder="Why this inflow belongs to this payment purpose"
                  placeholderTextColor="#64748b"
                  className={`mt-2 ${inputClass}`}
                  multiline
                />
              </View>

              {correctionAssignmentId ? (
                <View className="mt-4">
                  <Text className="text-sm text-gray-300">Correction reason</Text>
                  <TextInput
                    value={correctionReason}
                    onChangeText={setCorrectionReason}
                    placeholder="Why this reconciliation needs correction"
                    placeholderTextColor="#64748b"
                    className={`mt-2 ${inputClass}`}
                    multiline
                  />
                </View>
              ) : null}

              {isDuesPurpose ? (
                <View className="mt-4 rounded-2xl border border-cyan-400/20 bg-[#06111e] px-4 py-4">
                  <Text className="text-[11px] uppercase tracking-[2px] text-cyan-200">{isOutstandingDuesPurpose ? 'Settle outstanding dues' : 'Settle dues'}</Text>
                  <Text className="mt-2 text-sm text-gray-300">
                    {isOutstandingDuesPurpose
                      ? 'Use the same inflow to clear historical dues balances that sit outside the current dues plan.'
                      : 'Use the same inflow to cover recurring dues for a selected person.'}
                  </Text>

                  {selectedPersonOptions.length > 0 ? (
                    <View className="mt-4">
                      <SearchablePicker
                        label="Dues person"
                        selectedValue={duesPersonKey}
                        options={selectedPersonOptions}
                        placeholder="Search people"
                        onSelect={(option) => setDuesPersonKey(String(option.value))}
                      />
                    </View>
                  ) : null}

                  {isOutstandingDuesPurpose ? (
                    <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                      <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Coverage</Text>
                      <Text className="mt-2 text-sm text-white">Oldest outstanding balances first</Text>
                      <Text className="mt-1 text-xs text-gray-400">
                        BitBridge will apply this inflow to the oldest recorded carried-over dues for the selected person.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                        <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Coverage mode</Text>
                        <View className="mt-3 flex-row gap-2">
                          <TouchableOpacity
                            onPress={() => setDuesCoverageMode('through_date')}
                            className={`flex-1 rounded-2xl border px-3 py-3 ${duesCoverageMode === 'through_date' ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-800 bg-gray-900'}`}
                          >
                            <Text className="text-center text-sm font-semibold text-white">Through date</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setDuesCoverageMode('period_count')}
                            className={`flex-1 rounded-2xl border px-3 py-3 ${duesCoverageMode === 'period_count' ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-800 bg-gray-900'}`}
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

                  <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">Preview</Text>
                    {duesPreviewLoading ? (
                      <Text className="mt-2 text-sm text-gray-300">Calculating dues settlement...</Text>
                    ) : duesPreviewError ? (
                      <Text className="mt-2 text-sm text-red-200">{duesPreviewError}</Text>
                    ) : duesPreview ? (
                      <>
                        <Text className="mt-2 text-sm font-semibold text-white">
                          {duesPreview.total_amount_cents ? formatCents(duesPreview.total_amount_cents) : 'No amount previewed yet'}
                        </Text>
                        <Text className="mt-1 text-xs text-gray-400">
                          {duesPreviewSuggestedTotal > 0
                            ? `This inflow will settle ${formatCents(duesPreviewSuggestedTotal)} of dues`
                            : 'No dues amount can be settled yet'}
                        </Text>
                        <Text className="mt-1 text-xs text-gray-400">
                          {isOutstandingDuesPurpose
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
                            ? isOutstandingDuesPurpose
                              ? `${duesPreviewAllocations.length} outstanding balance item${duesPreviewAllocations.length === 1 ? '' : 's'} will be settled`
                              : `${duesPreviewAllocations.length} due period${duesPreviewAllocations.length === 1 ? '' : 's'} will be settled`
                            : isOutstandingDuesPurpose
                              ? 'No outstanding dues balances available to settle'
                              : 'No dues periods available to settle'}
                        </Text>
                        {duesPreviewSuggestedTotal > 0 && duesPreviewSuggestedRemaining > 0 ? (
                          <Text className="mt-2 text-xs text-amber-200">
                            Partial settlement. The allocation will clear part of the dues and leave a balance owing.
                          </Text>
                        ) : null}
                        {duesPreviewData?.reason ? (
                          <Text className="mt-2 text-xs text-amber-200">{String(duesPreviewData.reason)}</Text>
                        ) : null}
                      </>
                    ) : (
                      <Text className="mt-2 text-sm text-gray-300">Select a person and coverage rule to preview dues.</Text>
                    )}
                  </View>

                  <View className="mt-4">
                    <Text className="text-sm text-gray-300">Dues note (optional)</Text>
                    <TextInput
                      value={duesNote}
                      onChangeText={setDuesNote}
                      placeholder="Optional dues reconciliation note"
                      placeholderTextColor="#64748b"
                      className={`mt-2 ${inputClass}`}
                      multiline
                    />
                  </View>

                  {duesNotice ? (
                    <View className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                      <Text className="text-sm text-emerald-100">{duesNotice}</Text>
                    </View>
                  ) : null}
                  {duesError ? (
                    <View className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-4">
                      <Text className="text-sm text-red-100">{duesError}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => {
                      void handleSettleDues()
                    }}
                    disabled={!duesPersonItem || duesPreviewLoading || duesSaving || !duesPreviewData || duesPreviewAllocations.length === 0}
                    className={`mt-4 rounded-2xl px-4 py-4 ${
                      !duesPersonItem || duesPreviewLoading || duesSaving || !duesPreviewData || duesPreviewAllocations.length === 0
                        ? 'bg-gray-800'
                        : 'bg-cyan-400'
                    }`}
                  >
                    <Text className={`text-center text-sm font-semibold ${
                      !duesPersonItem || duesPreviewLoading || duesSaving || !duesPreviewData || duesPreviewAllocations.length === 0
                        ? 'text-gray-500'
                        : 'text-slate-950'
                    }`}>
                      {duesSaving
                        ? 'Settling...'
                        : duesPreviewAllocations.length === 0
                          ? isOutstandingDuesPurpose
                            ? 'No outstanding dues to settle'
                            : 'No dues to settle'
                          : isOutstandingDuesPurpose
                            ? 'Settle outstanding dues'
                            : 'Settle dues now'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
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
                    className={`mt-4 rounded-2xl px-4 py-4 ${!selectedPurposeItem || assignmentSaving ? 'bg-gray-800' : 'bg-cyan-400'}`}
                  >
                    <Text className={`text-center text-sm font-semibold ${!selectedPurposeItem || assignmentSaving ? 'text-gray-500' : 'text-slate-950'}`}>
                      {assignmentSaving ? 'Saving...' : correctionAssignmentId ? 'Save correction' : 'Save reconciliation'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
        {Platform.OS === 'android' && showDuesDatePicker ? (
          <DateTimePicker
            value={duesThroughDate}
            mode="date"
            display="default"
            onChange={handleDuesDateChange}
          />
        ) : null}
        <Modal
          visible={Platform.OS !== 'android' && showDuesDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDuesDatePicker(false)}
        >
          <Pressable className="flex-1 bg-black/60" onPress={() => setShowDuesDatePicker(false)}>
            <View className="flex-1 items-center justify-center px-6">
              <Pressable className="w-full rounded-[28px] border border-gray-900 bg-[#050b1b] p-4" onPress={() => {}}>
                <Text className="text-sm font-semibold text-white">Select coverage date</Text>
                <View className="mt-3 rounded-2xl border border-gray-900 bg-gray-950 p-3">
                  <DateTimePicker
                    value={duesThroughDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDuesDateChange}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => setShowDuesDatePicker(false)}
                  className="mt-4 rounded-2xl bg-cyan-400 px-4 py-3"
                >
                  <Text className="text-center text-sm font-semibold text-slate-950">Done</Text>
                </TouchableOpacity>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </CircleShell>
    </>
  )
}

export default CircleTreasuryInflowsScreen

