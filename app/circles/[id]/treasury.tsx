import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCircleTreasury, getCircleWorkspace, requestCircleTreasury } from '@/api/circles'
import {
  CircleShell,
  circleBucketLabel,
  circleTitle,
} from '@/components/circles/rebuild'
import FormSelect from '@/components/FormSelect'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'

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

const statusLabel = (status: string) => {
  switch (status) {
    case 'not_requested':
      return 'Not requested'
    case 'pending_review':
      return 'Pending review'
    case 'pending_assignment':
      return 'Pending assignment'
    case 'active':
      return 'Active'
    case 'rejected':
      return 'Rejected'
    case 'suspended':
      return 'Suspended'
    default:
      return String(status || 'Unknown')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase())
    }
}

const statusDetail = (status: string) => {
  switch (status) {
    case 'not_requested':
      return 'Request a Circle account number so external payments can be received into this Circle.'
    case 'pending_review':
      return 'BitBridge is reviewing this request.'
    case 'pending_assignment':
      return 'The request was approved. Account details will appear here after manual assignment.'
    case 'active':
      return 'This Circle treasury account is active and ready to receive payments.'
    case 'rejected':
      return 'This treasury request was rejected. Review the request notes before submitting again.'
    case 'suspended':
      return 'This treasury account is suspended. Contact BitBridge support before sharing the account number.'
    default:
      return 'Treasury status is available for this Circle.'
  }
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
  { value: 'external_support', label: 'External support' },
  { value: 'event_collections', label: 'Event collections' },
  { value: 'general_treasury', label: 'General treasury' },
]

const inputClass = 'rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4 text-sm text-white'

const purposeLabel = (value: string) =>
  PURPOSE_OPTIONS.find((item) => item.value === value)?.label || 'General treasury'

const toneClass = (status: string) => {
  switch (status) {
    case 'active':
      return 'border-emerald-400/20 bg-emerald-400/10'
    case 'pending_review':
    case 'pending_assignment':
      return 'border-amber-400/20 bg-amber-400/10'
    case 'rejected':
    case 'suspended':
      return 'border-red-400/20 bg-red-400/10'
    default:
      return 'border-gray-800 bg-gray-950'
  }
}

const toneTextClass = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-emerald-100'
    case 'pending_review':
    case 'pending_assignment':
      return 'text-amber-100'
    case 'rejected':
    case 'suspended':
      return 'text-red-100'
    default:
      return 'text-gray-300'
  }
}

const CircleTreasuryScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [treasury, setTreasury] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({
    purpose_key: 'general_treasury',
    requested_purpose: '',
    circle_category: 'other',
    expected_monthly_volume_ngn: '',
    expected_member_count: '',
    expected_external_sender_count: '',
  })

  const loadTreasury = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [workspaceResponse, treasuryResponse] = await Promise.all([
        getCircleWorkspace(circleId),
        getCircleTreasury(circleId).catch(() => null),
      ])
      const workspaceData = workspaceResponse || {}
      setWorkspace(workspaceData)
      setTreasury(treasuryResponse?.data || treasuryResponse || null)
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
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load Circle treasury right now.')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [circleId])

  useFocusEffect(
    useCallback(() => {
      loadTreasury(false)
    }, [loadTreasury])
  )

  const currentStatus = String(treasury?.status || 'not_requested')
  const currentRole = String(workspace?.current_user_role || '').toLowerCase()
  const canRequest = currentRole === 'owner' || currentRole === 'admin'
  const canView = canRequest || currentRole === 'treasurer'
  const treasuryAccount = treasury?.treasury_account && typeof treasury.treasury_account === 'object' ? treasury.treasury_account : null
  const latestRequest = treasury?.latest_request && typeof treasury.latest_request === 'object' ? treasury.latest_request : null

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
      setNotice(response?.message || 'Circle treasury request created.')
      await loadTreasury(false)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to submit the treasury request right now.')
    } finally {
      setSubmitting(false)
    }
  }, [canRequest, circleId, formValid, loadTreasury, requestPayload, submitting])

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
        roleLabel={getCircleRoleLabel(workspace)}
        bucketLabel={circleBucketLabel(workspace)}
        active="manage"
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => replaceCircleWorkspaceSection(router, String(circleId), 'treasury')}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTreasury(true)} />}
        >
          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Circle Treasury</Text>
            <Text className="mt-2 text-lg font-semibold text-white">Account number request</Text>
            <Text className="mt-2 text-sm text-gray-400">
              BitBridge reviews the request and manually assigns the account number before it becomes active.
            </Text>
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
                  Only the creator, admins, or treasurers can submit a treasury request. Assigned details will appear here once the account becomes active.
                </Text>
              </View>
            ) : null}
            <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Status</Text>
                  <Text className="mt-2 text-lg font-semibold text-white">{statusLabel(currentStatus)}</Text>
                  <Text className="mt-2 text-sm text-gray-400">{statusDetail(currentStatus)}</Text>
                </View>
                <View className={`rounded-full border px-3 py-1 ${toneClass(currentStatus)}`}>
                  <Text className={`text-[10px] font-semibold uppercase tracking-[1.5px] ${toneTextClass(currentStatus)}`}>
                    {statusLabel(currentStatus)}
                  </Text>
                </View>
              </View>
            </View>
            {currentStatus === 'not_requested' && canRequest ? (
              <View className="mt-4 gap-4">
                <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Before you submit</Text>
                  <Text className="mt-2 text-sm text-gray-300">
                    BitBridge will review this request and manually assign the account number later. Approval does not create the number instantly.
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
                    placeholder="Example: Monthly member dues and supporter collections"
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
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Review</Text>
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
                    {submitting ? 'Submitting…' : 'Submit treasury request'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {latestRequest ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Latest Request</Text>
              <View className="mt-4 gap-3">
                <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Purpose</Text>
                  <Text className="mt-2 text-sm font-medium text-white">{String(latestRequest.requested_purpose || 'Circle treasury account')}</Text>
                </View>
                <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Category</Text>
                  <Text className="mt-2 text-sm font-medium text-white">
                    {String(latestRequest.circle_category || 'other').replace(/_/g, ' ').replace(/\b\w/g, (match: string) => match.toUpperCase())}
                  </Text>
                </View>
                {latestRequest.decision_note ? (
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Review note</Text>
                    <Text className="mt-2 text-sm font-medium text-white">{String(latestRequest.decision_note)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {treasuryAccount ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Assigned Details</Text>
              <View className="mt-4 gap-3">
                <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Account number</Text>
                  <View className="mt-2 flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-lg font-semibold text-white">
                      {String(treasuryAccount.account_number || 'Pending assignment')}
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
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Bank</Text>
                  <View className="mt-2 flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-sm font-medium text-white">
                      {String(treasuryAccount.bank_name || 'Pending assignment')}
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
                      {String(treasuryAccount.account_name || 'Pending assignment')}
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
              </View>
            </View>
          ) : null}
        </ScrollView>
      </CircleShell>
    </>
  )
}

export default CircleTreasuryScreen
