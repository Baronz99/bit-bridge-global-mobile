/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCircleTreasuryInflow, getCircleWorkspace } from '@/api/circles'
import { CircleShell, circleBucketLabel, circleTitle } from '@/components/circles/rebuild'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { canAccessManageCircle, canViewSharedFundTab } from '@/utils/circleWorkspace'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import moneyFormat from '@/utils/moneyFormat'

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

const formatDate = (value: unknown) => {
  if (!value) return 'Unavailable'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  if (!cleanText(value)) return null
  return (
    <View className="mt-4">
      <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">{label}</Text>
      <Text className="mt-1 text-sm text-gray-200">{value}</Text>
    </View>
  )
}

const CircleTreasuryInflowDetailScreen = () => {
  const { id, inflowId } = useLocalSearchParams<{ id?: string | string[]; inflowId?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const resolvedInflowId = Array.isArray(inflowId) ? inflowId[0] : inflowId
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [inflow, setInflow] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [workspaceError, setWorkspaceError] = useState('')
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const loadDetail = useCallback(async (isRefresh = false, options?: { background?: boolean }) => {
    if (!circleId || !resolvedInflowId) return
    if (isRefresh) setRefreshing(true)
    else if (!(options?.background && hasLoadedOnce)) setLoading(true)
    setError('')
    setWorkspaceError('')
    try {
      const [workspaceResult, inflowResult] = await Promise.allSettled([
        getCircleWorkspace(circleId),
        getCircleTreasuryInflow(circleId, resolvedInflowId),
      ])

      if (workspaceResult.status === 'fulfilled') {
        setWorkspace(workspaceResult.value || {})
      } else {
        const workspaceFailure: any = workspaceResult.reason
        setWorkspaceError(
          buildApiErrorMessage({
            status: workspaceFailure?.response?.status,
            data: workspaceFailure?.response?.data,
            fallback: 'Unable to load this circle right now.',
          })
        )
      }

      if (inflowResult.status === 'fulfilled') {
        setInflow(asRecord(inflowResult.value?.data || inflowResult.value))
        setHasLoadedOnce(true)
      } else {
        const inflowFailure: any = inflowResult.reason
        setError(
          buildApiErrorMessage({
            status: inflowFailure?.response?.status,
            data: inflowFailure?.response?.data,
            fallback: 'Unable to load inflow review details right now.',
          })
        )
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [circleId, hasLoadedOnce, resolvedInflowId])

  useFocusEffect(
    useCallback(() => {
      void loadDetail(false, { background: hasLoadedOnce })
    }, [hasLoadedOnce, loadDetail])
  )

  const showAdminTab = canAccessManageCircle(workspace)
  const showTreasuryTab = canViewSharedFundTab(workspace)
  const reviewDetails = inflow?.review_details && typeof inflow.review_details === 'object' ? inflow.review_details : {}
  const reconciliationSummary = inflow?.reconciliation_summary && typeof inflow.reconciliation_summary === 'object'
    ? inflow.reconciliation_summary
    : {}
  const assignments = Array.isArray(reviewDetails.assignments) ? reviewDetails.assignments : []
  const allocations = Array.isArray(reviewDetails.allocations) ? reviewDetails.allocations : []
  const auditEvents = Array.isArray(reviewDetails.audit_events) ? reviewDetails.audit_events : []
  const activeAssignment = assignments.find((assignment: Record<string, any>) => assignment.active) || assignments[0] || null

  const handleOpenCorrection = useCallback(() => {
    if (!activeAssignment?.id) return

    router.push({
      pathname: `/circles/${circleId}/treasury/inflows` as any,
      params: {
        inflow_id: resolvedInflowId,
        assignment_id: String(activeAssignment.id),
        circle_person_id: String(activeAssignment.circle_person_id || ''),
        purpose_reference_type: String(activeAssignment.purpose_reference_type || ''),
        purpose_reference_id: String(activeAssignment.purpose_reference_id || ''),
        assignment_note: String(activeAssignment.assignment_note || ''),
      },
    } as any)
  }, [activeAssignment, circleId, resolvedInflowId, router])

  if (!circleId || !resolvedInflowId) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712]">
        <Text className="text-sm text-red-300">Missing inflow.</Text>
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

  if ((error || workspaceError) && !workspace) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712] px-6">
        <Text className="text-center text-sm text-red-300">{workspaceError || error}</Text>
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
          contentContainerStyle={{ paddingBottom: 120, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDetail(true)} />}
        >
          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Inflow review</Text>
            <Text className="mt-2 text-lg font-semibold text-white">Chain of custody</Text>
            <Text className="mt-2 text-sm text-gray-400">
              This view shows the live assignment history, active allocations, and audit trail for the selected inflow.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace(`/circles/${circleId}/treasury/inflows` as any)}
              className="mt-4 self-start rounded-full border border-white/10 bg-white/[0.04] px-4 py-2"
            >
              <Text className="text-white text-[11px] font-semibold">Back to queue</Text>
            </TouchableOpacity>
          </View>

          {workspaceError ? (
            <View className="rounded-[28px] border border-amber-400/20 bg-amber-400/10 px-5 py-5">
              <Text className="text-sm text-amber-100">{workspaceError}</Text>
            </View>
          ) : null}

          {error ? (
            <View className="rounded-[28px] border border-red-400/20 bg-red-400/10 px-5 py-5">
              <Text className="text-sm text-red-100">{error}</Text>
            </View>
          ) : null}

          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Inflow</Text>
            <Text className="mt-2 text-2xl font-semibold text-white">{formatCents(inflow?.amount_cents)}</Text>
            <Text className="mt-1 text-sm text-gray-400">{cleanText(inflow?.narration) || 'No narration provided'}</Text>
            <DetailRow label="Sender" value={cleanText(inflow?.sender_name) || 'External transfer'} />
            <DetailRow label="Reference" value={cleanText(inflow?.provider_transaction_id || inflow?.provider_reference)} />
            <DetailRow label="Status" value={`${formatStatus(inflow?.status)} - ${formatStatus(inflow?.settlement_status)}`} />
            <DetailRow label="Credited at" value={formatDate(inflow?.credited_at)} />
            <DetailRow label="Allocated / Remaining" value={`${formatCents(inflow?.allocated_amount_cents)} / ${formatCents(inflow?.remaining_amount_cents)}`} />
          </View>

          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Active summary</Text>
            <Text className="mt-2 text-base font-semibold text-white">
              {cleanText(reconciliationSummary?.reconciliation_label) || 'No reconciliation recorded'}
            </Text>
            <DetailRow label="Type" value={formatStatus(reconciliationSummary?.kind)} />
            <DetailRow label="Person" value={cleanText(reconciliationSummary?.person_label)} />
            <DetailRow label="Purpose" value={cleanText(reconciliationSummary?.purpose_label)} />
            <DetailRow label="Coverage" value={cleanText(reconciliationSummary?.reconciliation_coverage_label)} />
            <DetailRow label="Period range" value={cleanText(reconciliationSummary?.reconciliation_period_range_label)} />
            <DetailRow label="Assignment note" value={cleanText(reconciliationSummary?.assignment_note)} />
            {activeAssignment ? (
              <TouchableOpacity
                onPress={handleOpenCorrection}
                className="mt-4 self-start rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2"
              >
                <Text className="text-[11px] font-semibold text-cyan-100">Correct reconciliation</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Assignments</Text>
            {assignments.length === 0 ? (
              <Text className="mt-2 text-sm text-gray-400">No active or historical assignment records.</Text>
            ) : assignments.map((assignment: Record<string, any>) => (
              <View key={String(assignment.id)} className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-sm font-semibold text-white">{cleanText(assignment.circle_person_label) || 'Unlinked person'}</Text>
                <Text className="mt-1 text-xs text-gray-400">
                  {cleanText(assignment.purpose_label) || 'No purpose'}{assignment.active ? ' · active' : ' · historical'}
                </Text>
                <DetailRow label="Assigned by" value={cleanText(assignment.assigned_by_name)} />
                <DetailRow label="Note" value={cleanText(assignment.assignment_note)} />
                <DetailRow label="Created" value={formatDate(assignment.created_at)} />
              </View>
            ))}
          </View>

          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Allocations</Text>
            {allocations.length === 0 ? (
              <Text className="mt-2 text-sm text-gray-400">No active allocations recorded.</Text>
            ) : allocations.map((allocation: Record<string, any>) => (
              <View key={String(allocation.id)} className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-sm font-semibold text-white">{cleanText(allocation.circle_person_label) || 'Unlinked person'}</Text>
                <Text className="mt-1 text-xs text-gray-400">
                  {formatCents(allocation.amount_cents)} · {cleanText(allocation.receivable_kind)} {cleanText(allocation.receivable_period_key)}
                </Text>
                <DetailRow label="Due on" value={formatDate(allocation.receivable_due_on)} />
                <DetailRow label="Assigned by" value={cleanText(allocation.assigned_by_name)} />
                <DetailRow label="Note" value={cleanText(allocation.note)} />
              </View>
            ))}
          </View>

          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Audit trail</Text>
            {auditEvents.length === 0 ? (
              <Text className="mt-2 text-sm text-gray-400">No audit events available.</Text>
            ) : auditEvents.map((event: Record<string, any>) => (
              <View key={String(event.id)} className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                <Text className="text-sm font-semibold text-white">{formatStatus(event.event_type)}</Text>
                <Text className="mt-1 text-xs text-gray-400">{formatDate(event.created_at)}</Text>
                <DetailRow label="Actor" value={cleanText(event.actor_name)} />
              </View>
            ))}
          </View>
        </ScrollView>
      </CircleShell>
    </>
  )
}

export default CircleTreasuryInflowDetailScreen
