import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCircleDuePlanSummary, getCirclePaymentItems, getCircleTreasury, getCircleWorkspace, listCircleDueObligations } from '@/api/circles'
import {
  CircleShell,
  RecentRecords,
  TreasuryCard,
  PaymentItemPreviewList,
  circleBucketLabel,
  circleTitle,
  normalizePaymentItems,
  paymentEventLabel,
} from '@/components/circles/rebuild'
import { extractCircleRecentActivity } from '@/utils/circleWorkspace'
import { decideHomeNavigation } from '@/utils/timelineRefs'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import {
  buildMemberDuesLookup,
  formatPeriodCountLabel,
  getCurrentUserDueSummary,
  getContributionStatusMeta,
} from '@/utils/circleDues'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'
import moneyFormat from '@/utils/moneyFormat'

const formatDateTimeLabel = (value: unknown) => {
  if (!value) return ''
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const CircleHomeScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [paymentItems, setPaymentItems] = useState<any[]>([])
  const [dueObligations, setDueObligations] = useState<Record<string, any>[]>([])
  const [dueSummary, setDueSummary] = useState<Record<string, any>>({})
  const [treasuryBalanceCents, setTreasuryBalanceCents] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadCircle = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [workspaceResponse, paymentItemsResponse, obligationsResponse, summaryResponse, treasuryResponse] = await Promise.all([
        getCircleWorkspace(circleId),
        getCirclePaymentItems(circleId),
        listCircleDueObligations(circleId).catch(() => null),
        getCircleDuePlanSummary(circleId).catch(() => null),
        getCircleTreasury(circleId).catch(() => null),
      ])
      setWorkspace(workspaceResponse || {})
      setPaymentItems(normalizePaymentItems(paymentItemsResponse))
      setDueObligations(Array.isArray(obligationsResponse?.data) ? obligationsResponse.data : [])
      setDueSummary(summaryResponse?.data && typeof summaryResponse.data === 'object' ? summaryResponse.data : summaryResponse || {})

      const treasuryPayload = treasuryResponse?.data || treasuryResponse || null
      const treasuryAccount =
        treasuryPayload?.treasury_account && typeof treasuryPayload.treasury_account === 'object'
          ? treasuryPayload.treasury_account
          : null
      const nextTreasuryBalanceCents =
        treasuryAccount && Number.isFinite(Number(treasuryAccount.balance_cents))
          ? Number(treasuryAccount.balance_cents)
          : null
      setTreasuryBalanceCents(nextTreasuryBalanceCents)
    } catch {
      setError('Unable to load this circle right now.')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [circleId])

  useFocusEffect(
    useCallback(() => {
      loadCircle(false)
    }, [loadCircle])
  )

  const records = useMemo(() => extractCircleRecentActivity(workspace), [workspace])
  const previewItems = useMemo(
    () => paymentItems.filter((item) => !item?.support_fallback).slice(0, 5),
    [paymentItems]
  )
  const dueStatusPreview = useMemo(() => {
    const members = Array.isArray(workspace?.members) ? workspace.members : []
    const lookup = buildMemberDuesLookup(members, dueObligations, workspace?.monthly_due_plan)
    return members
      .map((member) => ({
        member,
        dues: lookup[String(member?.id || member?.user?.id || '')],
      }))
      .filter((entry) => entry.dues)
      .slice(0, 5)
  }, [dueObligations, workspace])
  const currentUserSummary = useMemo(() => getCurrentUserDueSummary(dueSummary), [dueSummary])
  const duePlanConfigured = Boolean(workspace?.monthly_due_plan || dueSummary?.current_period)
  const contributionStatus = useMemo(
    () =>
      getContributionStatusMeta({
        status: String(currentUserSummary?.current_period_status || ''),
        duePlanConfigured,
      }),
    [currentUserSummary?.current_period_status, duePlanConfigured]
  )
  const contributionCycleLabel = String(
    workspace?.monthly_due_plan?.current_period_label ||
      dueSummary?.current_period?.label ||
      (duePlanConfigured ? 'Current cycle' : 'No dues plan')
  )
  const dueCadence = String(workspace?.monthly_due_plan?.cadence || dueSummary?.cadence || 'monthly')
  const contributionActivity = useMemo(() => records.slice(0, 4), [records])
  const currentRole = String(workspace?.current_user_role || '').toLowerCase()
  const canOpenTreasury = Boolean(currentRole)
  const workspaceBalanceCents = Number(workspace?.treasury_balance_cents ?? workspace?.balance_cents ?? 0)
  const treasuryDisplayBalanceCents = treasuryBalanceCents ?? workspaceBalanceCents

  const handleRecordPress = useCallback(
    (record: Record<string, any>) => {
      const decision = decideHomeNavigation(record)
      if (decision.type === 'receipt') {
        router.push({
          pathname: '/transaction/record/[reference]',
          params: { reference: decision.reference },
        } as any)
        return
      }

      if (decision.type === 'timeline-detail') {
        router.push({
          pathname: '/circles/[id]/timeline/[eventId]',
          params: { id: String(circleId), eventId: decision.id },
        } as any)
        return
      }

      router.push(`/circles/${circleId}/timeline` as any)
    },
    [circleId, router]
  )

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

  if (error || !workspace) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712] px-6">
        <Text className="text-center text-sm text-red-300">{error || 'Circle unavailable.'}</Text>
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
        active="home"
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => replaceCircleWorkspaceSection(router, String(circleId), 'manage')}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCircle(true)} />}
        >
          <TreasuryCard
            balanceCents={treasuryDisplayBalanceCents}
            onPay={() => router.push(`/circles/${circleId}/pay` as any)}
          />
          {canOpenTreasury ? (
            <TouchableOpacity
              onPress={() => router.push(`/circles/${circleId}/treasury` as any)}
              className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5"
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Circle Treasury</Text>
                  <Text className="mt-2 text-lg font-semibold text-white">View assigned account details</Text>
                  <Text className="mt-2 text-sm text-gray-400">
                    Once active, members can copy the Circle account number to pay dues or contribute.
                  </Text>
                </View>
                <View className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">
                  <Text className="text-[10px] font-semibold uppercase tracking-[1.5px] text-cyan-100">Open</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : null}
          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Your Contributions</Text>
                <Text className="mt-2 text-lg font-semibold text-white">Your current dues standing</Text>
              </View>
              <View className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
                <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-300">
                  {contributionCycleLabel}
                </Text>
              </View>
            </View>
            <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Current period</Text>
                  <Text className="mt-2 text-base font-semibold text-white">{contributionStatus.label}</Text>
                </View>
                <View className={`rounded-full px-3 py-1 ${
                  contributionStatus.tone === 'paid'
                    ? 'border border-emerald-400/20 bg-emerald-400/10'
                    : contributionStatus.tone === 'owing'
                      ? 'border border-amber-400/20 bg-amber-400/10'
                      : 'border border-gray-800 bg-gray-950'
                }`}>
                  <Text className={`text-[10px] font-semibold uppercase tracking-[1.5px] ${
                    contributionStatus.tone === 'paid'
                      ? 'text-emerald-100'
                      : contributionStatus.tone === 'owing'
                        ? 'text-amber-100'
                        : 'text-gray-300'
                  }`}>
                    {contributionStatus.label}
                  </Text>
                </View>
              </View>
            </View>
            {!duePlanConfigured ? (
              <Text className="mt-3 text-sm text-gray-400">
                This group has no dues plan yet. Optional payment items do not make you owing.
              </Text>
            ) : null}
            <View className="mt-4 flex-row flex-wrap gap-3">
              <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Outstanding amount</Text>
                <Text className="mt-2 text-lg font-semibold text-white">
                  {moneyFormat(Number(currentUserSummary?.total_outstanding_amount_cents || 0) / 100)}
                </Text>
              </View>
              <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Periods owed</Text>
                <Text className="mt-2 text-lg font-semibold text-white">
                  {formatPeriodCountLabel(Number(currentUserSummary?.periods_owed_count || 0), dueCadence)}
                </Text>
              </View>
              <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Prepaid</Text>
                <Text className="mt-2 text-lg font-semibold text-white">
                  {formatPeriodCountLabel(Number(currentUserSummary?.prepaid_periods_count || 0), dueCadence)}
                </Text>
              </View>
              <View className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Last paid</Text>
                <Text className="mt-2 text-sm font-semibold text-white">
                  {formatDateTimeLabel(currentUserSummary?.last_paid_at) || 'No dues payment yet'}
                </Text>
              </View>
            </View>
            <View className="mt-5 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
              <Text className="text-xs uppercase tracking-[1.5px] text-gray-500">Contribution activity</Text>
              <View className="mt-3 gap-3">
                {contributionActivity.length ? (
                  contributionActivity.map((record, index) => (
                    <View key={String(record?.id || record?.reference || index)} className="rounded-2xl border border-gray-900 bg-[#050b1b] px-4 py-4">
                      <Text className="text-sm font-medium text-white">{paymentEventLabel(record)}</Text>
                      <Text className="mt-1 text-xs text-gray-400">
                        {formatDateTimeLabel(record?.created_at || record?.occurred_at) || 'Recent'}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
                    <Text className="text-sm text-gray-400">No contribution activity yet.</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {workspace?.monthly_due_plan ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Dues Status</Text>
                  <Text className="mt-2 text-lg font-semibold text-white">Current member dues</Text>
                </View>
                <View className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
                  <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-300">
                    {String(workspace?.monthly_due_plan?.current_period_label || 'Current cycle')}
                  </Text>
                </View>
              </View>
              <View className="mt-4 gap-3">
                {dueStatusPreview.length ? (
                  dueStatusPreview.map(({ member, dues }) => (
                    <View key={String(member?.id || member?.user?.id || member?.user?.email || 'member')} className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-white">{member?.display_name || member?.user?.display_name || member?.user?.email || 'Member'}</Text>
                          <Text className="mt-1 text-xs text-gray-400">
                            {dues.periodsPaidLabel} - {moneyFormat(Number(dues.outstandingAmountCents || 0) / 100)} outstanding
                          </Text>
                        </View>
                        <View className={`rounded-full px-3 py-1 ${dues.statusKey === 'paid' ? 'border border-emerald-400/20 bg-emerald-400/10' : 'border border-amber-400/20 bg-amber-400/10'}`}>
                          <Text className={`text-[10px] font-semibold uppercase tracking-[1.5px] ${dues.statusKey === 'paid' ? 'text-emerald-100' : 'text-amber-100'}`}>
                            {dues.statusLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
                    <Text className="text-sm text-gray-400">No current-cycle dues status is available yet.</Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}
          <PaymentItemPreviewList
            items={previewItems}
            onSelect={(item) =>
              router.push({
                pathname: '/circles/[id]/pay',
                params: { id: String(circleId), paymentItemKey: String(item?.key || item?.id || '') },
              } as any)
            }
          />
          <RecentRecords records={records} onSelectRecord={handleRecordPress} />
        </ScrollView>
      </CircleShell>
    </>
  )
}

export default CircleHomeScreen
