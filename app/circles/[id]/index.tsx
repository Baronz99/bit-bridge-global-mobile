import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCircleDuePlanSummary, getCirclePaymentItems, getCircleWorkspace } from '@/api/circles'
import {
  CircleShell,
  RecentRecords,
  circleBucketLabel,
  circleTitle,
  normalizePaymentItems,
} from '@/components/circles/rebuild'
import { describeCurrentUserDues, extractCircleDuesActivity, extractCircleRecentActivity } from '@/utils/circleWorkspace'
import { decideHomeNavigation } from '@/utils/timelineRefs'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { canAccessManageCircle, canViewSharedFundTab } from '@/utils/circleWorkspace'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'
import { FEATURE_CIRCLE_OS } from '@/constants/featureFlags'
import {
  DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS,
  isCircleScreenCacheFresh,
  readCircleScreenCache,
  writeCircleScreenCache,
} from '@/utils/circleScreenCache'
import { useEffect } from 'react'

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

type CircleRecord = Record<string, unknown>
type CircleHomeCache = {
  workspace: CircleRecord | null
  circleLogoUrl: string
  paymentItems: CircleRecord[]
  dueSummary: CircleRecord
}

const asCircleRecord = (value: unknown): CircleRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as CircleRecord : {}

const CommandSection = ({
  title,
  helper,
  children,
  actionLabel,
  onAction,
}: {
  title: string
  helper?: string
  children: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}) => (
  <View className="rounded-[24px] border border-gray-900 bg-[#050b1b] px-4 py-4">
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">{title}</Text>
        {helper ? <Text className="mt-2 text-sm text-gray-400">{helper}</Text> : null}
      </View>
      {actionLabel && onAction ? (
      <TouchableOpacity onPress={onAction} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2">
        <Text className="text-[10px] font-semibold uppercase tracking-[1.5px] text-cyan-100">{actionLabel}</Text>
      </TouchableOpacity>
      ) : null}
    </View>
    <View className="mt-4 gap-3">{children}</View>
  </View>
)

const StateRow = ({
  title,
  value,
  helper,
  tone = 'default',
  onPress,
}: {
  title: string
  value: string
  helper?: string
  tone?: 'default' | 'good' | 'warn' | 'info'
  onPress?: () => void
}) => {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-200'
      : tone === 'warn'
        ? 'text-amber-200'
        : tone === 'info'
          ? 'text-cyan-100'
          : 'text-white'
  const content = (
    <>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-white">{title}</Text>
          {helper ? <Text className="mt-1 text-xs text-gray-400">{helper}</Text> : null}
        </View>
        <Text className={`max-w-[42%] text-right text-sm font-semibold ${toneClass}`} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-3.5">
        {content}
      </TouchableOpacity>
    )
  }

  return <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-3.5">{content}</View>
}

const EmptyState = ({ label }: { label: string }) => (
  <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
    <Text className="text-sm text-gray-400">{label}</Text>
  </View>
)

const isPendingApprovalItem = (item: CircleRecord) => {
  const actions = item?.available_actions && typeof item.available_actions === 'object' && !Array.isArray(item.available_actions)
    ? item.available_actions as CircleRecord
    : {}
  return Boolean(
    actions?.can_approve ||
      actions?.can_reject ||
      String(item?.lifecycle_state || '').toLowerCase() === 'pending_approval'
  )
}

const CircleHomeScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const cacheKey = circleId ? `circle-home:${circleId}` : ''
  const cachedHome = circleId ? readCircleScreenCache<CircleHomeCache>(cacheKey)?.data ?? null : null
  const router = useRouter()
  const [workspace, setWorkspace] = useState<CircleRecord | null>(() => cachedHome?.workspace ?? null)
  const [circleLogoUrl, setCircleLogoUrl] = useState(() => cachedHome?.circleLogoUrl ?? '')
  const [paymentItems, setPaymentItems] = useState<CircleRecord[]>(() => cachedHome?.paymentItems ?? [])
  const [dueSummary, setDueSummary] = useState<CircleRecord>(() => cachedHome?.dueSummary ?? {})
  const [loading, setLoading] = useState(() => !cachedHome)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const applyHomePayload = useCallback((payload: CircleHomeCache) => {
    setWorkspace(payload.workspace)
    setCircleLogoUrl(payload.circleLogoUrl)
    setPaymentItems(payload.paymentItems)
    setDueSummary(payload.dueSummary)
  }, [])

  useEffect(() => {
    const nextCachedHome = circleId ? readCircleScreenCache<CircleHomeCache>(cacheKey)?.data ?? null : null
    setWorkspace(nextCachedHome?.workspace ?? null)
    setCircleLogoUrl(nextCachedHome?.circleLogoUrl ?? '')
    setPaymentItems(nextCachedHome?.paymentItems ?? [])
    setDueSummary(nextCachedHome?.dueSummary ?? {})
    setLoading(!nextCachedHome)
    setRefreshing(false)
    setError('')
  }, [cacheKey, circleId])

  const loadCircle = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    const cached = readCircleScreenCache<CircleHomeCache>(cacheKey)
    const hasVisibleData = Boolean(workspace || cached?.data.workspace)
    const cacheIsFresh = Boolean(cached?.data && isCircleScreenCacheFresh(cacheKey, DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS))

    if (!isRefresh && cacheIsFresh && !workspace) {
      applyHomePayload(cached.data)
    }

    if (isRefresh) setRefreshing(true)
    else if (!hasVisibleData && !cacheIsFresh) setLoading(true)
    setError('')
    try {
      const [workspaceResult, paymentItemsResult, summaryResult] = await Promise.allSettled([
        getCircleWorkspace(circleId),
        getCirclePaymentItems(circleId),
        getCircleDuePlanSummary(circleId),
      ])

      if (workspaceResult.status !== 'fulfilled') {
        throw workspaceResult.reason
      }

      const ws = workspaceResult.value || {}
      const paymentItemsResponse = paymentItemsResult.status === 'fulfilled' ? paymentItemsResult.value : null
      const summaryResponse = summaryResult.status === 'fulfilled' ? summaryResult.value : null
      const nextPayload: CircleHomeCache = {
        workspace: ws,
        circleLogoUrl: String(ws?.logo_url || '').trim(),
        paymentItems: paymentItemsResponse ? normalizePaymentItems(paymentItemsResponse) : [],
        dueSummary: summaryResponse?.data && typeof summaryResponse.data === 'object' ? summaryResponse.data : summaryResponse || {},
      }
      applyHomePayload(nextPayload)
      writeCircleScreenCache(cacheKey, nextPayload)
    } catch {
      if (!hasVisibleData && !cacheIsFresh) {
        setError('Unable to load this circle right now.')
      }
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [applyHomePayload, cacheKey, circleId, workspace])

  useFocusEffect(
    useCallback(() => {
      loadCircle(false)
    }, [loadCircle])
  )

  const records = useMemo(() => extractCircleRecentActivity(workspace), [workspace])
  const duesRecords = useMemo(() => extractCircleDuesActivity(workspace), [workspace])
  const previewItems = useMemo(
    () => paymentItems.filter((item) => !item?.support_fallback).slice(0, 4),
    [paymentItems]
  )
  const duePlanConfigured = Boolean(workspace?.monthly_due_plan || dueSummary?.current_period)
  const canManageWorkspace = canAccessManageCircle(workspace)
  const showTreasuryTab = canViewSharedFundTab(workspace)
  const permissions = asCircleRecord(workspace?.permissions)
  const circleOs = asCircleRecord(workspace?.circle_os)
  const circleOsMoney = asCircleRecord(circleOs?.money)
  const circleOsReconciliation = asCircleRecord(circleOs?.reconciliation)
  const circleOsAmbiguity = asCircleRecord(circleOs?.ambiguity)
  const circleOsNotes = Array.isArray(circleOsAmbiguity?.notes) ? circleOsAmbiguity.notes : []
  const circleOsEnabled = Boolean(FEATURE_CIRCLE_OS && workspace?.circle_os_enabled === true && Object.keys(circleOs).length)
  const circleOsStatus = String(circleOsReconciliation?.status || '').toLowerCase()
  const circleOsClean = circleOsStatus === 'clean'
  const circleOsWarning = circleOsStatus === 'warning'
  const circleOsGoals = Array.isArray(circleOsMoney?.goals) ? circleOsMoney.goals as CircleRecord[] : []
  const circleOsCampaigns = Array.isArray(circleOsMoney?.campaigns) ? circleOsMoney.campaigns as CircleRecord[] : []
  const circleOsDecisions = asCircleRecord(circleOs?.decisions)
  const circleOsPeople = asCircleRecord(circleOs?.people)
  const circleOsOutstandingMembers = safeNumber(circleOsPeople?.outstanding_members, 0)
  const canViewApprovalDetails = canManageWorkspace || Boolean(permissions?.can_approve_withdrawals)
  const approvals = asCircleRecord(workspace?.approvals)
  const workspacePendingApprovalCount = Number(
    safeNumber(
      approvals?.pending_count ?? 
        (Array.isArray(approvals?.items) ? (approvals.items as CircleRecord[]).filter((item) => isPendingApprovalItem(item)).length : 0),
      0
    )
  )
  const circleOsPendingApprovalCount = circleOsEnabled ? safeNumber(circleOsDecisions?.pending_approval_count, 0) : 0
  const pendingApprovalCount = Math.max(workspacePendingApprovalCount, circleOsPendingApprovalCount)
  const treasuryAccount = asCircleRecord(workspace?.treasury_account)
  const workspacePendingPayoutCount = safeNumber(
    workspace?.pending_treasury_payout_count ??
      workspace?.treasury_pending_payout_count ??
      treasuryAccount?.pending_payout_count ??
      treasuryAccount?.pending_payouts_count,
    0
  )
  const circleOsPendingPayoutCount = circleOsEnabled ? safeNumber(circleOsDecisions?.pending_treasury_payout_count, 0) : 0
  const pendingPayoutCount = Math.max(workspacePendingPayoutCount, circleOsPendingPayoutCount)
  const withdrawalRequiresApproval = Boolean(workspace?.withdrawal_requires_approval)
  const currentRole = String(workspace?.current_user_role || workspace?.role || '').toLowerCase()
  const canManageTreasury = Boolean(
    canManageWorkspace ||
      currentRole === 'owner' ||
      currentRole === 'admin' ||
      currentRole === 'treasurer' ||
      permissions.can_manage_settings ||
      permissions.can_manage_governance ||
      permissions.can_manage_due_plan ||
      permissions.can_approve_withdrawals
  )
  const currentUserSummary = dueSummary?.current_user_due_summary && typeof dueSummary.current_user_due_summary === 'object'
    ? asCircleRecord(dueSummary.current_user_due_summary)
    : dueSummary?.current_user_summary && typeof dueSummary.current_user_summary === 'object'
      ? asCircleRecord(dueSummary.current_user_summary)
      : {}
  const duesPresentation = describeCurrentUserDues(currentUserSummary)
  const periodsPaidCount = safeNumber(currentUserSummary?.periods_paid_count, 0)
  const dueStatusLabel = duePlanConfigured ? duesPresentation.amountLabel : 'Not configured'
  const currentPeriodLabel = String(
    asCircleRecord(dueSummary?.current_period)?.label ||
      dueSummary?.current_period_label ||
      dueSummary?.period_label ||
      ''
  ).trim()
  const governance = asCircleRecord(workspace?.governance)
  const settings = asCircleRecord(workspace?.settings)
  const governanceSummary = asCircleRecord(workspace?.governance_summary)
  const governanceCompleted = Boolean(
    governance?.governance_setup_completed ||
      workspace?.governance_setup_completed ||
      settings?.governance_setup_completed
  )
  const approvalThreshold = safeNumber(
    governance?.configured_withdrawal_approval_threshold ||
      governance?.required_withdrawal_approvals ||
      governance?.withdrawal_approval_threshold ||
      governanceSummary?.configured_withdrawal_approval_threshold ||
      governanceSummary?.required_withdrawal_approvals ||
      workspace?.withdrawal_approval_threshold,
    0
  )
  const approvalRuleValue = withdrawalRequiresApproval
    ? approvalThreshold > 0
      ? `${approvalThreshold} approval${approvalThreshold === 1 ? '' : 's'}`
      : 'Approval required'
    : 'No approval required'
  const memberCount = safeNumber(workspace?.member_count || workspace?.members_count || (Array.isArray(workspace?.members) ? workspace.members.length : 0), 0)
  const activeGoalCount = circleOsEnabled && circleOsClean ? circleOsGoals.length : 0
  const activeCampaignCount = circleOsEnabled && circleOsClean ? circleOsCampaigns.length : 0
  const connectedPeopleCount = safeNumber(circleOsPeople?.connected_members ?? circleOsPeople?.connected_count, 0)
  const moneySnapshotRows = [
    {
      title: 'Your dues',
      value: dueStatusLabel,
      helper: [
        currentPeriodLabel || null,
        duesPresentation.summaryLabel,
        periodsPaidCount > 0 ? `${periodsPaidCount} period${periodsPaidCount === 1 ? '' : 's'} paid` : null,
      ].filter(Boolean).join(' - ') || duesPresentation.helper || 'Member contribution status.',
      tone: ['overdue', 'current_due', 'open_balance'].includes(duesPresentation.state) ? 'warn' as const : duePlanConfigured ? 'good' as const : 'default' as const,
    },
    {
      title: 'Collections',
      value: `${previewItems.length} open`,
      helper: circleOsEnabled && circleOsClean
        ? [
            activeGoalCount > 0 ? `${activeGoalCount} goal${activeGoalCount === 1 ? '' : 's'}` : null,
            activeCampaignCount > 0 ? `${activeCampaignCount} campaign${activeCampaignCount === 1 ? '' : 's'}` : null,
            circleOsOutstandingMembers > 0 ? `${circleOsOutstandingMembers} member${circleOsOutstandingMembers === 1 ? '' : 's'} owing dues` : null,
          ].filter(Boolean).join(' · ') || 'Open collections and goals.'
        : 'Open collections and money goals.',
      tone: 'info' as const,
    },
    canManageTreasury
      ? {
          title: 'Shared Fund',
          value: 'Open Shared Fund',
          helper: 'View the fund balance and payout requests.',
          tone: 'default' as const,
          onPress: () => router.push(`/circles/${circleId}/treasury` as never),
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; value: string; helper?: string; tone: 'default' | 'good' | 'warn' | 'info'; onPress?: () => void }>
  const peopleSnapshotRows = [
    {
      title: 'Members with access',
      value: memberCount > 0 ? String(memberCount) : 'Unavailable',
      helper: 'BitBridge users in this Circle.',
      tone: 'default' as const,
    },
    connectedPeopleCount > 0
      ? {
          title: 'Connected',
          value: String(connectedPeopleCount),
          helper: 'People linked to BitBridge accounts.',
          tone: 'good' as const,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; value: string; helper?: string; tone: 'default' | 'good' | 'warn' | 'info' }>
  const decisionSnapshotRows = [
    {
      title: 'Decision rule',
      value: approvalRuleValue,
      helper: withdrawalRequiresApproval ? 'Withdrawals need approval.' : 'Withdrawals move without approval.',
      tone: withdrawalRequiresApproval ? 'info' as const : 'good' as const,
    },
    pendingApprovalCount > 0
      ? {
          title: 'Pending approvals',
          value: `${pendingApprovalCount}`,
          helper: canViewApprovalDetails ? 'Admins can review them.' : 'Only Circle admins can see the details.',
          tone: 'warn' as const,
        }
      : !governanceCompleted && canManageWorkspace
        ? {
            title: 'Decision setup',
            value: 'Pending',
            helper: 'Finish money rule setup.',
            tone: 'warn' as const,
          }
        : null,
  ].filter(Boolean) as Array<{ title: string; value: string; helper?: string; tone: 'default' | 'good' | 'warn' | 'info' }>
  const needsAttentionItems = [
    duePlanConfigured && ['overdue', 'current_due', 'open_balance'].includes(duesPresentation.state)
      ? {
          title: 'Dues need payment',
          value: dueStatusLabel,
          helper: duesPresentation.helper,
          tone: 'warn' as const,
          onPress: () => router.push(`/circles/${circleId}/pay` as never),
        }
      : null,
    pendingApprovalCount > 0
      ? {
          title: 'Decisions waiting',
          value: `${pendingApprovalCount}`,
          helper: canViewApprovalDetails ? 'Withdrawal approvals need review.' : 'There are pending Circle actions.',
          tone: 'warn' as const,
          onPress: canViewApprovalDetails
            ? () => router.push({ pathname: '/circles/[id]/manage', params: { id: String(circleId), section: 'governance' } } as never)
            : undefined,
        }
      : null,
    pendingPayoutCount > 0 && canManageTreasury
      ? {
          title: 'Payout requests waiting',
          value: `${pendingPayoutCount}`,
          helper: 'Open Shared Fund to review payout requests.',
          tone: 'warn' as const,
          onPress: () => router.push(`/circles/${circleId}/treasury` as never),
        }
      : null,
            circleOsEnabled && circleOsWarning
      ? {
          title: 'Records need review',
          value: 'Needs review',
          helper: String(circleOsNotes[0] || 'Payment records need review before summaries are shown.'),
          tone: 'warn' as const,
          onPress: () => router.push(`/circles/${circleId}/timeline` as never),
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string
    value: string
    helper?: string
    tone: 'default' | 'good' | 'warn' | 'info'
    onPress?: () => void
  }>
  const recentRecords = records.slice(0, 4)
  const handleRecordPress = useCallback(
    (record: CircleRecord) => {
      const decision = decideHomeNavigation(record)
      if (decision.type === 'receipt') {
        router.push({
          pathname: '/transaction/receipt',
          params: { reference: decision.reference },
        } as never)
        return
      }

      if (decision.type === 'timeline-detail') {
        router.push({
          pathname: '/circles/[id]/timeline/[eventId]',
          params: { id: String(circleId), eventId: decision.id },
        } as never)
        return
      }

      router.push(`/circles/${circleId}/timeline` as never)
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
        logoUrl={circleLogoUrl || String(workspace?.logo_url || '')}
        roleLabel={getCircleRoleLabel(workspace)}
        bucketLabel={circleBucketLabel(workspace)}
        active="home"
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => router.push(`/circles/${circleId}/members` as never)}
        onTreasury={() => router.push(`/circles/${circleId}/treasury` as never)}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
        showTreasuryTab={showTreasuryTab}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCircle(true)} />}
        >
          <CommandSection
            title="Recent activity"
            helper={recentRecords.length > 0 ? `${recentRecords.length} recent update${recentRecords.length === 1 ? '' : 's'}.` : 'Latest visible group activity.'}
            actionLabel="View all"
            onAction={() => router.push(`/circles/${circleId}/timeline` as never)}
          >
            {recentRecords.length ? (
              <RecentRecords records={recentRecords} onSelectRecord={handleRecordPress} framed={false} />
            ) : (
              <EmptyState label="No group activity yet. Payments, requests, and updates will appear here." />
            )}
          </CommandSection>

          <CommandSection
            title="Dues feed"
            helper="Only dues-related payments and reconciliations."
            actionLabel="Open"
            onAction={() => router.push(`/circles/${circleId}/timeline` as never)}
          >
            {duesRecords.length ? (
              <RecentRecords records={duesRecords.slice(0, 3)} onSelectRecord={handleRecordPress} framed={false} />
            ) : (
              <EmptyState label="No dues activity yet. Dues reconciliations will show up here." />
            )}
          </CommandSection>

          <CommandSection
            title="Records"
            helper="Review money flow summary and export dues or record CSVs."
            actionLabel="Open"
            onAction={() => router.push(`/circles/${circleId}/audit` as never)}
          >
            <StateRow
              title="Audit summary and exports"
              value="Open records"
              helper="CSV exports live here for members with access."
              tone="info"
              onPress={() => router.push(`/circles/${circleId}/audit` as never)}
            />
          </CommandSection>

          <CommandSection
            title="Needs attention"
            helper="The one thing that needs action right now."
            actionLabel={needsAttentionItems[0]?.onPress ? 'Open' : undefined}
            onAction={needsAttentionItems[0]?.onPress}
          >
            {needsAttentionItems.length ? (
              needsAttentionItems.map((item) => (
                <StateRow
                  key={item.title}
                  title={item.title}
                  value={item.value}
                  helper={item.helper}
                  tone={item.tone}
                  onPress={item.onPress}
                />
              ))
            ) : (
              <EmptyState label="Nothing needs attention right now." />
            )}
          </CommandSection>

          <CommandSection
            title="Payments"
            helper="Dues, collections, and payment options."
            actionLabel="Open"
            onAction={() => router.push(`/circles/${circleId}/pay` as never)}
          >
            {moneySnapshotRows.map((row) => (
              <StateRow
                key={row.title}
                title={row.title}
                value={row.value}
                helper={row.helper}
                tone={row.tone}
              />
            ))}
          </CommandSection>

          <CommandSection
            title="Members"
            helper="BitBridge users in this Circle."
            actionLabel="Open"
            onAction={() => router.push(`/circles/${circleId}/members` as never)}
          >
            {peopleSnapshotRows.map((row) => (
              <StateRow
                key={row.title}
                title={row.title}
                value={row.value}
                helper={row.helper}
                tone={row.tone}
              />
            ))}
          </CommandSection>

          <CommandSection
            title="Decisions"
            helper="How spending is approved."
            actionLabel="Open"
            onAction={() => router.push(`/circles/${circleId}/manage` as never)}
          >
            {decisionSnapshotRows.map((row) => (
              <StateRow
                key={row.title}
                title={row.title}
                value={row.value}
                helper={row.helper}
                tone={row.tone}
              />
            ))}
          </CommandSection>

        </ScrollView>
      </CircleShell>
    </>
  )
}

export default CircleHomeScreen

