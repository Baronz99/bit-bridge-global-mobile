import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getCircle } from '@/api/circles'
import { FEATURE_CIRCLES } from '@/constants/featureFlags'
import moneyFormat from '@/utils/moneyFormat'
import { Ionicons } from '@expo/vector-icons'
import MemberAvatars from '@/components/circles/MemberAvatars'
import { useAuth } from '@/services/useAuth'

const getArray = (value: unknown) => (Array.isArray(value) ? value : [])

const extractCircle = (payload: unknown) => {
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    return (container.data as Record<string, unknown>) ?? container
  }
  return {}
}

const extractRecentTransactions = (payload: unknown) => {
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    const circle = extractCircle(payload)
    return getArray(
      circle.recent_transactions ??
        container.recent_transactions ??
        (container.data as Record<string, unknown> | undefined)?.recent_transactions
    )
  }
  return []
}

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
  const username = ((user?.username as string) || '').trim()
  const firstName = ((user?.first_name as string) || '').trim()
  const lastName = ((user?.last_name as string) || '').trim()
  const fullName = `${firstName} ${lastName}`.trim()
  const email = ((user?.email as string) || '').trim()

  const primary =
    displayName || formatUsername(username) || fullName || (email ? maskEmail(email) : 'Member')

  return {
    primary,
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

type CircleHeaderProps = {
  title: string
  description: string
  memberCount: number
  role: string
  ownerLabel: string
  ownerMaskedEmail: string
  canWithdraw: boolean
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
}

const CircleHeader = ({
  title,
  description,
  memberCount,
  role,
  ownerLabel,
  ownerMaskedEmail,
  canWithdraw,
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
              {memberCount} members · {role}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onInvite}
          className="h-9 w-9 rounded-full border border-gray-800 bg-gray-950 items-center justify-center shrink-0"
        >
          <Ionicons name="share-outline" size={18} color="#e2e8f0" />
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-between mt-4">
        <View>
          {balanceVisible ? (
            <>
              <Text className="text-gray-400 text-[10px] uppercase tracking-widest">Group balance</Text>
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
        <View className="items-end">
          {ownerLabel ? (
            <Text className="text-gray-500 text-[10px]">Owner: {ownerLabel}</Text>
          ) : null}
          {ownerMaskedEmail && ownerMaskedEmail !== ownerLabel ? (
            <Text className="text-gray-500 text-[10px] mt-1">Contact: {ownerMaskedEmail}</Text>
          ) : null}
          {!canWithdraw ? (
            <Text className="text-gray-500 text-[10px] mt-1">Withdrawals are for owners/admins.</Text>
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
            <Text className="text-[10px] text-gray-300">Shared feed</Text>
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
  canWithdraw: boolean
  onFund: () => void
  onWithdraw: () => void
  onActivities: () => void
  onAudit: () => void
  onInvite: () => void
}

const ActionChips = ({
  canWithdraw,
  onFund,
  onWithdraw,
  onActivities,
  onAudit,
  onInvite,
}: ActionChipsProps) => {
  return (
    <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
      <Text className="text-white text-base font-semibold mb-3">Quick actions</Text>
      <View className="flex-row gap-3">
        <TouchableOpacity onPress={onFund} className="flex-1 bg-app-primary py-3 rounded-full items-center">
          <Text className="text-black text-xs font-semibold">Fund</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onWithdraw}
          className={`flex-1 py-3 rounded-full items-center ${canWithdraw ? 'bg-gray-800' : 'bg-gray-700'}`}
          disabled={!canWithdraw}
        >
          <Text className="text-white text-xs font-semibold">Withdraw</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap gap-2 mt-3">
        <TouchableOpacity onPress={onActivities} className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full">
          <Text className="text-white text-xs">Activities</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onAudit} className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full">
          <Text className="text-white text-xs">Audit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onInvite} className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full">
          <Text className="text-white text-xs">Invite</Text>
        </TouchableOpacity>
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

type FeedItemProps = {
  record: Record<string, unknown>
  currency: string
}

const FeedItem = ({ record, currency }: FeedItemProps) => {
  const time = (record.occurred_at as string) || (record.created_at as string) || ''
  const amount = Number(record.amount_cents || 0) / 100
  const direction = (record.direction as string) || (record.kind as string) || 'movement'
  const kind = (record.kind as string) || ''
  const actor = record.user as Record<string, unknown> | undefined
  const actorLabel = resolveIdentity(actor).primary
  const actorInitials = getInitials(actorLabel || 'BB')
  const activity = record.circle_activity as Record<string, unknown> | undefined
  const activityName = (activity?.name as string) || ''
  const reactions = record.reactions as Record<string, unknown> | undefined
  const reactionCounts = (reactions?.counts as Record<string, number> | undefined) || undefined
  const reactionTotal = sumReactions(reactionCounts)
  const actionText = buildActionText(actorLabel, direction, kind)

  return (
    <View className="bg-gray-900 p-4 rounded-2xl mb-3 border border-gray-800">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 rounded-full bg-gray-800 items-center justify-center border border-gray-700">
          <Text className="text-white text-[10px] font-semibold">{actorInitials}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-sm font-semibold">{actionText}</Text>
            <Text className="text-white text-sm font-semibold">{moneyFormat(amount, currency)}</Text>
          </View>
          <View className="flex-row items-center gap-2 mt-2">
            <View className={`px-2 py-0.5 rounded-full border ${directionPill(direction)}`}>
              <Text className="text-[10px] uppercase">{directionLabel(direction)}</Text>
            </View>
            {activityName ? (
              <View className="bg-gray-950 border border-gray-800 rounded-full px-2 py-0.5">
                <Text className="text-[10px] text-gray-300">Activity: {activityName}</Text>
              </View>
            ) : null}
          </View>
          <View className="flex-row items-center gap-4 mt-3">
            <View className="flex-row items-center gap-1">
              <Text className="text-[12px]">👍</Text>
              <Text className="text-[10px] text-gray-400">{reactionTotal}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-[12px]">🎉</Text>
              <Text className="text-[10px] text-gray-400">
                {reactionTotal > 0 ? Math.max(0, reactionTotal - 1) : 0}
              </Text>
            </View>
            {time ? <Text className="text-gray-500 text-[10px]">{formatTimestamp(time)}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  )
}

const CircleDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { userProfileData } = useAuth()
  const [activeTab, setActiveTab] = useState<SegmentTab>('timeline')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<unknown>(null)

  const loadCircle = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    setError(null)
    try {
      const res = await getCircle(circleId)
      setData(res)
    } catch {
      setError('Unable to load this circle right now.')
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    if (!FEATURE_CIRCLES) return
    loadCircle()
  }, [loadCircle])

  const circle = useMemo(() => extractCircle(data), [data])
  const recentTransactions = useMemo(() => extractRecentTransactions(data), [data])
  const title = getTitle(circle)
  const description = getDescription(circle)
  const balanceCents = Number(circle.balance_cents || 0)
  const balanceVisible = circle.balance_visible !== false
  const currency = (circle.currency as string) || 'NGN'
  const isOfficial = circle.circle_type === 'official'
  const badgeLabel = ((circle.badge_label as string) || '').trim()
  const isFlexibleOfficial = isOfficial && circle.kyc_mode === 'flexible'
  const isOfficialFeatured = circle.visibility === 'official_featured'
  const maxContributionCents = Number(circle.max_contribution_cents || 0)
  const profileRoot = (userProfileData?.data ?? userProfileData) || {}
  const isTier1User = getTierRank(profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level) === 1
  const members = getArray(circle.members)
  const memberCount = members.length
  const role = (circle.current_user_role as string) || 'member'
  const canWithdraw = circle.can_withdraw === true
  const owner = circle.owner as Record<string, unknown> | undefined
  const ownerIdentity = resolveIdentity(owner)
  const ownerLabel = ownerIdentity.primary
  const ownerMaskedEmail = ownerIdentity.maskedEmail
  const createdAt = (circle.created_at as string) || ''

  const memberInitials = members
    .map((member) => {
      const record = (member ?? {}) as Record<string, unknown>
      const user = record.user as Record<string, unknown> | undefined
      const displayName = resolveIdentity(user).primary
      return getInitials(displayName)
    })
    .slice(0, 3)

  if (!FEATURE_CIRCLES) {
    return (
      <View className="flex-1 bg-primary justify-center items-center px-6">
        <Text className="text-white text-base">Circles are not available yet.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary">
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="small" color="#ffcc00" />
          <Text className="text-white mt-3">Loading circle...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-white text-center mb-4">{error}</Text>
          <TouchableOpacity
            onPress={loadCircle}
            className="bg-orange-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="px-4 pt-6 pb-2">
            <CircleHeader
              title={title}
              description={description}
              memberCount={memberCount}
              role={role}
              ownerLabel={ownerLabel}
              ownerMaskedEmail={ownerMaskedEmail}
              canWithdraw={canWithdraw}
              balanceVisible={balanceVisible}
              balanceCents={balanceCents}
              currency={currency}
              memberInitials={memberInitials}
              onInvite={() => router.push(`/circles/${circleId}/invite`)}
              isOfficial={isOfficial}
              badgeLabel={badgeLabel}
              isFlexibleOfficial={isFlexibleOfficial}
              isOfficialFeatured={isOfficialFeatured}
              isTier1User={isTier1User}
              maxContributionCents={maxContributionCents}
            />
          </View>

          <View className="px-4 mt-4">
            <ActionChips
              canWithdraw={canWithdraw}
              onFund={() => router.push(`/circles/${circleId}/fund`)}
              onWithdraw={() => router.push(`/circles/${circleId}/withdraw`)}
              onActivities={() => router.push(`/circles/${circleId}/activities`)}
              onAudit={() => router.push(`/circles/${circleId}/audit`)}
              onInvite={() => router.push(`/circles/${circleId}/invite`)}
            />
          </View>

          <View className="px-4 mt-4">
            <SegmentTabs activeTab={activeTab} onChange={setActiveTab} />
          </View>

          {activeTab === 'timeline' ? (
            <View className="px-4 mt-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-white text-lg font-semibold">Timeline</Text>
                <Text className="text-gray-500 text-xs">
                  {recentTransactions.length} update{recentTransactions.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Text className="text-gray-400 text-xs mb-3">
                {isOfficial
                  ? 'Shared feed of contributions, payouts, and tagged campaign milestones.'
                  : 'Shared feed of deposits, payouts, and tagged activity goals.'}
              </Text>
              {recentTransactions.length === 0 ? (
                <View className="bg-gray-900 p-4 rounded-xl">
                  <Text className="text-gray-300 text-sm">No activity yet.</Text>
                </View>
              ) : (
                recentTransactions.map((item, index) => (
                  <FeedItem
                    key={String((item as Record<string, unknown>)?.id ?? `tx-${index}`)}
                    record={(item ?? {}) as Record<string, unknown>}
                    currency={currency}
                  />
                ))
              )}

              <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-white text-sm font-semibold">
                      {isOfficial ? 'Campaign milestones' : 'Circle activities'}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-1">
                      {isOfficial
                        ? 'Post and review official supporter milestones from one place.'
                        : 'Create and track contribution goals for this circle.'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push(`/circles/${circleId}/activities`)}
                    className="px-4 py-2 rounded-full bg-theme-primary"
                  >
                    <Text className="text-black text-xs font-semibold">
                      {isOfficial ? 'Open milestones' : 'Open activities'}
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
                  {isOfficial ? 'Campaign milestones' : 'Group activities'}
                </Text>
                <Text className="text-gray-400 text-xs mt-1">
                  {isOfficial
                    ? 'Track campaign milestones and supporter contributions.'
                    : 'Create goals and track contributions from members.'}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push(`/circles/${circleId}/activities`)}
                  className="bg-app-primary py-3 rounded-full items-center mt-4"
                >
                  <Text className="text-black text-xs font-semibold">Open activities</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {activeTab === 'about' ? (
            <View className="px-4 mt-4">
              <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <Text className="text-white text-base font-semibold">About this group</Text>
                {isOfficial ? (
                  <Text className="text-amber-100 text-xs mt-2">
                    Official BitBridge Circle{badgeLabel ? ` · ${badgeLabel}` : ''}
                  </Text>
                ) : null}
                {ownerLabel ? (
                  <Text className="text-gray-300 text-xs mt-2">Owner: {ownerLabel}</Text>
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
                <View className="flex-row flex-wrap gap-2 mt-3">
                  {members.slice(0, 6).map((member, index) => {
                    const record = (member ?? {}) as Record<string, unknown>
                    const user = record.user as Record<string, unknown> | undefined
                    const displayName = resolveIdentity(user).primary
                    return (
                      <View
                        key={`${displayName}-${index}`}
                        className="bg-gray-950 border border-gray-800 rounded-full px-2 py-1"
                      >
                        <Text className="text-[10px] text-gray-300">{displayName}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

export default CircleDetailScreen
