import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getBusinessEntities } from '@/api/business'
import {
  approveCircleApprovalRequest,
  getCircle,
  getCircleDuePlan,
  getCirclePaymentItems,
  getCircleSettings,
  getCircleWorkspace,
  listCircles,
  listCircleApprovalRequests,
  reactToCircleTx,
  rejectCircleApprovalRequest,
  updateCircleDuePlan,
  unreactToCircleTx,
  upsertCircleDuePlan,
} from '@/api/circles'
import { FEATURE_CIRCLES } from '@/constants/featureFlags'
import moneyFormat from '@/utils/moneyFormat'
import { Ionicons } from '@expo/vector-icons'
import MemberAvatars from '@/components/circles/MemberAvatars'
import NotificationAlert from '@/components/notification'
import WorkspaceSwitcherModal, {
  WorkspaceBusiness,
  WorkspaceCircle,
} from '@/components/workspace/WorkspaceSwitcherModal'
import { useActiveAccount } from '@/services/useActiveAccount'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { extractCirclePayload, extractCircleRecentActivity } from '@/utils/circleWorkspace'
import { getCircleTypeConfig } from '@/utils/circleTypeConfig'

const REACTION_OPTIONS = ['??', '??', '??'] as const

type NoticeState = {
  message: string | null
  error: boolean
  data: any | null
}

const getArray = (value: unknown) => (Array.isArray(value) ? value : [])
const formatLabel = (value: string, fallback = 'Member') =>
  String(value || fallback)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const extractCircle = (payload: unknown) => extractCirclePayload(payload)

const extractRecentTransactions = (payload: unknown) => getArray(extractCircleRecentActivity(payload))

const getTitle = (circle: Record<string, unknown>) => {
  return (circle.name as string) || (circle.title as string) || 'Circle'
}

const getDescription = (circle: Record<string, unknown>) => {
  return (circle.description as string) || (circle.summary as string) || ''
}

const getInitials = (value: string) => {
  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const maskEmail = (value: string) => {
  const clean = value.trim()
  if (!clean || !clean.includes('@')) return clean
  const [local, domain] = clean.split('@')
  if (!domain) return clean
  const visible = local.slice(0, 2)
  const hidden = local.length > 2 ? '*'.repeat(Math.max(2, local.length - 2)) : '**'
  return `${visible}${hidden}@${domain}`
}

const formatUsername = (value: string) => {
  const clean = value.trim().replace(/^@+/, '')
  return clean ? `@${clean}` : ''
}

const resolveIdentity = (user?: Record<string, unknown>) => {
  const displayName = ((user?.display_name as string) || '').trim()
  const fallbackName = ((user?.fallback_name as string) || '').trim()
  const adminIdentityName = ((user?.admin_identity_name as string) || '').trim()
  const username = ((user?.username as string) || '').trim()
  const firstName = ((user?.first_name as string) || '').trim()
  const lastName = ((user?.last_name as string) || '').trim()
  const fullName = `${firstName} ${lastName}`.trim()
  const email = ((user?.email as string) || '').trim()

  const primary =
    displayName || formatUsername(username) || fullName || (email ? maskEmail(email) : 'Member')
  const secondary =
    adminIdentityName || fallbackName || (displayName && fullName && fullName !== displayName ? fullName : '')

  return {
    primary,
    secondary,
    maskedEmail: email ? maskEmail(email) : '',
  }
}

const directionLabel = (value: string) => {
  const normalized = value.toLowerCase()
  if (normalized === 'credit' || normalized === 'in') return 'Inflow'
  if (normalized === 'debit' || normalized === 'out') return 'Outflow'
  if (normalized === 'payout') return 'Payout'
  return normalized || 'Movement'
}

const directionPill = (value: string) => {
  const normalized = value.toLowerCase()
  if (normalized === 'credit' || normalized === 'in') return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
  if (normalized === 'debit' || normalized === 'out' || normalized === 'payout') {
    return 'bg-rose-500/15 border-rose-500/40 text-rose-300'
  }
  return 'bg-sky-500/15 border-sky-500/40 text-sky-300'
}

const resolveActivityType = (record: Record<string, unknown>) => {
  const meta = (record.meta as Record<string, unknown> | undefined) || undefined
  return String(record.activity_type || meta?.normalized_activity_type || '').toLowerCase()
}

const resolveDirectionValue = (record: Record<string, unknown>) => {
  const meta = (record.meta as Record<string, unknown> | undefined) || undefined
  return String(record.direction || meta?.direction || record.kind || '').toLowerCase() || 'activity'
}

const resolveReactionTargetId = (record: Record<string, unknown>) => {
  const meta = (record.meta as Record<string, unknown> | undefined) || undefined
  const candidate = String(meta?.circle_transaction_id || record.id || '').trim()
  return candidate
}

const sumReactions = (counts: Record<string, number> | undefined) => {
  if (!counts) return 0
  return Object.values(counts).reduce((acc, value) => acc + Number(value || 0), 0)
}

const formatTimestamp = (value: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getTierRank = (value: unknown) => {
  const normalized = String(value || 'tier_0').toLowerCase()
  if (normalized.includes('tier_4')) return 4
  if (normalized.includes('tier_3')) return 3
  if (normalized.includes('tier_2')) return 2
  if (normalized.includes('tier_1')) return 1
  return 0
}

const buildActionText = (actor: string, direction: string, kind: string) => {
  const normalizedDirection = direction.toLowerCase()
  const normalizedKind = kind.toLowerCase()
  if (normalizedKind === 'fund' || normalizedDirection === 'credit' || normalizedDirection === 'in') {
    return `${actor} funded the circle`
  }
  if (normalizedKind === 'payout' || normalizedDirection === 'debit' || normalizedDirection === 'out') {
    return `${actor} paid out to the main wallet`
  }
  return `${actor} moved money in the group`
}

type SegmentTab = 'timeline' | 'activities' | 'about'
type SettingsSection = 'membership' | 'operations' | 'governance'
type WorkspaceMode = 'member' | 'manage'

const DUE_WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const

const DUE_ROLE_OPTIONS = [
  { value: 'member', label: 'Members' },
  { value: 'treasurer', label: 'Treasurers' },
  { value: 'admin', label: 'Admins' },
] as const

const formatMinorUnitsToMajorUnitString = (value: unknown) => {
  if (value === null || value === undefined || value === '') return ''
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  return String(amount / 100)
}

const parseMajorUnitInputToMinorUnits = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/,/g, '').trim()
  if (!normalized) return null
  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 100)
}

type CircleHeaderProps = {
  title: string
  description: string
  memberCount: number
  role: string
  bucketLabel: string
  typeLabel: string
  duesRecommended: boolean
  ownerLabel: string
  ownerMaskedEmail: string
  canWithdraw: boolean
  canInvite: boolean
  balanceVisible: boolean
  balanceCents: number
  currency: string
  memberInitials: string[]
  onInvite: () => void
  isOfficial: boolean
  badgeLabel: string
  isFlexibleOfficial: boolean
  isOfficialFeatured: boolean
  isTier1User: boolean
  maxContributionCents: number
  showWithdrawHint: boolean
}

const CircleHeader = ({
  title,
  description,
  memberCount,
  role,
  bucketLabel,
  typeLabel,
  duesRecommended,
  ownerLabel,
  ownerMaskedEmail,
  canWithdraw,
  canInvite,
  balanceVisible,
  balanceCents,
  currency,
  memberInitials,
  onInvite,
  isOfficial,
  badgeLabel,
  isFlexibleOfficial,
  isOfficialFeatured,
  isTier1User,
  maxContributionCents,
  showWithdrawHint,
}: CircleHeaderProps) => {
  return (
    <View className={`rounded-3xl border p-5 ${isOfficial ? 'border-amber-500/30 bg-[#16110a]' : 'border-gray-800 bg-gray-900/80'}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-row items-start gap-3 flex-1 min-w-0">
          <View className={`h-12 w-12 rounded-full items-center justify-center border ${isOfficial ? 'bg-[#261c0c] border-amber-500/20' : 'bg-gray-800 border-gray-700'}`}>
            <Text className="text-white text-sm font-semibold">{getInitials(title || 'BB')}</Text>
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-white text-xl font-semibold" numberOfLines={2}>
              {title}
            </Text>
            {description ? (
              <Text className="text-gray-300 text-xs mt-1 leading-5" numberOfLines={3}>
                {description}
              </Text>
            ) : null}
            <View className="flex-row flex-wrap gap-2 mt-2">
              <View className="rounded-full border border-gray-700 bg-gray-950 px-2 py-1">
                <Text className="text-[10px] text-gray-200 uppercase">{bucketLabel}</Text>
              </View>
              <View className="rounded-full border border-gray-700 bg-gray-950 px-2 py-1">
                <Text className="text-[10px] text-gray-300 uppercase">{typeLabel}</Text>
              </View>
              {duesRecommended ? (
                <View className="rounded-full border border-sky-500/35 bg-sky-500/10 px-2 py-1">
                  <Text className="text-[10px] text-sky-100 uppercase">Dues recommended</Text>
                </View>
              ) : null}
              {isOfficial ? (
                <View className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-1">
                  <Text className="text-[10px] text-amber-100 uppercase">Official BitBridge Circle</Text>
                </View>
              ) : null}
              {isOfficial && badgeLabel ? (
                <View className="rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-1">
                  <Text className="text-[10px] text-fuchsia-100 uppercase">{badgeLabel}</Text>
                </View>
              ) : null}
              {isOfficialFeatured ? (
                <View className="rounded-full border border-amber-500/20 bg-white/5 px-2 py-1">
                  <Text className="text-[10px] text-amber-50 uppercase">Featured</Text>
                </View>
              ) : null}
            </View>
            <Text className="text-gray-400 text-[10px] mt-2">
              {memberCount} members ? {role}
            </Text>
          </View>
        </View>
        {canInvite ? (
          <TouchableOpacity
            onPress={onInvite}
            className="h-9 w-9 rounded-full border border-gray-800 bg-gray-950 items-center justify-center shrink-0"
          >
            <Ionicons name="share-outline" size={18} color="#e2e8f0" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View className="mt-4">
        <View>
          {balanceVisible ? (
            <>
              <Text className="text-gray-400 text-[10px] uppercase tracking-widest">Circle balance</Text>
              <Text className="text-white text-2xl font-semibold mt-2">
                {moneyFormat(balanceCents / 100, currency)}
              </Text>
            </>
          ) : (
            <>
              <Text className="text-amber-100/80 text-[10px] uppercase tracking-widest">Managed campaign</Text>
              <Text className="text-white text-base font-semibold mt-2">
                Campaign balance is visible to circle managers only
              </Text>
              <Text className="text-amber-100/70 text-[11px] mt-2 leading-5 max-w-[220px]">
                Follow milestones, member activity, and your own contributions from here.
              </Text>
            </>
          )}
        </View>
        <View className="mt-3 items-start">
          {ownerLabel ? (
            <Text className="text-gray-500 text-[10px]">Creator: {ownerLabel}</Text>
          ) : null}
          {ownerMaskedEmail && ownerMaskedEmail !== ownerLabel ? (
            <Text className="text-gray-500 text-[10px] mt-1">Contact: {ownerMaskedEmail}</Text>
          ) : null}
          {showWithdrawHint ? (
            <Text className="text-gray-500 text-[10px] mt-1">Withdrawals are for creators/admins.</Text>
          ) : null}
        </View>
      </View>

      {isFlexibleOfficial && isTier1User && maxContributionCents > 0 ? (
        <View className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
          <Text className="text-amber-100 text-xs">
            You can contribute up to {moneyFormat(maxContributionCents / 100, currency)} with your current verification level.
          </Text>
          <Text className="text-gray-300 text-[10px] mt-1">
            Complete verification to unlock higher contributions.
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between mt-4">
        <MemberAvatars initials={memberInitials} size={32} />
        <View className="flex-row gap-2">
          <View className="bg-gray-950 border border-gray-800 rounded-full px-2 py-1">
            <Text className="text-[10px] text-gray-300">Circle feed</Text>
          </View>
          <View className="bg-gray-950 border border-gray-800 rounded-full px-2 py-1">
            <Text className="text-[10px] text-gray-300">Live updates</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

type ActionChipsProps = {
  showWithdraw: boolean
  canWithdraw: boolean
  canInvite: boolean
  canViewAudit: boolean
  pendingApprovalCount: number
  onFund: () => void
  onWithdraw: () => void
  onActivities: () => void
  onAudit: () => void
  onInvite: () => void
  onApprovals?: () => void
  fundLabel: string
  withdrawLabel: string
  activityLabel: string
}

const ActionChips = ({
  showWithdraw,
  canWithdraw,
  canInvite,
  canViewAudit,
  pendingApprovalCount,
  onFund,
  onWithdraw,
  onActivities,
  onAudit,
  onInvite,
  onApprovals,
  fundLabel,
  withdrawLabel,
  activityLabel,
}: ActionChipsProps) => {
  return (
    <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
      <Text className="text-white text-base font-semibold mb-3">Quick actions</Text>
      <View className="flex-row gap-3">
        <TouchableOpacity onPress={onFund} className="flex-1 bg-app-primary py-3 rounded-full items-center">
          <Text className="text-black text-xs font-semibold">{fundLabel}</Text>
        </TouchableOpacity>
        {showWithdraw ? (
          <TouchableOpacity
            onPress={onWithdraw}
            className={`flex-1 py-3 rounded-full items-center ${canWithdraw ? 'bg-gray-800' : 'bg-gray-700'}`}
            disabled={!canWithdraw}
          >
            <Text className="text-white text-xs font-semibold">{withdrawLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-2 mt-3">
        <TouchableOpacity onPress={onActivities} className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full">
          <Text className="text-white text-xs">{activityLabel}</Text>
        </TouchableOpacity>
        {canViewAudit ? (
          <TouchableOpacity onPress={onAudit} className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full">
            <Text className="text-white text-xs">Audit</Text>
          </TouchableOpacity>
        ) : null}
        {canInvite ? (
          <TouchableOpacity onPress={onInvite} className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full">
            <Text className="text-white text-xs">Invite</Text>
          </TouchableOpacity>
        ) : null}
        {pendingApprovalCount > 0 && onApprovals ? (
          <TouchableOpacity onPress={onApprovals} className="bg-amber-500/10 border border-amber-500/35 px-3 py-2 rounded-full">
            <Text className="text-amber-100 text-xs">Approvals {pendingApprovalCount}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const MonthlyDueCard = ({
  duePlan,
  onPay,
  dueLabel,
  dueHelper,
  payLabel,
}: {
  duePlan: Record<string, any>
  onPay: () => void
  dueLabel: string
  dueHelper: string
  payLabel: string
}) => {
  const obligation = (duePlan?.current_user_obligation ?? null) as Record<string, any> | null
  const amountCents = Number(duePlan?.amount_cents || obligation?.amount_cents || 0)
  const status = String(obligation?.status || 'pending')
  const dueOn = String(obligation?.due_on || duePlan?.current_cycle_due_on || '')
  const paid = status === 'paid'
  const summary = (duePlan?.current_user_due_summary ?? {}) as Record<string, any>
  const payablePeriodsCount = Number(summary?.payable_periods_count || summary?.payable_months_count || 0)
  const overduePeriodsCount = Number(summary?.overdue_periods_count || 0)
  const prepaidThroughLabel = String(summary?.prepaid_through_label || '').trim()
  const totalOpenAmountCents = Number(summary?.total_open_amount_cents || 0)
  const multiPeriodAvailable = !paid && payablePeriodsCount > 1
  const currentPeriodLabel = String(duePlan?.current_period_label || '').trim()

  return (
    <View className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-white text-base font-semibold">{dueLabel}</Text>
          <Text className="text-sky-100 text-xs mt-1">
            {dueHelper}
          </Text>
        </View>
        <View className={`px-3 py-1 rounded-full border ${paid ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-sky-500/35 bg-gray-950/30'}`}>
          <Text className={`text-[10px] uppercase ${paid ? 'text-emerald-200' : 'text-sky-100'}`}>{status}</Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-end justify-between">
        <View>
          <Text className="text-gray-400 text-[10px] uppercase tracking-widest">Current due</Text>
          <Text className="text-white text-xl font-semibold mt-2">{moneyFormat(amountCents / 100)}</Text>
          {currentPeriodLabel ? <Text className="text-gray-400 text-xs mt-2">{currentPeriodLabel}</Text> : null}
          {dueOn ? <Text className="text-gray-400 text-xs mt-2">Due on {formatTimestamp(dueOn)}</Text> : null}
          {overduePeriodsCount > 0 ? (
            <Text className="text-amber-100 text-xs mt-2">
              {overduePeriodsCount} overdue period{overduePeriodsCount === 1 ? '' : 's'}
            </Text>
          ) : null}
          {prepaidThroughLabel ? (
            <Text className="text-emerald-100 text-xs mt-2">Prepaid through {prepaidThroughLabel}</Text>
          ) : null}
          {multiPeriodAvailable ? (
            <Text className="text-sky-100 text-xs mt-2">
              {payablePeriodsCount} open periods available, total {moneyFormat(totalOpenAmountCents / 100)}
            </Text>
          ) : null}
        </View>
        {!paid ? (
          <TouchableOpacity onPress={onPay} className="bg-app-primary px-4 py-3 rounded-full">
            <Text className="text-black text-xs font-semibold">{payLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const SettingsSectionPills = ({
  activeSection,
  onChange,
}: {
  activeSection: SettingsSection
  onChange: (section: SettingsSection) => void
}) => (
  <View className="flex-row flex-wrap gap-2">
    {[
      { key: 'membership', label: 'My Membership' },
      { key: 'operations', label: 'Circle Operations' },
      { key: 'governance', label: 'Governance' },
    ].map((item) => {
      const active = activeSection === item.key
      return (
        <TouchableOpacity
          key={item.key}
          onPress={() => onChange(item.key as SettingsSection)}
          className={`rounded-full border px-3 py-2 ${
            active ? 'border-app-primary bg-app-primary/10' : 'border-gray-800 bg-gray-950'
          }`}
        >
          <Text className={`text-[11px] font-semibold ${active ? 'text-app-primary' : 'text-white'}`}>
            {item.label}
          </Text>
        </TouchableOpacity>
      )
    })}
  </View>
)

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-gray-400 text-[11px] uppercase tracking-[0.16em] mb-2">{children}</Text>
)

const InputField = ({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'numeric' | 'decimal-pad'
  editable?: boolean
}) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#64748B"
    keyboardType={keyboardType}
    editable={editable}
    className="h-11 rounded-xl border border-gray-800 bg-gray-950 px-4 text-white"
  />
)

const ApprovalQueueCard = ({
  requests,
  busyId,
  onApprove,
  onReject,
}: {
  requests: Record<string, any>[]
  busyId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) => {
  if (requests.length === 0) return null

  return (
    <View className="rounded-2xl border border-amber-500/25 bg-[#1b1407] p-4">
      <Text className="text-white text-base font-semibold">Pending approvals</Text>
      <Text className="text-amber-100 text-xs mt-1">Shared-manager withdrawals wait for another manager before money moves.</Text>

      <View className="mt-4 gap-3">
        {requests.slice(0, 3).map((request) => {
          const id = String(request.id)
          const busy = busyId === id
          return (
            <View key={id} className="rounded-2xl border border-gray-800 bg-gray-950/40 p-3">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-white text-sm font-semibold">{moneyFormat(Number(request.amount_cents || 0) / 100)}</Text>
                  {request.note ? <Text className="text-gray-300 text-xs mt-1">{String(request.note)}</Text> : null}
                  <Text className="text-gray-500 text-[10px] mt-2 uppercase">
                    {request.collected_approvals || 0}/{request.required_approvals || 0} approvals
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity disabled={busy} onPress={() => onReject(id)} className="px-3 py-2 rounded-full border border-rose-500/35 bg-rose-500/10">
                    <Text className="text-rose-100 text-xs">Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={busy} onPress={() => onApprove(id)} className="px-3 py-2 rounded-full bg-app-primary">
                    <Text className="text-black text-xs font-semibold">{busy ? '...' : 'Approve'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const SegmentTabs = ({
  activeTab,
  onChange,
}: {
  activeTab: SegmentTab
  onChange: (tab: SegmentTab) => void
}) => {
  return (
    <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-2">
      <View className="flex-row items-center gap-2">
        {(['timeline', 'activities', 'about'] as const).map((tab) => {
          const active = activeTab === tab
          const label = tab === 'timeline' ? 'Timeline' : tab === 'activities' ? 'Activities' : 'About'
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onChange(tab)}
              className={`flex-1 py-2 rounded-full border ${
                active ? 'bg-app-primary border-app-primary' : 'bg-gray-950 border-gray-800'
              }`}
            >
              <Text className={`text-xs text-center ${active ? 'text-black' : 'text-white'}`}>
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const paymentItemBadgeLabel = (item: Record<string, any>) => {
  const status = String(item?.status || '').toLowerCase()
  if (status === 'overdue' || status === 'payable_overdue') return 'Overdue'
  if (item?.is_payable_now) return 'Due now'
  if (status === 'current' || status === 'paid' || status === 'configured') return 'Paid up'
  if (item?.type === 'treasury_topup' || item?.required === false) return 'Optional'
  return 'Upcoming'
}

const paymentItemMeta = (item: Record<string, any>) => {
  const mode = String(item?.checkout_mode || '').toLowerCase()
  const rule =
    mode === 'recurring'
      ? 'Recurring'
      : mode === 'quantity'
        ? 'Quantity'
        : mode === 'fixed'
          ? 'Fixed'
          : item?.type === 'treasury_topup'
            ? 'Optional'
            : 'Open'
  const dueOn = String(item?.due_on || '').trim()
  const nextLabel = dueOn ? `Next ${formatTimestamp(dueOn)}` : ''
  return [rule, nextLabel].filter(Boolean).join(' · ')
}

const paymentItemAmountLabel = (item: Record<string, any>, currency: string) => {
  if (item?.amount_cents !== null && item?.amount_cents !== undefined) {
    return moneyFormat(Number(item.amount_cents || 0) / 100, currency)
  }
  return String(item?.checkout_mode || '').toLowerCase() === 'quantity' ? 'By quantity' : 'Open'
}

const paymentItemSourceLabel = (item: Record<string, any>) => {
  if (item?.linked_reference_type === 'CircleDuePlan' || item?.type === 'dues') return 'Recurring'
  if (item?.linked_reference_type === 'CircleActivity' || item?.type === 'activity_goal') return 'Collection'
  if (item?.type === 'treasury_topup') return 'Support'
  return 'Payment Item'
}

const templateActionLabel = (template: Record<string, any>) => {
  if (!template) return 'Open setup'
  if (template.disabled) return 'Coming later'
  if (template.setup_type === 'recurring') return 'Configure'
  return 'Add item'
}

const PAYMENT_TEMPLATES_BY_BUCKET: Record<string, Array<Record<string, any>>> = {
  clubs_teams: [
    { key: 'monthly_dues', title: 'Monthly Dues', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'match_fee', title: 'Match Fee', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'jersey', title: 'Jersey', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'general_support', title: 'General Support', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
  estates_communities: [
    { key: 'security_levy', title: 'Security Levy', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'utility_bill', title: 'Utility Bill', setup_type: 'activity', contribution_frequency: 'monthly' },
    { key: 'maintenance_levy', title: 'Maintenance Levy', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'emergency_support', title: 'Emergency Support', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
  families: [
    { key: 'welfare_support', title: 'Welfare Support', setup_type: 'activity', contribution_frequency: 'monthly' },
    { key: 'event_fund', title: 'Event Fund', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'emergency_contribution', title: 'Emergency Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
  associations: [
    { key: 'membership_dues', title: 'Membership Dues', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'event_contribution', title: 'Event Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'penalty_fee', title: 'Penalty Fee', setup_type: 'fine', disabled: true },
  ],
  cooperatives: [
    { key: 'savings_contribution', title: 'Savings Contribution', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'special_contribution', title: 'Special Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
}

type FeedItemProps = {
  record: Record<string, unknown>
  currency: string
  busyReaction: string | null
  onToggleReaction: (record: Record<string, unknown>, emoji: string) => void
  forceAnonymousActor?: boolean
}

const FeedItem = ({ record, currency, busyReaction, onToggleReaction, forceAnonymousActor = false }: FeedItemProps) => {
  const time = (record.occurred_at as string) || (record.created_at as string) || ''
  const amount = Number(record.amount_cents || 0) / 100
  const meta = (record.meta as Record<string, unknown> | undefined) || undefined
  const direction = resolveDirectionValue(record)
  const kind = String(meta?.circle_transaction_kind || record.kind || '')
  const actor = (record.actor as Record<string, unknown> | undefined) || (record.user as Record<string, unknown> | undefined)
  const actorIdentity = resolveIdentity(actor)
  const actorLabel = forceAnonymousActor ? 'Supporter' : actorIdentity.primary
  const actorInitials = getInitials(actorLabel || 'BB')
  const activityName = String(meta?.activity_name || ((record.circle_activity as Record<string, unknown> | undefined)?.name as string) || '')
  const reactions = record.reactions as Record<string, unknown> | undefined
  const reactionCounts = (reactions?.counts as Record<string, number> | undefined) || undefined
  const myReactions = getArray(reactions?.mine).map((value) => String(value))
  const reactionTotal = sumReactions(reactionCounts)
  const activityType = resolveActivityType(record)
  const actionText = String(
    record.payment_item_title ||
      record.payment_purpose_label ||
      record.label ||
      buildActionText(actorLabel, direction, kind)
  )
  const reactionTargetId = resolveReactionTargetId(record)
  const canReact = String(record.kind || '') === 'circle_transaction' && !!reactionTargetId

  return (
    <View className="bg-gray-900 p-4 rounded-2xl mb-3 border border-gray-800">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 rounded-full bg-gray-800 items-center justify-center border border-gray-700">
          <Text className="text-white text-[10px] font-semibold">{actorInitials}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-white text-sm font-semibold flex-1">{actionText}</Text>
            <Text className="text-white text-sm font-semibold">{moneyFormat(amount, currency)}</Text>
          </View>
          {!forceAnonymousActor && actorLabel ? (
            <Text className="text-sky-100 text-xs font-medium mt-2">{actorLabel}</Text>
          ) : null}
          <View className="flex-row items-center gap-2 mt-2 flex-wrap">
            {!forceAnonymousActor && actorIdentity.secondary ? (
              <Text className="text-gray-400 text-[11px]">{actorIdentity.secondary}</Text>
            ) : null}
            <View className={`px-2 py-0.5 rounded-full border ${directionPill(direction)}`}>
              <Text className="text-[10px] uppercase">{directionLabel(direction)}</Text>
            </View>
            {activityType ? (
              <View className="bg-gray-950 border border-gray-800 rounded-full px-2 py-0.5">
                <Text className="text-[10px] text-gray-300">{formatLabel(activityType, 'Activity')}</Text>
              </View>
            ) : null}
            {activityName ? (
              <View className="bg-gray-950 border border-gray-800 rounded-full px-2 py-0.5">
                <Text className="text-[10px] text-gray-300">Activity: {activityName}</Text>
              </View>
            ) : null}
          </View>
          <View className="flex-row items-center gap-4 mt-3 flex-wrap">
            {canReact
              ? REACTION_OPTIONS.map((emoji) => {
                  const active = myReactions.includes(emoji)
                  const count = Number(reactionCounts?.[emoji] || 0)
                  return (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => onToggleReaction(record, emoji)}
                      disabled={busyReaction === emoji}
                      className={`flex-row items-center gap-1 rounded-full border px-2 py-1 ${
                        active ? 'border-app-primary bg-app-primary/15' : 'border-gray-800 bg-gray-950'
                      }`}
                    >
                      <Text className="text-white text-base">{emoji}</Text>
                      <Text className={`text-[10px] font-semibold ${active ? 'text-app-primary' : 'text-gray-300'}`}>{count}</Text>
                    </TouchableOpacity>
                  )
                })
              : null}
            {time ? <Text className="text-gray-500 text-[10px]">{formatTimestamp(time)}</Text> : null}
          </View>
          {canReact ? <Text className="text-gray-500 text-[10px] mt-2">{reactionTotal} total reactions</Text> : null}
        </View>
      </View>
    </View>
  )
}

const CircleDetailScreen = () => {
  const { id, name, role: routeRole, memberCount: routeMemberCount, circleType, badgeLabel: routeBadgeLabel } = useLocalSearchParams<{
    id?: string | string[]
    name?: string | string[]
    role?: string | string[]
    memberCount?: string | string[]
    circleType?: string | string[]
    badgeLabel?: string | string[]
  }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const { activeAccount, selectBusinessAccount, selectCircleAccount, selectPersonalAccount } =
    useActiveAccount()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { userProfileData, onLogout } = useAuth()
  const [activeTab, setActiveTab] = useState<SegmentTab>('timeline')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<unknown>(null)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
  const [reactionBusyKey, setReactionBusyKey] = useState<string | null>(null)
  const [approvalRequests, setApprovalRequests] = useState<Record<string, any>[]>([])
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('membership')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('member')
  const [settingsPayload, setSettingsPayload] = useState<Record<string, any> | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [paymentItems, setPaymentItems] = useState<Record<string, any>[]>([])
  const [paymentItemsLoading, setPaymentItemsLoading] = useState(false)
  const [dueForm, setDueForm] = useState({
    amountNgn: '',
    cadence: 'monthly',
    dueDayOfMonth: '1',
    dueWeekday: '1',
    dueMonthOfYear: '1',
    gracePeriodDays: '0',
    startsOn: '',
    endsOn: '',
    enrolledRoles: ['member'] as string[],
  })
  const [dueSaving, setDueSaving] = useState(false)
  const [dueError, setDueError] = useState<string | null>(null)
  const [dueSuccess, setDueSuccess] = useState<string | null>(null)
  const [switchAccountOpen, setSwitchAccountOpen] = useState(false)
  const [businessLoading, setBusinessLoading] = useState(false)
  const [businessAccounts, setBusinessAccounts] = useState<WorkspaceBusiness[]>([])
  const [circlesLoading, setCirclesLoading] = useState(false)
  const [circleAccounts, setCircleAccounts] = useState<WorkspaceCircle[]>([])

  const applyDuePlanToForm = useCallback((plan?: Record<string, any> | null) => {
    if (!plan) {
      setDueForm((previous) => ({
        ...previous,
        amountNgn: '',
      }))
      return
    }

    setDueForm({
      amountNgn: formatMinorUnitsToMajorUnitString(plan.amount_cents),
      cadence: String(plan.cadence || 'monthly'),
      dueDayOfMonth: String(plan.due_day_of_month || '1'),
      dueWeekday: String(plan.due_weekday ?? '1'),
      dueMonthOfYear: String(plan.due_month_of_year || '1'),
      gracePeriodDays: String(plan.grace_period_days || '0'),
      startsOn: String(plan.starts_on || ''),
      endsOn: String(plan.ends_on || ''),
      enrolledRoles:
        Array.isArray(plan.enrolled_roles) && plan.enrolled_roles.length
          ? plan.enrolled_roles.map((value: unknown) => String(value))
          : ['member'],
    })
  }, [])

  const loadSettingsPayload = useCallback(async (targetCircleId: string | number) => {
    setSettingsLoading(true)
    try {
      const [settingsResponse, duePlanResponse] = await Promise.all([
        getCircleSettings(targetCircleId).catch(() => null),
        getCircleDuePlan(targetCircleId).catch(() => null),
      ])
      const settingsData = (settingsResponse?.data ?? settingsResponse ?? null) as Record<string, any> | null
      const duePlanData =
        (duePlanResponse?.data ?? duePlanResponse ?? null) as Record<string, any> | null

      if (settingsData) {
        setSettingsPayload(settingsData)
      }

      applyDuePlanToForm(duePlanData || settingsData?.operations?.due_plan || null)
    } finally {
      setSettingsLoading(false)
    }
  }, [applyDuePlanToForm])

  const loadPaymentItems = useCallback(async (targetCircleId: string | number) => {
    setPaymentItemsLoading(true)
    try {
      const response = await getCirclePaymentItems(targetCircleId)
      const payload = response?.data ?? response
      setPaymentItems(Array.isArray(payload) ? payload : [])
    } catch {
      setPaymentItems([])
    } finally {
      setPaymentItemsLoading(false)
    }
  }, [])

  const loadBusinessAccounts = useCallback(async () => {
    setBusinessLoading(true)
    try {
      const response = await getBusinessEntities()
      const entities = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
          ? response.data
          : []
      setBusinessAccounts(
        entities.map((item: any) => ({
          id: String(item?.id),
          name: String(item?.name || 'Business account'),
          status: String(item?.status || ''),
          current_user_role: String(item?.current_user_role || item?.role || ''),
        }))
      )
    } catch {
      setBusinessAccounts([])
    } finally {
      setBusinessLoading(false)
    }
  }, [])

  const loadCircleAccounts = useCallback(async () => {
    setCirclesLoading(true)
    try {
      const response = await listCircles()
      const payload = response?.data ?? response
      const items = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.circles)
          ? payload.circles
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.results)
              ? payload.results
              : Array.isArray(payload)
                ? payload
                : []
      setCircleAccounts(
        items
          .map((item: any) => ({
            id: String(item?.id || item?.circle_id || item?.uuid || '').trim(),
            name: String(item?.name || item?.title || 'Circle'),
            role: String(item?.current_user_role || item?.role || 'member'),
            circle_type: String(item?.circle_type || 'standard'),
            member_count: Number(item?.member_count ?? item?.members_count ?? 0),
          }))
          .filter((item: any) => item.id)
      )
    } catch {
      setCircleAccounts([])
    } finally {
      setCirclesLoading(false)
    }
  }, [])

  const openSwitchAccountModal = useCallback(() => {
    setSwitchAccountOpen(true)
    void loadBusinessAccounts()
    void loadCircleAccounts()
  }, [loadBusinessAccounts, loadCircleAccounts])

  const loadPendingApprovals = useCallback(async (payload: any) => {
    const isManager =
      payload?.current_user_role === 'owner' || payload?.current_user_role === 'admin'

    if (payload?.withdrawal_requires_approval === true && isManager) {
      try {
        const approvals = await listCircleApprovalRequests(circleId)
        const items = Array.isArray(approvals?.data) ? approvals.data : []
        setApprovalRequests(items.filter((item: any) => item?.status === 'pending'))
      } catch {
        setApprovalRequests([])
      }
      return
    }

    setApprovalRequests([])
  }, [circleId])

  const seedCirclePayload = useMemo(() => {
    const seedName = Array.isArray(name) ? name[0] : name
    const seedRole = Array.isArray(routeRole) ? routeRole[0] : routeRole
    const seedMemberCountRaw = Array.isArray(routeMemberCount) ? routeMemberCount[0] : routeMemberCount
    const seedCircleType = Array.isArray(circleType) ? circleType[0] : circleType
    const seedBadgeLabel = Array.isArray(routeBadgeLabel) ? routeBadgeLabel[0] : routeBadgeLabel
    const parsedMemberCount = Number(seedMemberCountRaw || 0)

    if (!seedName && !seedRole && !seedCircleType && !seedBadgeLabel && !parsedMemberCount) return null

    return {
      id: circleId,
      name: seedName || 'Circle',
      current_user_role: seedRole || 'member',
      role: seedRole || 'member',
      member_count: Number.isFinite(parsedMemberCount) ? parsedMemberCount : 0,
      circle_type: seedCircleType || 'standard',
      badge_label: seedBadgeLabel || '',
      recent_transactions: [],
      recent_activity: { items: [] },
    }
  }, [circleId, circleType, name, routeBadgeLabel, routeMemberCount, routeRole])

  const loadCircle = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (!circleId) return
    if (mode === 'initial') setLoading(true)
    if (mode === 'refresh') setRefreshing(true)
    if (mode !== 'silent') setError(null)

    let renderedBasePayload = false

    try {
      if (mode === 'initial' && !data && seedCirclePayload) {
        setData(seedCirclePayload)
        renderedBasePayload = true
        setLoading(false)

        void (async () => {
          try {
            const enriched = await getCircleWorkspace(circleId)
            setData(enriched)
            void loadPendingApprovals(enriched as any)
            void loadSettingsPayload(circleId)
          } catch {}
        })()

        return
      }

      if (mode === 'initial' && !data) {
        try {
          const base = await getCircle(circleId)
          setData(base)
          renderedBasePayload = true
          setLoading(false)
          void loadPendingApprovals(base as any)

          void (async () => {
            try {
              const enriched = await getCircleWorkspace(circleId)
              setData(enriched)
              void loadPendingApprovals(enriched as any)
              void loadSettingsPayload(circleId)
            } catch {}
          })()

          return
        } catch {}
      }

      const res = await getCircleWorkspace(circleId)
      setData(res)
      const payload = res as any
      if (mode === 'initial') setLoading(false)
      void loadPendingApprovals(payload)
      void loadSettingsPayload(circleId)
    } catch {
      if (!renderedBasePayload && mode !== 'silent') {
        setError('Unable to load this circle right now.')
      }
    } finally {
      if (mode === 'initial' && !renderedBasePayload) setLoading(false)
      if (mode === 'refresh') setRefreshing(false)
    }
  }, [circleId, data, loadPendingApprovals, loadSettingsPayload, seedCirclePayload])

  useFocusEffect(
    useCallback(() => {
      if (!FEATURE_CIRCLES || !circleId) return undefined
      loadCircle(data ? 'silent' : 'initial')
      void loadPaymentItems(circleId)
      return undefined
    }, [circleId, data, loadCircle, loadPaymentItems])
  )

  const circle = useMemo(() => extractCircle(data), [data])
  const recentTransactions = useMemo(() => extractRecentTransactions(data), [data])
  const title = getTitle(circle)
  const description = getDescription(circle)
  const balanceCents = Number(circle.treasury_balance_cents ?? circle.balance_cents ?? 0)
  const balanceVisible = circle.balance_visible !== false
  const currency = (circle.currency as string) || 'NGN'
  const isOfficial = circle.circle_type === 'official'
  const badgeLabel = ((circle.badge_label as string) || '').trim()
  const isFlexibleOfficial = isOfficial && circle.kyc_mode === 'flexible'
  const isOfficialFeatured = circle.visibility === 'official_featured'
  const isFoundersCircle = isOfficialFeatured && badgeLabel.toLowerCase().includes('founder')
  const maxContributionCents = Number(circle.max_contribution_cents || 0)
  const profileRoot = (userProfileData?.data ?? userProfileData) || {}
  const isTier1User = getTierRank(profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level) === 1
  const members = getArray(circle.members)
  const memberCount = members.length
  const role = (circle.current_user_role as string) || 'member'
  const isFoundersMemberView = isFoundersCircle && role !== 'owner' && role !== 'admin'
  const canWithdraw = circle?.permissions?.can_withdraw === true || circle.can_withdraw === true
  const canInvite =
    circle?.permissions?.can_invite_members === true || circle.can_invite === true
  const canViewAudit = !isFoundersCircle || role === 'owner' || role === 'admin'
  const canManageDuePlan = circle?.permissions?.can_manage_due_plan === true
  const canManageGovernance = circle?.permissions?.can_manage_governance === true
  const canViewReports = circle?.permissions?.can_view_reports === true
  const canPayDues = circle?.permissions?.can_pay_dues === true
  const hasManageAccess = canManageDuePlan || canManageGovernance || canInvite || canWithdraw || canViewReports
  const typeProfile =
    (circle.circle_type_profile as Record<string, unknown> | undefined) || {}
  const circleTypeConfig = getCircleTypeConfig(
    typeProfile.normalized_archetype || circle.circle_archetype
  )
  const bucketLabel = String(typeProfile.product_bucket_label || circleTypeConfig.label).trim()
  const productBucketKey = String(typeProfile.product_bucket_key || '').trim()
  const typeLabel = String(typeProfile.type_label || circleTypeConfig.shortLabel).trim()
  const circleSubtitle = String(typeProfile.subtitle || description || circleTypeConfig.subtitle).trim()
  const adaptiveLabels =
    (typeProfile.adaptive_labels as Record<string, unknown> | undefined) || {}
  const contributionLabel = String(
    adaptiveLabels.contribution_label || circleTypeConfig.contributionLabel
  ).trim()
  const payoutLabel = String(adaptiveLabels.payout_label || circleTypeConfig.payoutLabel).trim()
  const activityLabel = String(adaptiveLabels.activity_label || circleTypeConfig.activityLabel).trim()
  const dueLabel = String(adaptiveLabels.due_label || circleTypeConfig.dueLabel).trim()
  const activityHelper = String(circleTypeConfig.activityHelper).trim()
  const timelineLabel = String(circleTypeConfig.timelineLabel).trim()
  const duesRecommended = Boolean(typeProfile.due_plan_recommended)
  const duePlan =
    (circle.dues_summary as Record<string, any> | undefined) ||
    (circle.monthly_due_plan as Record<string, any> | undefined) ||
    null
  const membershipSettings =
    (settingsPayload?.membership as Record<string, any> | undefined) || {}
  const operationsSettings =
    (settingsPayload?.operations as Record<string, any> | undefined) || {}
  const owner = circle.owner as Record<string, unknown> | undefined
  const ownerIdentity = resolveIdentity(owner)
  const ownerLabel = ownerIdentity.primary
  const ownerMaskedEmail = ownerIdentity.maskedEmail
  const createdAt = (circle.created_at as string) || ''
  const isActiveCircleHome =
    activeAccount?.type === 'circle' && String(activeAccount.circleId || '') === String(circleId || '')
  const activeIdentityName = title || 'Circle'
  const dueSummary = (duePlan?.current_user_due_summary ?? {}) as Record<string, any>
  const dueStatus = String(duePlan?.current_user_obligation?.status || '')
  const dueNextDateLabel = formatTimestamp(
    String(duePlan?.current_user_obligation?.due_on || duePlan?.current_cycle_due_on || '')
  )
  const duePrepaidThroughLabel = String(dueSummary?.prepaid_through_label || '').trim()
  const dueOutstandingCents = Number(dueSummary?.total_open_amount_cents || 0)
  const dueOverduePeriodsCount = Number(dueSummary?.overdue_periods_count || 0)
  const selectedBusiness =
    activeAccount.type === 'business'
      ? businessAccounts.find((item) => String(item.id) === String(activeAccount.businessId)) || null
      : null
  const selectedCircleWorkspace =
    activeAccount.type === 'circle'
      ? circleAccounts.find((item) => String(item.id) === String(activeAccount.circleId)) || null
      : null
  const activeIdentityBadge =
    activeAccount.type === 'business'
      ? 'Business'
      : activeAccount.type === 'circle'
        ? 'Circle'
        : 'Personal'
  const activeIdentityMeta =
    activeAccount.type === 'business'
      ? [
          selectedBusiness?.current_user_role
            ? formatLabel(String(selectedBusiness.current_user_role), 'Member')
            : null,
          selectedBusiness?.status
            ? formatLabel(String(selectedBusiness.status), 'Setup')
            : null,
        ]
          .filter(Boolean)
          .join(' / ')
      : activeAccount.type === 'circle'
        ? [
            selectedCircleWorkspace?.member_count && selectedCircleWorkspace.member_count > 0
              ? `${selectedCircleWorkspace.member_count} members`
              : null,
            selectedCircleWorkspace?.role
              ? formatLabel(String(selectedCircleWorkspace.role), 'Member')
              : null,
          ]
            .filter(Boolean)
            .join(' / ')
        : 'Your personal wallet, cards, and direct activity'

  const memberInitials = members
    .map((member) => {
      const record = (member ?? {}) as Record<string, unknown>
      const user = record.user as Record<string, unknown> | undefined
      const displayName = resolveIdentity(user).primary
      return getInitials(displayName)
    })
    .slice(0, 3)

  const visibleRecentTransactions = useMemo(
    () =>
      recentTransactions.filter((item) => {
        if (!isFoundersMemberView) return true
        const record = (item ?? {}) as Record<string, unknown>
        const direction = resolveDirectionValue(record)
        const activityType = resolveActivityType(record)
        const kind = String(((record.meta as Record<string, unknown> | undefined) || {}).circle_transaction_kind || record.kind || '').toLowerCase()
        return !(kind === 'payout' || direction === 'debit' || direction === 'out' || activityType === 'withdrawal' || String(record.kind || '') === 'circle_approval')
      }),
    [isFoundersMemberView, recentTransactions]
  )

  useEffect(() => {
    if (workspaceMode === 'manage' && !hasManageAccess) setWorkspaceMode('member')
  }, [hasManageAccess, workspaceMode])

  const supportPaymentItem =
    paymentItems.find((item) => item?.support_fallback || item?.type === 'treasury_topup') || null
  const listedPaymentItems = paymentItems.filter((item) => String(item?.key || item?.id || '') !== String(supportPaymentItem?.key || supportPaymentItem?.id || ''))
  const suggestedPaymentTemplates = PAYMENT_TEMPLATES_BY_BUCKET[productBucketKey] || []

  const mergeReactionState = useCallback((txId: string, reactions: Record<string, unknown>) => {
    setData((previous: unknown) => {
      if (!previous || typeof previous !== 'object') return previous
      const container = previous as Record<string, unknown>
      const existingCircle = extractCircle(previous)
      const existingTransactions = extractRecentTransactions(previous)
      const updatedTransactions = existingTransactions.map((item) => {
        const record = (item ?? {}) as Record<string, unknown>
        const meta = (record.meta as Record<string, unknown> | undefined) || undefined
        const reactionTargetId = String(meta?.circle_transaction_id || record.id || '')
        if (reactionTargetId !== txId) return record
        return { ...record, reactions }
      })

      const nextRecentActivity = {
        ...((container.recent_activity as Record<string, unknown> | undefined) || {}),
        items: updatedTransactions,
      }

      if (container.data && typeof container.data === 'object') {
        return {
          ...container,
          data: {
            ...(container.data as Record<string, unknown>),
            recent_activity: nextRecentActivity,
            recent_transactions: updatedTransactions,
          },
        }
      }

      return {
        ...container,
        ...existingCircle,
        recent_activity: nextRecentActivity,
        recent_transactions: updatedTransactions,
      }
    })
  }, [])

  const handleToggleReaction = useCallback(async (record: Record<string, unknown>, emoji: string) => {
    const txId = resolveReactionTargetId(record)
    if (!txId || String(record.kind || '') !== 'circle_transaction') return

    const mine = getArray((record.reactions as Record<string, unknown> | undefined)?.mine).map((value) => String(value))
    const active = mine.includes(emoji)
    setReactionBusyKey(`${txId}:${emoji}`)
    setNotice({ message: null, error: false, data: null })

    try {
      const response = active ? await unreactToCircleTx(txId, emoji) : await reactToCircleTx(txId, emoji)
      const payload = response?.data ?? response
      if (payload?.reactions) {
        mergeReactionState(txId, payload.reactions as Record<string, unknown>)
      }
    } catch (reactionError: any) {
      const message = buildApiErrorMessage({
        status: reactionError?.response?.status,
        data: reactionError?.response?.data,
        fallback: reactionError?.message || 'Unable to update reaction right now.',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setReactionBusyKey(null)
    }
  }, [mergeReactionState])

  const handleApprovalDecision = useCallback(
    async (approvalRequestId: string, decision: 'approve' | 'reject') => {
      if (!circleId) return

      setApprovalBusyId(approvalRequestId)
      setNotice({ message: null, error: false, data: null })
      try {
        const response =
          decision === 'approve'
            ? await approveCircleApprovalRequest(circleId, approvalRequestId)
            : await rejectCircleApprovalRequest(circleId, approvalRequestId)
        const payload: any = response?.data ?? response
        setNotice({
          message: payload?.message || `Withdrawal ${decision}d.`,
          error: false,
          data: payload?.withdrawal || payload?.data || null,
        })
        await loadCircle('silent')
      } catch (approvalError: any) {
        const message = buildApiErrorMessage({
          status: approvalError?.response?.status,
          data: approvalError?.response?.data,
          fallback: approvalError?.message || `Unable to ${decision} this request.`,
        })
        setNotice({ message, error: true, data: null })
      } finally {
        setApprovalBusyId(null)
      }
    },
    [circleId, loadCircle]
  )

  const handleDueFormChange = useCallback(
    (field: keyof typeof dueForm, value: string) => {
      setDueError(null)
      setDueSuccess(null)
      setDueForm((previous) => ({
        ...previous,
        [field]: value,
      }))
    },
    [dueForm]
  )

  const toggleDueRole = useCallback((roleValue: string) => {
    setDueError(null)
    setDueSuccess(null)
    setDueForm((previous) => {
      const activeRoles = Array.isArray(previous.enrolledRoles) ? previous.enrolledRoles : []
      const nextRoles = activeRoles.includes(roleValue)
        ? activeRoles.filter((item) => item !== roleValue)
        : [...activeRoles, roleValue]

      return {
        ...previous,
        enrolledRoles: nextRoles.length ? nextRoles : ['member'],
      }
    })
  }, [])

  const handleSaveDuePlan = useCallback(async () => {
    if (!circleId || !canManageDuePlan) return

    try {
      setDueSaving(true)
      setDueError(null)
      setDueSuccess(null)

      const payload: Record<string, any> = {
        amount_cents: parseMajorUnitInputToMinorUnits(dueForm.amountNgn),
        cadence: dueForm.cadence,
        grace_period_days: Number(dueForm.gracePeriodDays || 0),
        starts_on: dueForm.startsOn || null,
        ends_on: dueForm.endsOn || null,
        enrolled_roles: dueForm.enrolledRoles,
      }

      if (dueForm.cadence === 'weekly') {
        payload.due_weekday = Number(dueForm.dueWeekday || 1)
      } else {
        payload.due_day_of_month = Number(dueForm.dueDayOfMonth || 1)
      }

      if (dueForm.cadence === 'yearly') {
        payload.due_month_of_year = Number(dueForm.dueMonthOfYear || 1)
      }

      const response = operationsSettings?.due_plan?.id
        ? await updateCircleDuePlan(circleId, payload)
        : await upsertCircleDuePlan(circleId, payload)
      const savedPlan = (response?.data ?? response ?? null) as Record<string, any> | null

      applyDuePlanToForm(savedPlan)
      setDueSuccess(savedPlan ? 'Dues plan saved.' : 'Dues plan updated.')
      await loadCircle('silent')
    } catch (saveError: any) {
      const message = buildApiErrorMessage({
        status: saveError?.response?.status,
        data: saveError?.response?.data,
        fallback: saveError?.message || 'Unable to save the dues plan right now.',
      })
      setDueError(message)
    } finally {
      setDueSaving(false)
    }
  }, [applyDuePlanToForm, canManageDuePlan, circleId, dueForm, loadCircle, operationsSettings?.due_plan?.id])

  const handleSetupDuePlanCta = useCallback(() => {
    setActiveTab('about')
    setSettingsSection('operations')
  }, [])

  const handlePayDueNow = useCallback(() => {
    if (!circleId || !canPayDues || !duePlan) return
    const obligationId = String(duePlan?.current_user_obligation?.id || '')
    const amountCents = Number(duePlan?.current_user_obligation?.amount_cents || duePlan?.amount_cents || 0)
    const payablePeriodsCount = Number(
      duePlan?.current_user_due_summary?.payable_periods_count ||
        duePlan?.current_user_due_summary?.payable_months_count ||
        1
    )

    router.push({
      pathname: `/circles/${circleId}/fund`,
      params: {
        dueMode: 'monthly',
        dueId: obligationId,
        dueAmountCents: String(amountCents),
        dueMonthsOpen: String(Math.max(payablePeriodsCount, 1)),
      },
    } as any)
  }, [canPayDues, circleId, duePlan, router])

  const handleOpenPaymentItem = useCallback(
    (item: Record<string, any> | null) => {
      if (!circleId || !item) return
      router.push({
        pathname: `/circles/${circleId}/fund`,
        params: {
          paymentItemKey: String(item.key || item.id || ''),
        },
      } as any)
    },
    [circleId, router]
  )

  const handleApplyTemplate = useCallback(
    (template: Record<string, any>) => {
      if (!circleId || !template || template.disabled) return

      if (template.setup_type === 'recurring') {
        setWorkspaceMode('manage')
        setActiveTab('about')
        setSettingsSection('operations')
        setDueError(null)
        setDueSuccess(null)
        setDueForm((previous) => ({
          ...previous,
          amountNgn: '',
          cadence: String(template.cadence || 'monthly'),
          dueDayOfMonth: '1',
          dueWeekday: '1',
          dueMonthOfYear: '1',
          gracePeriodDays: '0',
          startsOn: previous.startsOn || '',
          endsOn: '',
          enrolledRoles: ['member', 'admin', 'treasurer'],
        }))
        return
      }

      router.push({
        pathname: `/circles/${circleId}/activities`,
        params: {
          circleType: circleTypeConfig.key,
          circleName: title,
          templateName: String(template.title || ''),
          templateFrequency: String(template.contribution_frequency || 'one_time'),
        },
      } as any)
    },
    [circleId, circleTypeConfig.key, router, title]
  )

  const handleOpenPaymentItemManager = useCallback(
    (item: Record<string, any> | null) => {
      if (!circleId || !item) return

      if (item.linked_reference_type === 'CircleDuePlan' || item.type === 'dues') {
        setWorkspaceMode('manage')
        setActiveTab('about')
        setSettingsSection('operations')
        return
      }

      router.push({
        pathname: `/circles/${circleId}/activities`,
        params: { circleType: circleTypeConfig.key, circleName: title },
      } as any)
    },
    [circleId, circleTypeConfig.key, router, title]
  )

  if (!FEATURE_CIRCLES) {
    return (
      <View className="flex-1 bg-primary justify-center items-center px-6">
        <Text className="text-white text-base">Circles are not available yet.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary">
      <Stack.Screen
        options={
          isActiveCircleHome
            ? { headerShown: false }
            : { headerShown: true, headerTitle: title || 'Circle' }
        }
      />
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="small" color="#ffcc00" />
          <Text className="text-white mt-3">Loading circle...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-white text-center mb-4">{error}</Text>
          <TouchableOpacity
            onPress={() => loadCircle('initial')}
            className="bg-orange-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCircle('refresh')} />}
        >
          {isActiveCircleHome ? (
            <View className="px-4" style={{ paddingTop: Math.max(insets.top, 12) + 8 }}>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-white text-base font-semibold">{title}</Text>
                  <Text className="text-slate-400 text-xs mt-1">Circle account</Text>
                </View>
                <TouchableOpacity
                  onPress={openSwitchAccountModal}
                  activeOpacity={0.85}
                  className="max-w-[62%] rounded-full border border-white/8 bg-[#111827]/72 px-3 py-2"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-white/[0.05]">
                      <Ionicons name="people-outline" size={15} color="#7DD3FC" />
                    </View>
                    <View className="max-w-[74%]">
                      <Text className="text-white text-[13px] font-semibold" numberOfLines={1}>
                        {activeIdentityName}
                      </Text>
                      <View className="mt-0.5 flex-row items-center gap-1.5">
                        <View className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                        <Text className="text-[10px] uppercase tracking-[0.16em] text-slate-400" numberOfLines={1}>
                          Circle
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-down" size={15} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View className="px-4 pt-6 pb-2">
            <CircleHeader
              title={title}
              description={circleSubtitle}
              memberCount={memberCount}
              role={role}
              bucketLabel={bucketLabel}
              typeLabel={typeLabel}
              duesRecommended={duesRecommended}
              ownerLabel={ownerLabel}
              ownerMaskedEmail={ownerMaskedEmail}
              canWithdraw={canWithdraw}
              canInvite={canInvite}
              balanceVisible={balanceVisible}
              balanceCents={balanceCents}
              currency={currency}
              memberInitials={memberInitials}
              onInvite={() => {
                if (canInvite) router.push(`/circles/${circleId}/invite`)
              }}
              isOfficial={isOfficial}
              badgeLabel={badgeLabel}
              isFlexibleOfficial={isFlexibleOfficial}
              isOfficialFeatured={isOfficialFeatured}
              isTier1User={isTier1User}
              maxContributionCents={maxContributionCents}
              showWithdrawHint={!canWithdraw && !isFoundersMemberView}
            />
          </View>

          <View className="px-4 mt-4">
            <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
          </View>

          {hasManageAccess ? (
            <View className="px-4 mt-4">
              <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-2">
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setWorkspaceMode('member')}
                    className={`flex-1 rounded-full border py-2 ${workspaceMode === 'member' ? 'border-app-primary bg-app-primary' : 'border-gray-800 bg-gray-950'}`}
                  >
                    <Text className={`text-center text-xs font-semibold ${workspaceMode === 'member' ? 'text-black' : 'text-white'}`}>
                      Home
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setWorkspaceMode('manage')}
                    className={`flex-1 rounded-full border py-2 ${workspaceMode === 'manage' ? 'border-app-primary bg-app-primary' : 'border-gray-800 bg-gray-950'}`}
                  >
                    <Text className={`text-center text-xs font-semibold ${workspaceMode === 'manage' ? 'text-black' : 'text-white'}`}>
                      Manage
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {workspaceMode === 'member' ? (
            <>
              <View className="px-4 mt-4">
                <TouchableOpacity
                  onPress={() => router.push(`/circles/${circleId}/fund`)}
                  className="bg-app-primary py-4 rounded-full items-center"
                >
                  <Text className="text-black text-sm font-semibold">Pay into Circle</Text>
                </TouchableOpacity>
              </View>

              <View className="px-4 mt-4">
                <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                  <View className="flex-row items-center justify-between gap-3 mb-3">
                    <Text className="text-white text-base font-semibold">Payment Items</Text>
                    <Text className="text-gray-500 text-[11px]">
                      {listedPaymentItems.length} item{listedPaymentItems.length === 1 ? '' : 's'}
                    </Text>
                  </View>

                  {paymentItemsLoading ? (
                    <Text className="text-gray-500 text-xs">Loading items...</Text>
                  ) : listedPaymentItems.length === 0 ? (
                    <Text className="text-gray-400 text-xs">No configured payment items yet.</Text>
                  ) : (
                    <View className="gap-3">
                      {listedPaymentItems.map((item) => {
                        const badge = paymentItemBadgeLabel(item)
                        const buttonLabel = item?.is_review_only ? 'View' : item?.required === false || item?.type === 'treasury_topup' ? 'Contribute' : 'Pay now'
                        return (
                          <View key={String(item.key || item.id)} className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3">
                            <View className="flex-row items-center justify-between gap-3">
                              <View className="flex-1 pr-2">
                                <Text className="text-white text-sm font-semibold">{String(item.title || 'Payment item')}</Text>
                                <Text className="text-gray-400 text-[11px] mt-1">{paymentItemMeta(item)}</Text>
                              </View>
                              <View className="items-end gap-2">
                                <View className="rounded-full border border-gray-700 bg-gray-900 px-2 py-1">
                                  <Text className="text-[10px] text-gray-200">{badge}</Text>
                                </View>
                                <Text className="text-white text-sm font-semibold">{paymentItemAmountLabel(item, currency)}</Text>
                              </View>
                            </View>
                            <View className="mt-3 flex-row justify-end">
                              <TouchableOpacity
                                onPress={() => handleOpenPaymentItem(item)}
                                className={`rounded-full px-4 py-2 ${item?.is_review_only ? 'bg-gray-800' : 'bg-app-primary'}`}
                              >
                                <Text className={`text-xs font-semibold ${item?.is_review_only ? 'text-white' : 'text-black'}`}>
                                  {buttonLabel}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  )}

                  {supportPaymentItem ? (
                    <View className="mt-4 pt-4 border-t border-gray-800">
                      <Text className="text-gray-500 text-[11px] uppercase tracking-[0.16em] mb-3">More Ways to Support</Text>
                      <View className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3">
                        <View className="flex-row items-center justify-between gap-3">
                          <View className="flex-1 pr-2">
                            <Text className="text-white text-sm font-semibold">{String(supportPaymentItem.title || 'General Support')}</Text>
                            <Text className="text-gray-400 text-[11px] mt-1">{paymentItemMeta(supportPaymentItem) || 'Optional contribution'}</Text>
                          </View>
                          <TouchableOpacity onPress={() => handleOpenPaymentItem(supportPaymentItem)} className="rounded-full bg-app-primary px-4 py-2">
                            <Text className="text-black text-xs font-semibold">Contribute</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>

              <View className="px-4 mt-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white text-lg font-semibold">Recent Records</Text>
                  <Text className="text-gray-500 text-xs">
                    {Math.min(visibleRecentTransactions.length, 5)} shown
                  </Text>
                </View>
                {visibleRecentTransactions.length === 0 ? (
                  <View className="bg-gray-900 p-4 rounded-xl">
                    <Text className="text-gray-300 text-sm">No records yet.</Text>
                  </View>
                ) : (
                  visibleRecentTransactions.slice(0, 5).map((item, index) => {
                    const record = (item ?? {}) as Record<string, unknown>
                    const txId = String(record.id ?? `tx-${index}`)
                    const reactionTargetId = resolveReactionTargetId(record)
                    const busyReaction = reactionTargetId && reactionBusyKey?.startsWith(`${reactionTargetId}:`) ? reactionBusyKey.split(':')[1] : null
                    return (
                      <FeedItem
                        key={txId}
                        record={record}
                        currency={currency}
                        busyReaction={busyReaction}
                        onToggleReaction={handleToggleReaction}
                        forceAnonymousActor={isFoundersMemberView}
                      />
                    )
                  })
                )}
              </View>
            </>
          ) : null}

          {workspaceMode === 'manage' ? (
            <>
          <View className="px-4 mt-4">
            <ActionChips
              showWithdraw={!isFoundersMemberView}
              canWithdraw={canWithdraw}
              canInvite={canInvite}
              canViewAudit={canViewAudit}
              pendingApprovalCount={approvalRequests.length}
              onFund={() => router.push(`/circles/${circleId}/fund`)}
              onWithdraw={() => router.push(`/circles/${circleId}/withdraw`)}
              onActivities={() => router.push({ pathname: `/circles/${circleId}/activities`, params: { circleType: circleTypeConfig.key, circleName: title } } as any)}
              onAudit={() => router.push(`/circles/${circleId}/audit`)}
              onInvite={() => router.push(`/circles/${circleId}/invite`)}
              onApprovals={() => setActiveTab('about')}
              fundLabel={contributionLabel}
              withdrawLabel={payoutLabel}
              activityLabel={activityLabel}
            />
          </View>

          {duePlan ? (
            <View className="px-4 mt-4">
              <MonthlyDueCard
                duePlan={duePlan}
                dueLabel={dueLabel}
                dueHelper={activityHelper}
                payLabel={`Pay ${dueLabel.toLowerCase()}`}
                onPay={() => {
                  const obligationId = String(duePlan?.current_user_obligation?.id || '')
                  const amountCents = Number(duePlan?.current_user_obligation?.amount_cents || duePlan?.amount_cents || 0)
                  const payableMonthsCount = Number(duePlan?.current_user_due_summary?.payable_months_count || 1)
                  router.push({
                    pathname: `/circles/${circleId}/fund`,
                    params: {
                      dueMode: 'monthly',
                      dueId: obligationId,
                      dueAmountCents: String(amountCents),
                      dueMonthsOpen: String(Math.max(payableMonthsCount, 1)),
                    },
                  } as any)
                }}
              />
              <View className="mt-3 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                <Text className="text-white text-sm font-semibold">My dues status</Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {dueStatus ? (
                    <View className="rounded-full border border-gray-800 bg-gray-950 px-3 py-2">
                      <Text className="text-[11px] text-gray-200 uppercase">{formatLabel(dueStatus, 'Pending')}</Text>
                    </View>
                  ) : null}
                  {dueNextDateLabel ? (
                    <View className="rounded-full border border-gray-800 bg-gray-950 px-3 py-2">
                      <Text className="text-[11px] text-gray-200">Next due {dueNextDateLabel}</Text>
                    </View>
                  ) : null}
                  {duePrepaidThroughLabel ? (
                    <View className="rounded-full border border-gray-800 bg-gray-950 px-3 py-2">
                      <Text className="text-[11px] text-emerald-200">Prepaid through {duePrepaidThroughLabel}</Text>
                    </View>
                  ) : null}
                  {dueOverduePeriodsCount > 0 ? (
                    <View className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-2">
                      <Text className="text-[11px] text-amber-100">{dueOverduePeriodsCount} overdue period{dueOverduePeriodsCount === 1 ? '' : 's'}</Text>
                    </View>
                  ) : null}
                </View>
                {canPayDues ? (
                  <TouchableOpacity
                    onPress={handlePayDueNow}
                    className="bg-app-primary px-4 py-3 rounded-full mt-4 self-start"
                  >
                    <Text className="text-black text-xs font-semibold">Pay now</Text>
                  </TouchableOpacity>
                ) : null}
                {dueOutstandingCents > 0 ? (
                  <Text className="text-gray-400 text-xs mt-3">
                    Outstanding {moneyFormat(dueOutstandingCents / 100, currency)}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : duesRecommended ? (
            <View className="px-4 mt-4">
              <View className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4">
                <Text className="text-white text-base font-semibold">Dues & Contributions</Text>
                <Text className="text-sky-100 text-xs mt-1">
                  This circle is designed for recurring collections, but no dues plan has been configured yet.
                </Text>
                <Text className="text-gray-300 text-[11px] mt-3">
                  Set dues plan, add members, assign treasurer, and start collections.
                </Text>
                {canManageDuePlan ? (
                  <TouchableOpacity
                    onPress={handleSetupDuePlanCta}
                    className="bg-app-primary px-4 py-3 rounded-full mt-4 self-start"
                  >
                    <Text className="text-black text-xs font-semibold">Set Up Dues Plan</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
            </>
          ) : null}

          {canManageGovernance ? (
            <View className="px-4 mt-4">
              <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                <Text className="text-white text-base font-semibold">Governance</Text>
                <Text className="text-gray-400 text-xs mt-1">
                  Set up shared control, invite admins, and choose how many approvals withdrawals should need.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push(`/circles/${circleId}/governance` as any)}
                  className="bg-app-primary px-4 py-3 rounded-full mt-4 self-start"
                >
                  <Text className="text-black text-xs font-semibold">Open governance setup</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View className="px-4 mt-4">
            <SegmentTabs activeTab={activeTab} onChange={setActiveTab} />
          </View>

          {activeTab === 'timeline' ? (
            <View className="px-4 mt-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-white text-lg font-semibold">Timeline</Text>
                <Text className="text-gray-500 text-xs">
                  {visibleRecentTransactions.length} update{visibleRecentTransactions.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Text className="text-gray-400 text-xs mb-3">
                {isFoundersMemberView
                  ? 'Private feed of supporter contributions and tagged campaign milestones.'
                  : isOfficial
                  ? timelineLabel
                  : timelineLabel}
              </Text>
              {visibleRecentTransactions.length === 0 ? (
                <View className="bg-gray-900 p-4 rounded-xl">
                  <Text className="text-gray-300 text-sm">No activity yet.</Text>
                </View>
              ) : (
                visibleRecentTransactions.map((item, index) => {
                  const record = (item ?? {}) as Record<string, unknown>
                  const txId = String(record.id ?? `tx-${index}`)
                  const reactionTargetId = resolveReactionTargetId(record)
                  const busyReaction = reactionTargetId && reactionBusyKey?.startsWith(`${reactionTargetId}:`) ? reactionBusyKey.split(':')[1] : null
                  return (
                    <FeedItem
                      key={txId}
                      record={record}
                      currency={currency}
                      busyReaction={busyReaction}
                      onToggleReaction={handleToggleReaction}
                      forceAnonymousActor={isFoundersMemberView}
                    />
                  )
                })
              )}

              <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-white text-sm font-semibold">
                      {isOfficial ? 'Campaign milestones' : activityLabel}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-1">
                      {isOfficial
                        ? 'Post and review official supporter milestones from one place.'
                        : activityHelper}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: `/circles/${circleId}/activities`, params: { circleType: circleTypeConfig.key, circleName: title } } as any)}
                    className="px-4 py-2 rounded-full bg-theme-primary"
                  >
                    <Text className="text-black text-xs font-semibold">
                      {isOfficial ? 'Open milestones' : `Open ${activityLabel.toLowerCase()}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {activeTab === 'activities' ? (
            <View className="px-4 mt-4">
              <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <Text className="text-white text-base font-semibold">
                  {isOfficial ? 'Campaign milestones' : activityLabel}
                </Text>
                <Text className="text-gray-400 text-xs mt-1">
                  {isOfficial
                    ? 'Track campaign milestones and supporter contributions.'
                    : activityHelper}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: `/circles/${circleId}/activities`, params: { circleType: circleTypeConfig.key, circleName: title } } as any)}
                  className="bg-app-primary py-3 rounded-full items-center mt-4"
                >
                  <Text className="text-black text-xs font-semibold">{`Open ${activityLabel.toLowerCase()}`}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {activeTab === 'about' ? (
            <View className="px-4 mt-4">
              {approvalRequests.length > 0 ? (
                <View className="mb-4">
                  <ApprovalQueueCard
                    requests={approvalRequests}
                    busyId={approvalBusyId}
                    onApprove={(id) => handleApprovalDecision(id, 'approve')}
                    onReject={(id) => handleApprovalDecision(id, 'reject')}
                  />
                </View>
              ) : null}
              <SettingsSectionPills activeSection={settingsSection} onChange={setSettingsSection} />
              {settingsLoading ? (
                <Text className="text-gray-500 text-xs mt-3">Loading circle settings...</Text>
              ) : null}

              {settingsSection === 'membership' ? (
                <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
                  <Text className="text-white text-base font-semibold">My Membership</Text>
                  <Text className="text-gray-400 text-xs mt-2">
                    Manage your Circle Alias for this circle. Your legal BitBridge identity stays unchanged.
                  </Text>
                  <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <Text className="text-gray-400 text-[11px] uppercase tracking-[0.16em]">Circle Alias</Text>
                    <Text className="text-white text-sm font-semibold mt-2">
                      {String(membershipSettings?.display_name || '').trim() || 'Not set'}
                    </Text>
                    {membershipSettings?.next_display_name_change_at ? (
                      <Text className="text-gray-500 text-xs mt-2">
                        Next alias change available {formatTimestamp(String(membershipSettings.next_display_name_change_at))}
                      </Text>
                    ) : (
                      <Text className="text-gray-500 text-xs mt-2">
                        Circle Alias is optional and only affects this circle.
                      </Text>
                    )}
                    <TouchableOpacity
                      onPress={() => router.push(`/circles/${circleId}/display-name` as any)}
                      className="bg-app-primary rounded-full px-4 py-3 mt-4 self-start"
                    >
                      <Text className="text-black text-xs font-semibold">Edit Circle Alias</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <Text className="text-white text-sm font-semibold">Notifications</Text>
                    <Text className="text-gray-400 text-xs mt-2">
                      Circle-specific notification and reminder preferences are not available yet on the backend.
                    </Text>
                  </View>
                </View>
              ) : null}

              {settingsSection === 'operations' ? (
                <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
                  <Text className="text-white text-base font-semibold">Circle Operations</Text>
                  <Text className="text-gray-400 text-xs mt-2">
                    Manage structured collections, member operations, and reporting using live circle data only.
                  </Text>

                  {suggestedPaymentTemplates.length > 0 ? (
                    <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                      <Text className="text-gray-400 text-[11px] uppercase tracking-[0.16em]">Suggested templates</Text>
                      <Text className="text-gray-500 text-xs mt-2">
                        Suggested for {bucketLabel}. Templates are not payable until you configure and save them as active payment items.
                      </Text>
                      <View className="gap-3 mt-3">
                        {suggestedPaymentTemplates.map((template) => (
                          <View key={String(template.key)} className="rounded-2xl border border-gray-800 bg-gray-900/70 p-3">
                            <View className="flex-row items-center justify-between gap-3">
                              <View className="flex-1">
                                <Text className="text-white text-sm font-semibold">{String(template.title)}</Text>
                                <Text className="text-gray-500 text-[11px] mt-1">
                                  {template.setup_type === 'recurring'
                                    ? 'Recurring payment item'
                                    : template.setup_type === 'fine'
                                      ? 'Assigned item'
                                      : 'Collection payment item'}
                                </Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => handleApplyTemplate(template)}
                                disabled={template.disabled}
                                className={`rounded-full border px-3 py-2 ${
                                  template.disabled ? 'border-gray-800 bg-gray-950' : 'border-gray-700 bg-gray-950'
                                }`}
                              >
                                <Text className={`text-xs font-semibold ${template.disabled ? 'text-gray-500' : 'text-white'}`}>
                                  {templateActionLabel(template)}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <Text className="text-white text-sm font-semibold">Active Payment Items</Text>
                    <View className="mt-3 gap-3">
                      {listedPaymentItems.length ? (
                        listedPaymentItems.map((item) => (
                          <View key={String(item.key || item.id)} className="rounded-2xl border border-gray-800 bg-gray-900/70 p-3">
                            <View className="flex-row items-start justify-between gap-3">
                              <View className="flex-1">
                                <Text className="text-white text-sm font-semibold">{String(item.title || 'Payment item')}</Text>
                                <Text className="text-gray-400 text-[11px] mt-1">
                                  {[paymentItemSourceLabel(item), paymentItemMeta(item)].filter(Boolean).join(' · ')}
                                </Text>
                                <Text className="text-gray-500 text-[11px] mt-1">
                                  {String(item.applicability_label || item.due_label || (item.required === false ? 'Optional item' : 'Configured item'))}
                                </Text>
                              </View>
                              <View className="items-end gap-2">
                                <Text className="text-white text-sm font-semibold">{paymentItemAmountLabel(item, currency)}</Text>
                                <View className="rounded-full border border-gray-700 bg-gray-900 px-2 py-1">
                                  <Text className="text-[10px] text-gray-200">{paymentItemBadgeLabel(item)}</Text>
                                </View>
                              </View>
                            </View>
                            <View className="mt-3 flex-row justify-end">
                              <TouchableOpacity
                                onPress={() => handleOpenPaymentItemManager(item)}
                                className="rounded-full border border-gray-700 bg-gray-900 px-4 py-2"
                              >
                                <Text className="text-white text-xs font-semibold">
                                  {item.linked_reference_type === 'CircleDuePlan' || item.type === 'dues' ? 'Edit item' : 'Review item'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text className="text-gray-500 text-xs">No active payment items yet.</Text>
                      )}
                    </View>
                  </View>

                  <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <Text className="text-white text-sm font-semibold">Dues plan</Text>
                    <Text className="text-gray-400 text-xs mt-2">
                      {operationsSettings?.due_plan || duePlan
                        ? 'This circle already has a recurring collections plan.'
                        : duesRecommended
                          ? 'This circle is recommended for recurring collections, but no dues plan has been configured yet.'
                          : 'No dues plan is configured for this circle.'}
                    </Text>

                    {canManageDuePlan ? (
                      <View className="mt-4">
                        <FieldLabel>Amount (NGN)</FieldLabel>
                        <InputField
                          value={dueForm.amountNgn}
                          onChangeText={(value) => handleDueFormChange('amountNgn', value)}
                          placeholder="0.00"
                          keyboardType="decimal-pad"
                          editable={!dueSaving}
                        />

                        <FieldLabel>Cadence</FieldLabel>
                        <View className="flex-row flex-wrap gap-2 mb-4">
                          {(['weekly', 'monthly', 'yearly'] as const).map((cadenceOption) => {
                            const active = dueForm.cadence === cadenceOption
                            return (
                              <TouchableOpacity
                                key={cadenceOption}
                                onPress={() => handleDueFormChange('cadence', cadenceOption)}
                                className={`rounded-full border px-3 py-2 ${
                                  active ? 'border-app-primary bg-app-primary/10' : 'border-gray-800 bg-gray-950'
                                }`}
                              >
                                <Text className={`text-[11px] font-semibold ${active ? 'text-app-primary' : 'text-white'}`}>
                                  {formatLabel(cadenceOption, cadenceOption)}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>

                        {dueForm.cadence === 'weekly' ? (
                          <>
                            <FieldLabel>Due weekday</FieldLabel>
                            <View className="flex-row flex-wrap gap-2 mb-4">
                              {DUE_WEEKDAY_OPTIONS.map((option) => {
                                const active = Number(dueForm.dueWeekday) === option.value
                                return (
                                  <TouchableOpacity
                                    key={option.value}
                                    onPress={() => handleDueFormChange('dueWeekday', String(option.value))}
                                    className={`rounded-full border px-3 py-2 ${
                                      active ? 'border-app-primary bg-app-primary/10' : 'border-gray-800 bg-gray-950'
                                    }`}
                                  >
                                    <Text className={`text-[11px] font-semibold ${active ? 'text-app-primary' : 'text-white'}`}>
                                      {option.label}
                                    </Text>
                                  </TouchableOpacity>
                                )
                              })}
                            </View>
                          </>
                        ) : (
                          <>
                            <FieldLabel>Due day of month</FieldLabel>
                            <InputField
                              value={dueForm.dueDayOfMonth}
                              onChangeText={(value) => handleDueFormChange('dueDayOfMonth', value)}
                              placeholder="1"
                              keyboardType="numeric"
                              editable={!dueSaving}
                            />
                          </>
                        )}

                        {dueForm.cadence === 'yearly' ? (
                          <>
                            <FieldLabel>Due month</FieldLabel>
                            <InputField
                              value={dueForm.dueMonthOfYear}
                              onChangeText={(value) => handleDueFormChange('dueMonthOfYear', value)}
                              placeholder="1"
                              keyboardType="numeric"
                              editable={!dueSaving}
                            />
                          </>
                        ) : null}

                        <FieldLabel>Grace period (days)</FieldLabel>
                        <InputField
                          value={dueForm.gracePeriodDays}
                          onChangeText={(value) => handleDueFormChange('gracePeriodDays', value)}
                          placeholder="0"
                          keyboardType="numeric"
                          editable={!dueSaving}
                        />

                        <FieldLabel>Start date</FieldLabel>
                        <InputField
                          value={dueForm.startsOn}
                          onChangeText={(value) => handleDueFormChange('startsOn', value)}
                          placeholder="YYYY-MM-DD"
                          editable={!dueSaving}
                        />

                        <FieldLabel>End date (optional)</FieldLabel>
                        <InputField
                          value={dueForm.endsOn}
                          onChangeText={(value) => handleDueFormChange('endsOn', value)}
                          placeholder="YYYY-MM-DD"
                          editable={!dueSaving}
                        />

                        <FieldLabel>Eligible roles</FieldLabel>
                        <View className="flex-row flex-wrap gap-2 mb-2">
                          {DUE_ROLE_OPTIONS.map((option) => {
                            const active = dueForm.enrolledRoles.includes(option.value)
                            return (
                              <TouchableOpacity
                                key={option.value}
                                onPress={() => toggleDueRole(option.value)}
                                className={`rounded-full border px-3 py-2 ${
                                  active ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-gray-800 bg-gray-950'
                                }`}
                              >
                                <Text className={`text-[11px] font-semibold ${active ? 'text-emerald-200' : 'text-white'}`}>
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>

                        {dueError ? <Text className="text-rose-300 text-xs mt-3">{dueError}</Text> : null}
                        {dueSuccess ? <Text className="text-emerald-300 text-xs mt-3">{dueSuccess}</Text> : null}

                        <TouchableOpacity
                          onPress={() => void handleSaveDuePlan()}
                          disabled={dueSaving}
                          className={`px-4 py-3 rounded-full mt-4 self-start ${dueSaving ? 'bg-gray-700' : 'bg-app-primary'}`}
                        >
                          <Text className="text-black text-xs font-semibold">
                            {dueSaving ? 'Saving...' : operationsSettings?.due_plan || duePlan ? 'Update dues plan' : 'Set Up Dues Plan'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text className="text-gray-500 text-xs mt-4">
                        Only the group creator, admins, or treasurers can configure the dues plan.
                      </Text>
                    )}
                  </View>

                  <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <Text className="text-white text-sm font-semibold">Operations tools</Text>
                    <View className="flex-row flex-wrap gap-2 mt-4">
                      <TouchableOpacity
                        onPress={() => router.push(`/circles/${circleId}/members` as any)}
                        className="bg-app-primary rounded-full px-4 py-3"
                      >
                        <Text className="text-black text-xs font-semibold">Open member roster</Text>
                      </TouchableOpacity>
                      {canViewReports ? (
                        <TouchableOpacity
                          onPress={() => router.push(`/circles/${circleId}/audit` as any)}
                          className="bg-gray-950 border border-gray-800 rounded-full px-4 py-3"
                        >
                          <Text className="text-white text-xs font-semibold">Open reports</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </View>
              ) : null}

              {settingsSection === 'governance' ? (
              <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <Text className="text-white text-base font-semibold">Governance</Text>
                <Text className="text-gray-400 text-xs mt-2">
                  Review creator-managed controls, member access, and the canonical governance surface for this circle.
                </Text>
                {isOfficial ? (
                  <Text className="text-amber-100 text-xs mt-2">
                    Official BitBridge Circle{badgeLabel ? ` ? ${badgeLabel}` : ''}
                  </Text>
                ) : null}
                {ownerLabel ? (
                  <Text className="text-gray-300 text-xs mt-2">Creator: {ownerLabel}</Text>
                ) : null}
                {ownerMaskedEmail && ownerMaskedEmail !== ownerLabel ? (
                  <Text className="text-gray-400 text-xs mt-1">Contact: {ownerMaskedEmail}</Text>
                ) : null}
                <Text className="text-gray-300 text-xs mt-1">
                  Members: {memberCount}
                </Text>
                {createdAt ? (
                  <Text className="text-gray-500 text-xs mt-1">
                    Created: {formatTimestamp(createdAt)}
                  </Text>
                ) : null}
                <View className="flex-row flex-wrap gap-2 mt-4">
                  <TouchableOpacity
                    onPress={() => router.push(`/circles/${circleId}/members` as any)}
                    className="bg-app-primary rounded-full px-4 py-3"
                  >
                    <Text className="text-black text-xs font-semibold">Open member roster</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push(`/circles/${circleId}/display-name` as any)}
                    className="bg-gray-950 border border-gray-800 rounded-full px-4 py-3"
                  >
                    <Text className="text-white text-xs font-semibold">Edit My Circle Name</Text>
                  </TouchableOpacity>
                </View>
                <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/60 px-3 py-3">
                  <Text className="text-gray-300 text-xs leading-5">
                    Member roster shows Circle Names first, with real identity kept underneath for clarity.
                  </Text>
                </View>
              </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}

      <WorkspaceSwitcherModal
        open={switchAccountOpen}
        onClose={() => setSwitchAccountOpen(false)}
        activeAccount={activeAccount}
        activeIdentityName={activeIdentityName}
        activeIdentityMeta={activeIdentityMeta}
        activeIdentityBadge={activeIdentityBadge}
        accountHydrated={true}
        businessLoading={businessLoading}
        circlesLoading={circlesLoading}
        businessAccounts={businessAccounts}
        circleAccounts={circleAccounts}
        selectedBusinessName={selectedBusiness?.name || null}
        selectedCircleName={selectedCircleWorkspace?.name || null}
        onSelectPersonal={async () => {
          await selectPersonalAccount()
          router.replace('/(tabs)' as any)
        }}
        onSelectBusiness={async (businessId) => {
          await selectBusinessAccount(businessId)
          router.replace('/business' as any)
        }}
        onSelectCircle={async (circleId) => {
          const selectedCircle = circleAccounts.find((item) => String(item.id) === String(circleId))
          await selectCircleAccount(circleId)
          router.replace({
            pathname: `/circles/${circleId}` as any,
            params: {
              name: selectedCircle?.name || 'Circle',
              role: selectedCircle?.role || 'member',
              memberCount: String(selectedCircle?.member_count || 0),
              circleType: selectedCircle?.circle_type || 'standard',
            },
          } as any)
        }}
        onOpenCircles={() => {
          router.push('/circles' as any)
        }}
        onLogout={() => {
          void onLogout()
        }}
      />
    </View>
  )
}

export default CircleDetailScreen
