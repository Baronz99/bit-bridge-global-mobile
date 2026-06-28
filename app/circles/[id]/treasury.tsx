import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCircleTreasury, getCircleWorkspace, listCircleTreasuryPayoutRequests, requestCircleTreasury } from '@/api/circles'
import {
  CircleShell,
  circleBucketLabel,
  circleTitle,
} from '@/components/circles/rebuild'
import FormSelect from '@/components/FormSelect'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { canAccessManageCircle, canViewSharedFundTab } from '@/utils/circleWorkspace'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'
import moneyFormat from '@/utils/moneyFormat'
import {
  DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS,
  isCircleScreenCacheFresh,
  readCircleScreenCache,
  writeCircleScreenCache,
} from '@/utils/circleScreenCache'

const categoryFromBucket = (workspace: Record<string, any> | null) => {
  const bucket = String(workspace?.product_bucket_key || '').toLowerCase()
  if (bucket.includes('family')) return 'family'
  if (bucket.includes('association')) return 'social'
  if (bucket.includes('club') || bucket.includes('team') || bucket.includes('community')) return 'social'
  if (bucket.includes('cooperative') || bucket.includes('contribution')) return 'contribution'
  if (bucket.includes('student')) return 'student'
  if (bucket.includes('project')) return 'project'
  return 'other'
}

const CATEGORY_OPTIONS = [
  { value: 'social', label: 'Social group' },
  { value: 'family', label: 'Family group' },
  { value: 'contribution', label: 'Contribution group' },
  { value: 'student', label: 'Student group' },
  { value: 'project', label: 'Project group' },
  { value: 'other', label: 'Other' },
]

const PURPOSE_OPTIONS = [
  { value: 'member_dues', label: 'Member dues' },
  { value: 'external_support', label: 'Collection support' },
  { value: 'event_collections', label: 'Event collections' },
  { value: 'general_treasury', label: 'Shared fund support' },
]

const inputClass = 'rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4 text-sm text-white'
type CircleTreasuryCache = {
  workspace: Record<string, any> | null
  treasury: Record<string, any> | null
  pendingPayoutCount: number
}

const purposeLabel = (value: string) =>
  PURPOSE_OPTIONS.find((item) => item.value === value)?.label || 'Shared fund support'

const formatStatus = (value: unknown, fallback = 'Unavailable') => {
  const text = String(value || '').trim()
  if (!text) return fallback
  return text.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

const formatCents = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Unavailable'
  const cents = Number(value)
  if (!Number.isFinite(cents)) return 'Unavailable'
  return moneyFormat(cents / 100)
}

const CircleTreasuryScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const cacheKey = circleId ? `circle-treasury:${circleId}` : ''
  const cachedTreasury = circleId ? readCircleScreenCache<CircleTreasuryCache>(cacheKey)?.data ?? null : null
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(() => cachedTreasury?.workspace ?? null)
  const [treasury, setTreasury] = useState<Record<string, any> | null>(() => cachedTreasury?.treasury ?? null)
  const [pendingPayoutCount, setPendingPayoutCount] = useState(() => cachedTreasury?.pendingPayoutCount ?? 0)
  const [loading, setLoading] = useState(() => !cachedTreasury)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showLatestRequest, setShowLatestRequest] = useState(false)
  const [showAssignedDetails, setShowAssignedDetails] = useState(false)
  const [form, setForm] = useState({
    purpose_key: 'general_treasury',
    requested_purpose: '',
    circle_category: 'other',
    expected_monthly_volume_ngn: '',
    expected_member_count: '',
    expected_external_sender_count: '',
  })

  const applyTreasuryPayload = useCallback((payload: CircleTreasuryCache) => {
    setWorkspace(payload.workspace)
    setTreasury(payload.treasury)
    setPendingPayoutCount(payload.pendingPayoutCount)
  }, [])

  useEffect(() => {
    const nextCachedTreasury = circleId ? readCircleScreenCache<CircleTreasuryCache>(cacheKey)?.data ?? null : null
    setWorkspace(nextCachedTreasury?.workspace ?? null)
    setTreasury(nextCachedTreasury?.treasury ?? null)
    setPendingPayoutCount(nextCachedTreasury?.pendingPayoutCount ?? 0)
    setLoading(!nextCachedTreasury)
    setRefreshing(false)
    setError('')
  }, [cacheKey, circleId])

  const loadTreasury = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    const cached = readCircleScreenCache<CircleTreasuryCache>(cacheKey)
    const hasVisibleData = Boolean(workspace || cached?.data.workspace)
    if (isRefresh) setRefreshing(true)
    else if (!hasVisibleData) setLoading(true)
    setError('')
    try {
      if (!isRefresh && cached?.data && isCircleScreenCacheFresh(cacheKey, DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS)) {
        if (!workspace) applyTreasuryPayload(cached.data)
        return
      }
      const [workspaceResponse, treasuryResponse, payoutsResponse] = await Promise.all([
        getCircleWorkspace(circleId),
        getCircleTreasury(circleId).catch(() => null),
        listCircleTreasuryPayoutRequests(circleId).catch(() => ({ data: [] })),
      ])
      const workspaceData = workspaceResponse || {}
      const nextTreasury = treasuryResponse?.data || treasuryResponse || null
      const payoutItems = Array.isArray(payoutsResponse?.data)
        ? payoutsResponse.data
        : Array.isArray(payoutsResponse)
          ? payoutsResponse
          : []
      const nextPayload: CircleTreasuryCache = {
        workspace: workspaceData,
        treasury: nextTreasury,
        pendingPayoutCount: payoutItems.filter((item: any) => String(item?.status || '').toLowerCase() === 'pending').length,
      }
      applyTreasuryPayload(nextPayload)
      writeCircleScreenCache(cacheKey, nextPayload)
      setForm((prev) => ({
        ...prev,
        requested_purpose:
          prev.requested_purpose ||
          `${circleTitle(workspaceData)} ${purposeLabel(prev.purpose_key).toLowerCase()}`,
        circle_category: categoryFromBucket(workspaceData),
        expected_member_count:
          prev.expected_member_count ||
          String(Array.isArray(workspaceData?.members) ? workspaceData.members.length : 0),
      }))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load Shared Fund right now.')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [applyTreasuryPayload, cacheKey, circleId, workspace])

  useFocusEffect(
    useCallback(() => {
      loadTreasury(false)
    }, [loadTreasury])
  )

  const currentStatus = String(
    treasury?.status ||
      workspace?.treasury_status ||
      workspace?.treasury_account_status ||
      ''
  ).toLowerCase()
  const treasuryState =
    currentStatus === 'active' || treasury?.treasury_account || workspace?.treasury_has_evidence || treasury?.treasury_has_evidence
      ? 'active'
      : ['pending_review', 'pending_assignment', 'rejected', 'suspended'].includes(currentStatus)
        ? 'under_review'
        : 'not_enabled'
  const screenTitle =
    treasuryState === 'active'
      ? 'Shared fund active'
      : treasuryState === 'under_review'
        ? 'Shared fund under review'
        : 'Shared fund not enabled'
  const screenDescription =
    treasuryState === 'active'
      ? 'The shared fund is active and can receive money.'
      : treasuryState === 'under_review'
        ? 'The shared fund request exists, but the account is still being reviewed or assigned.'
        : 'No shared fund account has been requested yet.'
  const currentRole = String(workspace?.current_user_role || '').toLowerCase()
  const canRequest = currentRole === 'owner' || currentRole === 'admin'
  const canView = canRequest || currentRole === 'treasurer'
  const showAdminTab = canAccessManageCircle(workspace)
  const showTreasuryTab = canViewSharedFundTab(workspace)
  const canViewBalance = workspace?.balance_visible !== false && workspace?.permissions?.can_view_balance !== false
  const treasuryAccount = treasury?.treasury_account && typeof treasury.treasury_account === 'object' ? treasury.treasury_account : null
  const transferSourceReady = Boolean(treasuryAccount) && treasuryAccount.transfer_source_ready !== false
  const latestRequest = treasury?.latest_request && typeof treasury.latest_request === 'object' ? treasury.latest_request : null
  const rawTreasuryBalanceCents =
    treasuryAccount?.balance_cents ??
      workspace?.treasury_balance_cents ??
      workspace?.balance_cents
  const treasuryBalanceCents = Number.isFinite(Number(rawTreasuryBalanceCents)) ? Number(rawTreasuryBalanceCents) : null
  const treasuryBalanceLabel = canViewBalance ? formatCents(treasuryBalanceCents) : 'Hidden'
  const accountStatus = String(
    treasuryAccount?.status ||
      treasuryAccount?.treasury_status ||
      treasury?.treasury_account_status ||
      treasury?.treasury_status ||
      currentStatus ||
      ''
  )

  useEffect(() => {
    if (treasuryState !== 'not_enabled') {
      setShowRequestForm(false)
    }
  }, [treasuryState])

  const handleCopyValue = useCallback(async (value: unknown, label: string) => {
    const copyValue = String(value || '').trim()
    if (!copyValue) return

    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(copyValue)
      Alert.alert('Copied', `${label} copied`)
    } catch {
      Alert.alert('Copy failed', `Unable to copy ${label.toLowerCase()}`)
    }
  }, [])

  const requestPayload = useMemo(() => ({
    requested_purpose: String(form.requested_purpose || '').trim(),
    circle_category: String(form.circle_category || 'other'),
    expected_monthly_volume_cents: Math.max(0, Math.round(Number(form.expected_monthly_volume_ngn || 0) * 100)),
    expected_member_count: Math.max(0, Number(form.expected_member_count || 0)),
    expected_external_sender_count: Math.max(0, Number(form.expected_external_sender_count || 0)),
  }), [form])

  const formValid = useMemo(() => (
    requestPayload.requested_purpose.length > 0 &&
    requestPayload.expected_monthly_volume_cents >= 0 &&
    requestPayload.expected_member_count >= 0 &&
    requestPayload.expected_external_sender_count >= 0
  ), [requestPayload])

  const handleRequest = useCallback(async () => {
    if (!circleId || !canRequest || submitting) return
    if (!formValid) {
      setError('Complete the treasury request form before submitting.')
      return
    }
    try {
      setSubmitting(true)
      setError('')
      setNotice('')
      const response = await requestCircleTreasury(circleId, requestPayload)
      setNotice(response?.message || 'Shared Fund request created.')
      await loadTreasury(false)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to submit the Shared Fund request right now.')
    } finally {
      setSubmitting(false)
    }
  }, [canRequest, circleId, formValid, loadTreasury, requestPayload, submitting])

  const openPayouts = useCallback(() => {
    if (!circleId || !transferSourceReady) return
    router.push(`/circles/${circleId}/treasury/payouts` as any)
  }, [circleId, router, transferSourceReady])

  const openInflows = useCallback(() => {
    if (!circleId) return
    router.push(`/circles/${circleId}/treasury/inflows` as any)
  }, [circleId, router])

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTreasury(true)} />}
        >
          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Shared Fund</Text>
            <Text className="mt-2 text-lg font-semibold text-white">{screenTitle}</Text>
            <Text className="mt-2 text-sm text-gray-400">{screenDescription}</Text>
            <TouchableOpacity onPress={() => router.replace(`/circles/${circleId}/pay` as any)} className="mt-4 self-start rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              <Text className="text-white text-[11px] font-semibold">Back to Payments</Text>
            </TouchableOpacity>
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
            {!canView && !treasuryAccount ? (
              <View className="mt-4 rounded-2xl border border-dashed border-gray-800 px-4 py-4">
                <Text className="text-sm text-gray-400">
                  Only the creator, admins, or treasurers can set up the shared fund. Account details will appear here once it becomes active.
                </Text>
              </View>
            ) : null}
            <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
              <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Shared Fund</Text>
              <Text className="mt-2 text-lg font-semibold text-white">{screenTitle}</Text>
              <Text
                className={`mt-2 text-sm ${
                  treasuryState === 'active'
                    ? 'text-emerald-300'
                    : treasuryState === 'under_review'
                      ? 'text-amber-300'
                      : 'text-gray-300'
                }`}
              >
                {screenDescription}
              </Text>
              {canView && treasuryAccount ? (
                <Text className={`mt-3 text-xs font-medium ${transferSourceReady ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {transferSourceReady ? 'Transfers are ready.' : 'Transfers are not ready yet.'}
                </Text>
              ) : null}
              <View className="mt-4 flex-row flex-wrap gap-3">
                <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-[#050b1b] px-4 py-4">
                  <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-500">Balance</Text>
                  <Text className="mt-2 text-sm font-semibold text-white">{treasuryBalanceLabel}</Text>
                </View>
                <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-[#050b1b] px-4 py-4">
                  <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-500">Fund state</Text>
                  <Text className="mt-2 text-sm font-semibold text-white">{formatStatus(accountStatus)}</Text>
                </View>
                <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-[#050b1b] px-4 py-4">
                  <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-500">Transfer setup</Text>
                  <Text className={`mt-2 text-sm font-semibold ${transferSourceReady ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {transferSourceReady ? 'Ready' : 'Not ready'}
                  </Text>
                </View>
                <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-[#050b1b] px-4 py-4">
                  <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-500">Payout requests</Text>
                  <Text className="mt-2 text-sm font-semibold text-white">{pendingPayoutCount}</Text>
                </View>
              </View>
                  {pendingPayoutCount > 0 ? (
                    <Text className="mt-2 text-xs font-medium text-cyan-300">
                      {pendingPayoutCount} payout{pendingPayoutCount === 1 ? '' : 's'} waiting for approval.
                    </Text>
                  ) : null}
            </View>
            {canView ? (
              <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Quick actions</Text>
                <View className="mt-3 flex-row gap-3">
                  <TouchableOpacity
                    onPress={openPayouts}
                    disabled={!transferSourceReady}
                    className={`flex-1 rounded-2xl px-4 py-4 ${transferSourceReady ? 'bg-cyan-400' : 'bg-gray-800'}`}
                  >
                    <Text className={`text-center text-sm font-semibold ${transferSourceReady ? 'text-slate-950' : 'text-gray-500'}`}>
                      {pendingPayoutCount > 0
                        ? `Payouts (${pendingPayoutCount})`
                        : transferSourceReady
                          ? 'Open payouts'
                          : 'Locked'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={openInflows}
                    className="flex-1 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4"
                  >
                    <Text className="text-center text-sm font-semibold text-emerald-100">Inflows</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            {currentStatus === 'not_requested' && canRequest && !treasuryAccount && !showRequestForm ? (
              <TouchableOpacity
                onPress={() => setShowRequestForm(true)}
                className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-4"
              >
                <Text className="text-center text-sm font-semibold text-cyan-100">Set up Shared Fund</Text>
              </TouchableOpacity>
            ) : null}
            {showRequestForm && currentStatus === 'not_requested' && canRequest && !treasuryAccount ? (
              <View className="mt-4 gap-4">
                <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Before you submit</Text>
                  <Text className="mt-2 text-sm text-gray-300">
                    BitBridge will review this request and share the fund details after approval. Approval does not make the fund ready instantly.
                  </Text>
                </View>
                <FormSelect
                  label="What is this account for?"
                  selectedValue={form.purpose_key}
                  onValueChange={(value: string) =>
                    setForm((prev) => ({
                      ...prev,
                      purpose_key: String(value || 'general_treasury'),
                      requested_purpose:
                        prev.requested_purpose.trim().length > 0
                          ? prev.requested_purpose
                          : `${circleTitle(workspace)} ${purposeLabel(String(value || 'general_treasury')).toLowerCase()}`,
                    }))
                  }
                  options={PURPOSE_OPTIONS}
                  placeholder="Select purpose"
                />
                <View>
                  <Text className="mb-2 text-sm text-gray-300">Purpose note</Text>
                  <TextInput
                    value={form.requested_purpose}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, requested_purpose: value }))}
                    placeholder="Example: Monthly dues and supporter collections"
                    placeholderTextColor="#64748b"
                    className={inputClass}
                  />
                </View>
                <FormSelect
                  label="Circle category"
                  selectedValue={form.circle_category}
                  onValueChange={(value: string) => setForm((prev) => ({ ...prev, circle_category: String(value || 'other') }))}
                  options={CATEGORY_OPTIONS}
                  placeholder="Select category"
                />
                <View>
                  <Text className="mb-2 text-sm text-gray-300">Expected monthly volume (NGN)</Text>
                  <TextInput
                    value={form.expected_monthly_volume_ngn}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, expected_monthly_volume_ngn: value }))}
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    className={inputClass}
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="mb-2 text-sm text-gray-300">Expected members</Text>
                    <TextInput
                      value={form.expected_member_count}
                      onChangeText={(value) => setForm((prev) => ({ ...prev, expected_member_count: value }))}
                      placeholder="0"
                      placeholderTextColor="#64748b"
                      className={inputClass}
                      keyboardType="numeric"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-2 text-sm text-gray-300">Expected external senders</Text>
                    <TextInput
                      value={form.expected_external_sender_count}
                      onChangeText={(value) => setForm((prev) => ({ ...prev, expected_external_sender_count: value }))}
                      placeholder="0"
                      placeholderTextColor="#64748b"
                      className={inputClass}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">At a glance</Text>
                  <Text className="mt-2 text-sm font-medium text-white">{requestPayload.requested_purpose || 'Add a short purpose note'}</Text>
                  <Text className="mt-2 text-xs text-gray-400">
                    {purposeLabel(form.purpose_key)} • {CATEGORY_OPTIONS.find((item) => item.value === form.circle_category)?.label || 'Other'}
                  </Text>
                  <Text className="mt-2 text-xs text-gray-400">
                    Expected monthly volume: NGN {Number(form.expected_monthly_volume_ngn || 0).toLocaleString()}
                  </Text>
                  <Text className="mt-1 text-xs text-gray-400">
                    Members: {requestPayload.expected_member_count} • External senders: {requestPayload.expected_external_sender_count}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleRequest}
                  disabled={submitting}
                  className={`rounded-2xl px-4 py-4 ${submitting ? 'bg-gray-800' : 'bg-cyan-400'}`}
                >
                  <Text className={`text-center text-sm font-semibold ${submitting ? 'text-gray-500' : 'text-slate-950'}`}>
                    {submitting ? 'Submitting...' : 'Submit shared fund request'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {latestRequest ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <TouchableOpacity
                onPress={() => setShowLatestRequest((value) => !value)}
                className="flex-row items-center justify-between gap-3"
              >
                <View className="flex-1">
                  <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Latest Request</Text>
                  <Text className="mt-2 text-sm font-medium text-white">{String(latestRequest.requested_purpose || 'Circle shared fund')}</Text>
                </View>
                <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-cyan-100">
                  {showLatestRequest ? 'Hide' : 'View'}
                </Text>
              </TouchableOpacity>
              {showLatestRequest ? (
                <View className="mt-4 gap-3">
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Purpose</Text>
                    <Text className="mt-2 text-sm font-medium text-white">
                      {String(latestRequest.requested_purpose || 'Circle shared fund')}
                    </Text>
                  </View>
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Category</Text>
                    <Text className="mt-2 text-sm font-medium text-white">
                      {String(latestRequest.circle_category || 'other').replace(/_/g, ' ').replace(/\b\w/g, (match: string) => match.toUpperCase())}
                    </Text>
                  </View>
                  {latestRequest.decision_note ? (
                    <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                      <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Team note</Text>
                      <Text className="mt-2 text-sm font-medium text-white">{String(latestRequest.decision_note)}</Text>
                    </View>
                  ) : (
                    <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                      <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Team note</Text>
                      <Text className="mt-2 text-sm text-gray-400">No team note yet.</Text>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {treasuryAccount ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <TouchableOpacity
                onPress={() => setShowAssignedDetails((value) => !value)}
                className="flex-row items-center justify-between gap-3"
              >
                <View className="flex-1">
                  <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Fund Details</Text>
                  <Text className="mt-2 text-sm font-medium text-white">
                    {String(treasuryAccount.account_name || treasuryAccount.bank_name || treasuryAccount.account_number || 'Details pending')}
                  </Text>
                </View>
                <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-cyan-100">
                  {showAssignedDetails ? 'Hide' : 'View'}
                </Text>
              </TouchableOpacity>
              {showAssignedDetails ? (
                <View className="mt-4 gap-3">
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Account number</Text>
                    <View className="mt-2 flex-row items-center justify-between gap-3">
                      <Text className="flex-1 text-lg font-semibold text-white">
                        {String(treasuryAccount.account_number || 'Details pending')}
                      </Text>
                      {treasuryAccount.account_number ? (
                        <TouchableOpacity
                          onPress={() => handleCopyValue(treasuryAccount.account_number, 'Account number')}
                          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5"
                        >
                          <Text className="text-[11px] font-semibold text-cyan-100">Copy</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Fund state</Text>
                    <Text className="mt-2 text-sm font-medium text-white">{formatStatus(accountStatus)}</Text>
                  </View>
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Bank</Text>
                    <View className="mt-2 flex-row items-center justify-between gap-3">
                      <Text className="flex-1 text-sm font-medium text-white">
                        {String(treasuryAccount.bank_name || 'Details pending')}
                      </Text>
                      {treasuryAccount.bank_name ? (
                        <TouchableOpacity
                          onPress={() => handleCopyValue(treasuryAccount.bank_name, 'Bank name')}
                          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5"
                        >
                          <Text className="text-[11px] font-semibold text-cyan-100">Copy</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Account name</Text>
                    <View className="mt-2 flex-row items-center justify-between gap-3">
                      <Text className="flex-1 text-sm font-medium text-white">
                        {String(treasuryAccount.account_name || 'Details pending')}
                      </Text>
                      {treasuryAccount.account_name ? (
                        <TouchableOpacity
                          onPress={() => handleCopyValue(treasuryAccount.account_name, 'Account name')}
                          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5"
                        >
                          <Text className="text-[11px] font-semibold text-cyan-100">Copy</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Transfer setup</Text>
                    <Text className={`mt-2 text-sm font-medium ${transferSourceReady ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {transferSourceReady ? 'Ready for money requests' : 'Transfer setup needs attention'}
                    </Text>
                    <Text className="mt-2 text-xs text-gray-400">
                      Payouts need transfer setup before approval.
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </CircleShell>
    </>
  )
}

export default CircleTreasuryScreen


