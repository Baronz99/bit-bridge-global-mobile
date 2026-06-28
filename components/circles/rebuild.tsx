import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Image, KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getBusinessEntities } from '@/api/business'
import { listCircles } from '@/api/circles'
import WorkspaceSwitcherModal, { WorkspaceBusiness, WorkspaceCircle } from '@/components/workspace/WorkspaceSwitcherModal'
import { useActiveAccount } from '@/services/useActiveAccount'
import { useAuth } from '@/services/useAuth'
import { DEBUG_ENABLED, log } from '@/utils/logger'
import moneyFormat from '@/utils/moneyFormat'

export const normalizePaymentItems = (payload: any): any[] => {
  const root = payload?.data ?? payload
  if (Array.isArray(root?.data)) return root.data
  if (Array.isArray(root)) return root
  return []
}

export const circleTitle = (workspace: Record<string, any> | null | undefined) =>
  String(workspace?.name || workspace?.title || workspace?.circle_name || 'Circle').trim()

export const circleRoleLabel = (workspace: Record<string, any> | null | undefined) =>
  String(workspace?.current_user_role || workspace?.role || 'member')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())

export const circleBucketLabel = (workspace: Record<string, any> | null | undefined) =>
  String(workspace?.product_bucket_label || workspace?.bucket_label || workspace?.type_label || '').trim()

const circleInitials = (value: string) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'C'

export const paymentItemBadge = (item: Record<string, any>) => {
  const status = String(item?.status || '').toLowerCase()
  if (status.includes('overdue')) return 'Overdue'
  if (status.includes('due')) return 'Due now'
  if (status.includes('current') || status.includes('paid')) return 'Paid up'
  if (String(item?.type || '').toLowerCase() === 'treasury_topup' || item?.support_fallback) return 'Optional'
  return 'Upcoming'
}

const canonicalContributionTitle = (value: unknown, item?: Record<string, any>) => {
  const title = String(value || '').trim()
  const normalizedTitle = title.toLowerCase()
  const normalizedType = String(item?.type || '').toLowerCase()

  if (normalizedType === 'treasury_topup' || item?.support_fallback) return 'Shared Fund'
  if (normalizedTitle === 'general support' || normalizedTitle === 'treasury top-up') return 'Shared Fund'
  if (normalizedTitle === 'goal contribution' || normalizedTitle === 'event contribution') return 'Collection'
  return title || 'Payment option'
}

export const paymentItemTitleLabel = (item: Record<string, any>) =>
  canonicalContributionTitle(item?.title, item)

export const paymentItemMeta = (item: Record<string, any>) => {
  const mode = String(item?.payment_item_kind || item?.checkout_mode || item?.item_type || '').toLowerCase()
  if (mode === 'recurring') return 'Recurring'
  if (mode === 'fixed') return 'Fixed'
  if (mode === 'quantity') return 'Quantity based'
  if (mode === 'open') return item?.support_fallback ? 'Shared fund' : 'Open contribution'
  if (item?.support_fallback) return 'Shared fund'
  return 'Optional'
}

export const paymentItemAmount = (item: Record<string, any>) => {
  const mode = String(item?.payment_item_kind || item?.checkout_mode || item?.item_type || '').toLowerCase()
  if (mode === 'quantity') {
    if (Number(item?.unit_price_cents || 0) > 0) return `${moneyFormat(Number(item.unit_price_cents) / 100)} each`
    if (Number(item?.amount_cents || 0) > 0) return moneyFormat(Number(item.amount_cents) / 100)
  }
  if (mode === 'fixed') {
    if (Number(item?.amount_cents || 0) > 0) return moneyFormat(Number(item.amount_cents) / 100)
    if (Number(item?.unit_price_cents || 0) > 0) return moneyFormat(Number(item.unit_price_cents) / 100)
  }
  if (mode === 'recurring') {
    if (Number(item?.amount_cents || 0) > 0) return `${moneyFormat(Number(item.amount_cents) / 100)} / month`
    if (Number(item?.suggested_amount_cents || 0) > 0) return `From ${moneyFormat(Number(item.suggested_amount_cents) / 100)} / month`
    return 'Monthly payment'
  }
  if (Number(item?.unit_price_cents || 0) > 0) return moneyFormat(Number(item.unit_price_cents) / 100)
  if (Number(item?.amount_cents || 0) > 0) return moneyFormat(Number(item.amount_cents) / 100)
  if (Number(item?.suggested_amount_cents || 0) > 0) return `Suggested ${moneyFormat(Number(item.suggested_amount_cents) / 100)}`
  return 'Open amount'
}

const humanizePaymentField = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

export const paymentItemIdentityLabel = (item: Record<string, any>) => {
  const linkedReferenceType = String(item?.linked_reference_type || '').trim()
  const purposeKind = humanizePaymentField(item?.purpose_kind)
  const contributionFrequency = humanizePaymentField(item?.contribution_frequency)
  const sourceTemplateKey = String(item?.source_template_key || '').trim().toLowerCase()
  const tags: string[] = []

  if (linkedReferenceType === 'CircleActivity' && purposeKind) tags.push(purposeKind)
  if (linkedReferenceType === 'CircleActivity' && contributionFrequency) tags.push(contributionFrequency)
  if (item?.system_default === true) tags.push('Starter item')

  if (sourceTemplateKey && !item?.system_default) {
    if (sourceTemplateKey.includes('event')) tags.push('Event')
    else if (sourceTemplateKey.includes('goal')) tags.push('Goal')
    else if (sourceTemplateKey.includes('fine')) tags.push('Fine')
    else if (sourceTemplateKey.includes('welfare')) tags.push('Welfare')
  }

  return tags.filter(Boolean).slice(0, 2).join(' · ')
}

const cleanText = (value: unknown) => String(value || '').trim()

const reconciliationPersonLabel = (record: Record<string, any>) =>
  cleanText(record?.meta?.reconciliation_person_label || record?.reconciliation_person_label || record?.meta?.circle_person_label || record?.circle_person_label)

const reconciliationCoverageLabel = (record: Record<string, any>) =>
  cleanText(record?.meta?.reconciliation_coverage_label || record?.reconciliation_coverage_label || record?.meta?.reconciliation_purpose_label || record?.reconciliation_purpose_label)

const reconciliationPeriodRangeLabel = (record: Record<string, any>) =>
  cleanText(record?.meta?.reconciliation_period_range_label || record?.reconciliation_period_range_label)

const reconciliationPurposeLabel = (record: Record<string, any>) =>
  cleanText(
    record?.meta?.reconciliation_purpose_label ||
      record?.reconciliation_purpose_label ||
      record?.meta?.reconciliation_label ||
      record?.reconciliation_label ||
      record?.meta?.assignment_label ||
      record?.assignment_label
  )

const reconciliationSummaryLabel = (record: Record<string, any>) => {
  const person = reconciliationPersonLabel(record)
  const purpose = reconciliationPurposeLabel(record)
  if (person && purpose) return `${person} for ${purpose}`
  return person || purpose
}

const proofLabel = (record: Record<string, any>) => {
  const meta = record?.meta && typeof record.meta === 'object' && !Array.isArray(record.meta) ? record.meta : {}
  return Boolean(meta.proof_available) ? 'Proof' : 'Record'
}

const reconciliationHeadlinePurposeLabel = (record: Record<string, any>) => {
  const person = reconciliationPersonLabel(record)
  const purpose = reconciliationPurposeLabel(record)
  if (!person || !purpose) return purpose

  const normalizedPerson = person.toLowerCase()
  const normalizedPurpose = purpose.toLowerCase()
  const prefix = `${normalizedPerson} for `
  if (normalizedPurpose.startsWith(prefix)) {
    return purpose.slice(person.length + 5).trim()
  }

  return purpose
}

const reconciliationSettlementLabel = (record: Record<string, any>) => {
  const coverage = reconciliationCoverageLabel(record)
  const range = reconciliationPeriodRangeLabel(record)
  return [coverage, range].filter(Boolean).join(' ').trim()
}

export const activityActorName = (record: Record<string, any>) => {
  const actorObject = record?.actor && typeof record.actor === 'object' && !Array.isArray(record.actor) ? record.actor : {}
  const senderObject =
    record?.meta?.incoming_transfer && typeof record.meta.incoming_transfer === 'object' && !Array.isArray(record.meta.incoming_transfer)
      ? record.meta.incoming_transfer
      : {}

  const actor = cleanText(
    actorObject.display_name ||
      actorObject.name ||
      actorObject.fallback_name ||
      record?.actor_name ||
      record?.user_name ||
      record?.performed_by ||
      senderObject.sender_name ||
      record?.meta?.sender_name
  )

  if (actor) return actor

  const receiptCategory = cleanText(record?.meta?.receipt_category || record?.receipt_category).toLowerCase()
  const activityType = cleanText(record?.activity_type || record?.kind).toLowerCase()
  if (receiptCategory === 'incoming_transfer' || activityType === 'treasury_inflow') return 'Unknown sender'
  return 'Someone'
}

export const activityActorInitials = (record: Record<string, any>) => {
  const actor = activityActorName(record)
  return actor
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

const purposeFallback = (record: Record<string, any>) => {
  const receiptCategory = cleanText(record?.meta?.receipt_category || record?.receipt_category).toLowerCase()
  const activityType = cleanText(record?.activity_type || record?.kind).toLowerCase()
  const label = cleanText(record?.label || record?.display_message || record?.description || record?.message || record?.title).toLowerCase()
  const narration = cleanText(record?.meta?.narration || record?.narration || record?.note)

  if (receiptCategory === 'treasury_payout') return narration || 'Treasury payout'
  if (activityType === 'approval' || activityType === 'withdrawal') return 'money request'
  if (receiptCategory === 'incoming_transfer' || activityType === 'treasury_inflow') return 'Shared Fund'
  if (activityType === 'due_payment' || label.includes('dues')) return 'Monthly Dues'
  if (activityType === 'contribution') return 'Shared Fund'
  if (activityType === 'assessment') return 'Collection'
  if (activityType === 'campaign') return 'Collection'
  if (activityType === 'goal' || activityType === 'collection' || label.includes('collection') || label.includes('fund')) return 'Collection'
  if (narration) return narration
  return 'Activity'
}

export const activityPurposeLabel = (record: Record<string, any>) => {
  const reconciliationLabel = reconciliationSummaryLabel(record)
  const settlementLabel = reconciliationSettlementLabel(record)
  const paymentItemTitle = cleanText(record?.payment_item_title)
  const paymentPurposeLabel = cleanText(record?.payment_purpose_label)
  const note = cleanText(record?.meta?.note || record?.note)
  const narration = cleanText(record?.meta?.narration || record?.narration)
  const rawTitle = cleanText(record?.title)
  const receiptCategory = cleanText(record?.meta?.receipt_category || record?.receipt_category).toLowerCase()
  const activityType = cleanText(record?.activity_type || record?.kind).toLowerCase()
  const reconciliationKind = cleanText(record?.meta?.reconciliation_kind || record?.reconciliation_kind).toLowerCase()

  if (receiptCategory === 'treasury_payout') {
    return narration || note || paymentPurposeLabel || paymentItemTitle || purposeFallback(record)
  }

  if (receiptCategory === 'incoming_transfer' || activityType === 'treasury_inflow') {
    if (reconciliationKind === 'allocation' && settlementLabel) return settlementLabel
  }

  const purpose =
    reconciliationLabel ||
    paymentItemTitle ||
    paymentPurposeLabel ||
    (rawTitle && !/^(paid|withdrew|requested|approved|rejected|contributed|funded|topped up|received)/i.test(rawTitle) ? rawTitle : '') ||
    note ||
    narration ||
    purposeFallback(record)

  const normalizedPurpose = purpose.toLowerCase()
  if (
    normalizedPurpose === 'general support' ||
    normalizedPurpose === 'treasury top-up' ||
    normalizedPurpose === 'treasury contribution' ||
    normalizedPurpose === 'shared fund support'
  ) {
    return 'Shared Fund'
  }
  if (normalizedPurpose === 'goal contribution' || normalizedPurpose === 'event contribution') {
    return 'Collection'
  }
  if (normalizedPurpose === 'money request') return 'money request'
  return purpose || 'Activity'
}

const humanizeActivityStatus = (record: Record<string, any>) => {
  const status = cleanText(record?.status)
  const remainingApprovals = Number(record?.remaining_approvals || record?.meta?.remaining_approvals || 0)
  if (remainingApprovals > 0) {
    return `${remainingApprovals} more approval${remainingApprovals === 1 ? '' : 's'} needed`
  }
  if (status.toLowerCase() === 'pending_approval') return 'Needs review'
  if (!status) return ''
  return recordStatusLabel(record)
}

export const activitySentence = (record: Record<string, any>) => {
  const actor = activityActorName(record)
  const reconciliationPerson = reconciliationPersonLabel(record)
  const purpose = reconciliationHeadlinePurposeLabel(record) || activityPurposeLabel(record)
  const reconciliationLabel = reconciliationSummaryLabel(record)
  const settlementLabel = reconciliationSettlementLabel(record)
  const receiptCategory = cleanText(record?.meta?.receipt_category || record?.receipt_category).toLowerCase()
  const activityType = cleanText(record?.activity_type || record?.kind).toLowerCase()
  const status = cleanText(record?.status).toLowerCase()
  const reconciliationKind = cleanText(record?.meta?.reconciliation_kind || record?.reconciliation_kind).toLowerCase()

  if (receiptCategory === 'incoming_transfer' || activityType === 'treasury_inflow') {
    if (reconciliationKind === 'allocation' && reconciliationPerson && settlementLabel) {
      return `${reconciliationPerson} paid ${settlementLabel}`
    }
    if (reconciliationPerson && purpose) {
      return `${reconciliationPerson} paid ${purpose}`
    }
    if (reconciliationLabel) return `${actor} matched to ${reconciliationLabel}`
    return `${actor} added to ${purpose}`
  }
  if (receiptCategory === 'treasury_payout') {
    return `${actor} sent payout for ${purpose}`
  }
  if (receiptCategory === 'treasury_payout' || activityType === 'withdrawal') {
    return `${actor} requested a money request`
  }
  if (activityType === 'approval') {
    if (status === 'approved') return `${actor} approved a money request`
    if (status === 'rejected') return `${actor} rejected a money request`
    return `${actor} reviewed a money request`
  }
  if (activityType === 'due_payment' || purpose.toLowerCase() === 'monthly dues') {
    return `${actor} paid ${purpose}`
  }
  if (activityType === 'assessment') {
    return `${actor} paid ${purpose}`
  }
  if (activityType === 'campaign' || activityType === 'goal' || activityType === 'collection') {
    return `${actor} contributed to ${purpose}`
  }
  if (activityType === 'contribution' || purpose === 'Shared Fund') {
    return `${actor} added to ${purpose}`
  }
  return paymentEventLabel(record)
}

export const activitySupportLabel = (record: Record<string, any>) => {
  const statusLabel = humanizeActivityStatus(record)
  const timeLabel = recordTimeLabel(record)
  return [recordAmountLabel(record), timeLabel || statusLabel].filter(Boolean).join(' · ')
}

const formatGroupHeading = (value: Date) => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTarget = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const diffDays = Math.floor((startOfToday.getTime() - startOfTarget.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This week'
  return value.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const groupCircleActivityRecords = (records: Record<string, any>[]) => {
  const groups = new Map<string, { title: string; sortTime: number; data: Record<string, any>[] }>()

  records.forEach((record) => {
    const raw = cleanText(record?.occurred_at || record?.created_at || record?.updated_at)
    const parsed = raw ? new Date(raw) : null
    const validDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
    const title = validDate ? formatGroupHeading(validDate) : 'Older'
    const sortTime = validDate ? validDate.getTime() : 0
    const key = `${title}:${validDate ? validDate.toDateString() : 'unknown'}`
    const existing = groups.get(key)
    if (existing) {
      existing.data.push(record)
      existing.sortTime = Math.max(existing.sortTime, sortTime)
    } else {
      groups.set(key, { title, sortTime, data: [record] })
    }
  })

  return Array.from(groups.values())
    .sort((left, right) => right.sortTime - left.sortTime)
    .map((section) => ({
      title: section.title,
      data: section.data.sort((left, right) => {
        const leftTime = new Date(String(left?.occurred_at || left?.created_at || left?.updated_at || 0)).getTime()
        const rightTime = new Date(String(right?.occurred_at || right?.created_at || right?.updated_at || 0)).getTime()
        return rightTime - leftTime
      }),
    }))
}

export const paymentEventLabel = (record: Record<string, any>) => {
  const actor = activityActorName(record)
  const backendLabel = String(record?.label || record?.display_message || record?.description || record?.message || record?.title || '').trim()
  const normalizedBackendLabel = backendLabel.toLowerCase()
  if (normalizedBackendLabel === 'general support' || normalizedBackendLabel === 'treasury top-up') {
    return `${actor} added money to the shared fund`.trim()
  }
  if (normalizedBackendLabel === 'goal contribution' || normalizedBackendLabel === 'event contribution') {
    return `${actor} contributed to a collection`.trim()
  }
  if (backendLabel) {
    if (/^(paid|withdrew|requested|approved|rejected|contributed|funded|topped up|received)/i.test(backendLabel)) {
      return `${actor} ${backendLabel}`.trim()
    }
    return backendLabel
  }
  const itemTitle = String(record?.payment_item_title || record?.payment_purpose_label || '').trim()
  const quantity = Number(record?.payment_item_quantity || record?.meta?.payment_item_quantity || 0)
  if (itemTitle && quantity > 0) {
    const pluralSuffix = itemTitle.endsWith('s') ? '' : 's'
    return `${actor} paid ${quantity} ${itemTitle}${quantity === 1 ? '' : pluralSuffix}`
  }
  if (itemTitle) return `${actor} paid ${canonicalContributionTitle(itemTitle, record)}`
  return String(record?.display_message || record?.message || record?.title || 'Circle activity')
}

const humanize = (value: string, fallback = '') =>
  String(value || fallback)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim()

export const recordDirection = (record: Record<string, any>) => {
  const explicit = String(record?.meta?.direction || record?.direction || '').toLowerCase()
  if (explicit === 'credit' || explicit === 'debit') return explicit
  const activityType = String(record?.activity_type || '').toLowerCase()
  if (activityType === 'withdrawal' || activityType === 'approval') return 'debit'
  return 'credit'
}

export const recordAmountLabel = (record: Record<string, any>) => {
  const amountMajor = Number(record?.amount_cents || 0) / 100
  const signed = moneyFormat(Math.abs(amountMajor))
  return `${recordDirection(record) === 'debit' ? '-' : '+'}${signed}`
}

export const recordStatusLabel = (record: Record<string, any>) => {
  const activityType = String(record?.activity_type || '').toLowerCase()
  const status = String(record?.status || '').toLowerCase()
  if (activityType === 'approval') {
    if (status === 'pending_approval') return 'Pending approval'
    if (status === 'approved') return 'Approved'
    if (status === 'failed') return 'Failed'
    if (status === 'rejected') return 'Rejected'
  }
  if (status === 'approved') return 'Successful'
  if (status === 'disputed') return 'Disputed'
  if (status) return humanize(status)
  return activityType === 'approval' ? 'Pending approval' : 'Successful'
}

export const recordTitle = (record: Record<string, any>) => {
  const activityType = String(record?.activity_type || '').toLowerCase()
  const receiptCategory = String(record?.meta?.receipt_category || record?.receipt_category || '').toLowerCase()
  const socialNarration = activitySentence(record)
  const paymentItemTitle = canonicalContributionTitle(record?.payment_item_title || record?.payment_purpose_label, record)
  const paymentPurposeLabel = String(record?.payment_purpose_label || '').trim()
  if (receiptCategory === 'treasury_payout') return 'Shared fund payout'
  if (receiptCategory === 'incoming_transfer' && socialNarration) return socialNarration
  if (activityType === 'approval') return 'Withdrawal approval'
  if (paymentItemTitle) return paymentItemTitle
  if (paymentPurposeLabel) return paymentPurposeLabel
  if (activityType === 'due_payment') return 'Due payment'
  if (activityType === 'contribution') return 'Shared fund'
  if (activityType === 'withdrawal') return 'Withdrawal approval'
  return humanize(String(record?.kind || record?.activity_type || 'Circle record'), 'Circle record')
}

export const recordSubtitle = (record: Record<string, any>) => {
  const actor = activityActorName(record)
  const activityType = String(record?.activity_type || '').toLowerCase()
  const status = String(record?.status || '').toLowerCase()
  const quantity = Number(record?.meta?.payment_item_quantity || record?.payment_item_quantity || 0)
  const receiptCategory = String(record?.meta?.receipt_category || record?.receipt_category || '').toLowerCase()
  const title = recordTitle(record)
  const amountLabel = recordAmountLabel(record)
  const timeLabel = recordTimeLabel(record)

  if (activityType === 'approval') {
    const destination = `To ${actor} wallet`
    if (status === 'approved') return `Requested by ${actor} • ${destination}`
    if (status === 'failed') return `Requested by ${actor} • ${destination}`
    if (status === 'rejected') return `Requested by ${actor} • ${destination}`
    return `Requested by ${actor} • ${destination}`
  }

  if (receiptCategory === 'incoming_transfer') {
    return [actor || 'External transfer', amountLabel, timeLabel].filter(Boolean).join(' • ')
  }

  if (quantity > 1) {
    return `Paid by ${actor} • Qty ${quantity}`
  }

  if (receiptCategory === 'treasury_payout') {
    const bank = String(record?.meta?.beneficiary_bank_name || record?.destination?.bank_name || '').trim()
    const account = String(
      record?.meta?.beneficiary_account_number_masked ||
        record?.destination?.account_number ||
        record?.beneficiary_account_number ||
        ''
    ).trim()
    const narration = String(record?.meta?.narration || record?.narration || '').trim()
    const destination = [bank, account].filter(Boolean).join(' • ')
    const parts = [`Paid to ${destination || 'beneficiary bank account'}`]
    if (narration) parts.push(`Narration: ${narration}`)
    return parts.join(' • ')
  }

  if (activityType === 'withdrawal') {
    return `Paid to ${actor} wallet`
  }

  if (title.toLowerCase() === 'treasury contribution') {
    return `Funded by ${actor}`
  }

  return `Paid by ${actor}`
}

export const recordTimeLabel = (record: Record<string, any>) => {
  const raw = record?.occurred_at || record?.created_at || record?.updated_at
  if (!raw) return ''
  const parsed = new Date(String(raw))
  if (Number.isNaN(parsed.getTime())) return ''
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTarget = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  const diffDays = Math.floor((startOfToday.getTime() - startOfTarget.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return parsed.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
  })
}

const ActivityAvatar = ({ record }: { record: Record<string, any> }) => (
  <View className="h-11 w-11 rounded-full border border-cyan-400/15 bg-[#152033] items-center justify-center">
    <View className="h-9 w-9 rounded-full bg-cyan-400/12 items-center justify-center">
      <Text className="text-cyan-100 text-xs font-semibold">{activityActorInitials(record)}</Text>
    </View>
  </View>
)

const CircleActivityRow = ({
  record,
  onPress,
  compact = false,
}: {
  record: Record<string, any>
  onPress?: () => void
  compact?: boolean
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={!onPress}
    className={`rounded-2xl border border-gray-900 bg-gray-950 ${compact ? 'px-3 py-3' : 'px-4 py-4'}`}
  >
    <View className="flex-row items-start gap-3">
      <ActivityAvatar record={record} />
      <View className="flex-1">
        <Text className={`${compact ? 'text-sm' : 'text-[15px]'} font-semibold text-white`} numberOfLines={2}>
          {activitySentence(record)}
        </Text>
        <Text className="mt-1 text-xs text-gray-400" numberOfLines={2}>
          {activityPurposeLabel(record)}
        </Text>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <Text className="text-sm font-semibold text-gray-100">{activitySupportLabel(record)}</Text>
          <Text className="text-[11px] text-gray-500">{proofLabel(record)}</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
)

export const CircleShell = ({
  circleId,
  title,
  logoUrl,
  roleLabel,
  bucketLabel,
  active,
  onHome,
  onPay,
  onManage,
  onTreasury,
  onTimeline,
  showTreasuryTab,
  children,
}: {
  circleId: string
  title: string
  logoUrl?: string
  roleLabel: string
  bucketLabel?: string
  active: 'home' | 'pay' | 'manage' | 'people' | 'timeline' | 'treasury'
  onHome: () => void
  onPay: () => void
  onManage: () => void
  onTreasury?: () => void
  onTimeline: () => void
  showAdminTab?: boolean
  showTreasuryTab?: boolean
  children: React.ReactNode
}) => {
  const pill = (isActive: boolean) =>
    `rounded-full border px-4 py-2 ${isActive ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-700 bg-gray-900'}`
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { activeAccount, hydrated, selectBusinessAccount, selectCircleAccount, selectPersonalAccount } = useActiveAccount()
  const { onLogout } = useAuth()
  const [switchAccountOpen, setSwitchAccountOpen] = useState(false)
  const [businessLoading, setBusinessLoading] = useState(false)
  const [circlesLoading, setCirclesLoading] = useState(false)
  const [circlesError, setCirclesError] = useState<string | null>(null)
  const [businessAccounts, setBusinessAccounts] = useState<WorkspaceBusiness[]>([])
  const [circleAccounts, setCircleAccounts] = useState<WorkspaceCircle[]>([])
  const [logoLoadFailed, setLogoLoadFailed] = useState(false)

  useEffect(() => {
    setLogoLoadFailed(false)
  }, [logoUrl])

  useEffect(() => {
    if (!DEBUG_ENABLED) return
    log('[CIRCLE_HEADER_LOGO]', {
      circleId,
      title,
      hasLogoUrl: Boolean(logoUrl),
      logoUrl,
      logoLoadFailed,
    })
  }, [circleId, title, logoUrl, logoLoadFailed])

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
        entities
          .map((item: any) => ({
            id: String(item?.id || '').trim(),
            name: String(item?.name || 'Business account'),
            status: String(item?.status || ''),
            current_user_role: String(item?.current_user_role || item?.role || ''),
          }))
          .filter((item: WorkspaceBusiness) => item.id)
      )
    } catch {
      setBusinessAccounts([])
    } finally {
      setBusinessLoading(false)
    }
  }, [])

  const loadCircleAccounts = useCallback(async () => {
    setCirclesLoading(true)
    setCirclesError(null)
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
          .filter((item: WorkspaceCircle) => item.id)
      )
    } catch (error: any) {
      setCircleAccounts([])
      const status = error?.response?.status
      if (status === 401) {
        setCirclesError('Your session may have expired. Please log in again.')
      } else if (status === 403) {
        setCirclesError('You do not have access to shared groups yet.')
      } else {
        setCirclesError('Unable to load groups right now.')
      }
    } finally {
      setCirclesLoading(false)
    }
  }, [])

  const openSwitchAccountModal = useCallback(() => {
    setSwitchAccountOpen(true)
    void loadBusinessAccounts()
    void loadCircleAccounts()
  }, [loadBusinessAccounts, loadCircleAccounts])

  const activeIdentityName = useMemo(() => {
    if (activeAccount.type === 'circle') return title || 'Circle'
    if (activeAccount.type === 'business') {
      return (
        businessAccounts.find((item) => String(item.id) === String(activeAccount.businessId))?.name ||
        'Business account'
      )
    }
    return 'Personal account'
  }, [activeAccount, businessAccounts, title])

  const activeIdentityMeta = useMemo(() => {
    if (activeAccount.type === 'circle') {
      return [bucketLabel, roleLabel].filter(Boolean).join(' Â· ')
    }
    if (activeAccount.type === 'business') return 'Business workspace'
    return 'Personal'
  }, [activeAccount, bucketLabel, roleLabel])

  const canGoBack = typeof router.canGoBack === 'function' ? router.canGoBack() : false
  const fallbackRoute = active === 'home' ? '/circles' : `/circles/${circleId}`
  const fallbackLabel = active === 'home' ? 'All circles' : 'Circle home'

  const handleBack = useCallback(() => {
    if (canGoBack) {
      router.back()
      return
    }
    router.replace(fallbackRoute as any)
  }, [canGoBack, fallbackRoute, router])

  return (
    <View className="flex-1 bg-[#020712]">
      <View className="px-5 pb-4" style={{ paddingTop: Math.max(insets.top - 4, 8) }}>
        <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-4">
          <TouchableOpacity
            onPress={handleBack}
            className="mb-3 self-start rounded-full border border-gray-800 bg-gray-950 px-4 py-2"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="chevron-back" size={16} color="#cbd5e1" />
              <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-gray-200">
                {canGoBack ? 'Back' : fallbackLabel}
              </Text>
            </View>
          </TouchableOpacity>
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Circle</Text>
              <View className="mt-1 flex-row items-start gap-3">
                <View className="h-14 w-14 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5">
                  {logoUrl && !logoLoadFailed ? (
                    <Image
                      source={{ uri: logoUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                      onLoad={() => {
                        if (DEBUG_ENABLED) {
                          log('[CIRCLE_HEADER_LOGO] load_ok', { circleId, title, logoUrl })
                        }
                        setLogoLoadFailed(false)
                      }}
                      onError={() => {
                        if (DEBUG_ENABLED) {
                          log('[CIRCLE_HEADER_LOGO] load_error', { circleId, title, logoUrl })
                        }
                        setLogoLoadFailed(true)
                      }}
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center rounded-xl bg-slate-900">
                      <Text className="text-[13px] font-extrabold tracking-[1px] text-white">
                        {circleInitials(title)}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-[26px] font-semibold text-white">{title}</Text>
                  {bucketLabel ? <Text className="mt-1 text-sm text-gray-400">{bucketLabel}</Text> : null}
                </View>
              </View>
              <View className="mt-2 self-start rounded-full border border-gray-700 bg-gray-950 px-4 py-2">
                <Text className="text-sm text-gray-300">{roleLabel}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={openSwitchAccountModal}
              className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3"
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="swap-horizontal-outline" size={16} color="#cbd5e1" />
                <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-gray-200">Switcher</Text>
              </View>
            </TouchableOpacity>
          </View>
      <View className="mt-4 flex-row flex-wrap gap-3">
            <TouchableOpacity onPress={onHome} className={pill(active === 'home')}>
              <Text className="text-sm font-medium text-white">Overview</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onManage} className={pill(active === 'manage')}>
              <Text className="text-sm font-medium text-white">People</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onPay} className={pill(active === 'pay')}>
              <Text className="text-sm font-medium text-white">Payments</Text>
            </TouchableOpacity>
            {showTreasuryTab && onTreasury ? (
              <TouchableOpacity onPress={onTreasury} className={pill(active === 'treasury')}>
                <Text className="text-sm font-medium text-white">Shared Fund</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onTimeline} className={pill(active === 'timeline')}>
              <Text className="text-sm font-medium text-white">Activity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <KeyboardAvoidingView
        className="flex-1 px-5"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        {children}
      </KeyboardAvoidingView>
      <WorkspaceSwitcherModal
        open={switchAccountOpen}
        onClose={() => setSwitchAccountOpen(false)}
        activeAccount={activeAccount}
        activeIdentityName={activeIdentityName}
        activeIdentityMeta={activeIdentityMeta}
        activeIdentityBadge={roleLabel}
        accountHydrated={hydrated}
        businessLoading={businessLoading}
        circlesLoading={circlesLoading}
        circlesError={circlesError}
        businessAccounts={businessAccounts}
        circleAccounts={circleAccounts}
        selectedBusinessName={
          activeAccount.type === 'business'
            ? businessAccounts.find((item) => String(item.id) === String(activeAccount.businessId))?.name || null
            : null
        }
        selectedCircleName={
          activeAccount.type === 'circle'
            ? circleAccounts.find((item) => String(item.id) === String(activeAccount.circleId))?.name || title || null
            : null
        }
        onSelectPersonal={async () => {
          await selectPersonalAccount()
          router.replace('/(tabs)' as any)
        }}
        onSelectBusiness={async (businessId) => {
          await selectBusinessAccount(businessId)
          router.replace('/business' as any)
        }}
        onSelectCircle={async (targetCircleId) => {
          const selectedCircle = circleAccounts.find((item) => String(item.id) === String(targetCircleId))
          await selectCircleAccount(targetCircleId)
          router.replace(`/circles/${selectedCircle?.id || targetCircleId}` as any)
        }}
        onOpenCircles={() => router.push('/circles' as any)}
        onLogout={onLogout}
      />
    </View>
  )
}

export const TreasuryCard = ({
  balanceCents,
  onPay,
  statusLabel,
  helperLabel,
  detailRows,
}: {
  balanceCents: number
  onPay: () => void
  statusLabel?: string
  helperLabel?: string
  detailRows?: Array<{ label: string; value: string }>
}) => (
  <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
    <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Shared Fund</Text>
    <Text className="mt-3 text-[30px] font-semibold text-white">{moneyFormat(Number(balanceCents || 0) / 100)}</Text>
    {statusLabel ? <Text className="mt-2 text-sm text-gray-300">{statusLabel}</Text> : null}
    {helperLabel ? <Text className="mt-1 text-xs text-gray-400">{helperLabel}</Text> : null}
    {detailRows && detailRows.length > 0 ? (
      <View className="mt-4 flex-row flex-wrap gap-3">
        {detailRows.slice(0, 2).map((row) => (
          <View key={row.label} className="min-w-[46%] flex-1 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
            <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-500">{row.label}</Text>
            <Text className="mt-2 text-sm font-semibold text-white" numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    ) : null}
    <TouchableOpacity onPress={onPay} className="mt-5 rounded-2xl bg-cyan-400 px-4 py-4">
      <Text className="text-center text-sm font-semibold text-slate-950">Add to Shared Fund</Text>
    </TouchableOpacity>
  </View>
)

export const PaymentItemPreviewList = ({
  items,
  onSelect,
  title = 'Ways to pay',
}: {
  items: any[]
  onSelect: (item: any) => void
  title?: string
}) => (
  <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
    <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">{title}</Text>
    <Text className="mt-2 text-sm text-gray-400">Choose one payment option to continue.</Text>
    <View className="mt-4 gap-3">
      {items.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
          <Text className="text-sm text-gray-400">No money options are open right now.</Text>
        </View>
      ) : (
        items.slice(0, 5).map((item) => (
          <TouchableOpacity
            key={String(item?.key || item?.id || item?.title)}
            onPress={() => onSelect(item)}
            className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4"
          >
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">{paymentItemTitleLabel(item)}</Text>
                <Text className="mt-1 text-sm text-gray-400">{paymentItemMeta(item)}</Text>
              </View>
              <Text className="text-sm font-medium text-gray-200">{paymentItemAmount(item)}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  </View>
)

export const RecentRecords = ({
  records,
  onSelectRecord,
  framed = true,
}: {
  records: any[]
  onSelectRecord?: (record: any) => void
  framed?: boolean
}) => (
  <View className={framed ? 'rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5' : ''}>
    {framed ? <Text className="text-sm font-semibold text-white">Recent activity</Text> : null}
    <View className="mt-4 gap-3">
      {records.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
          <Text className="text-sm text-gray-400">No group activity yet. Payments, requests, and updates will appear here.</Text>
        </View>
      ) : (
        records.slice(0, 6).map((record, index) => (
          <CircleActivityRow
            key={String(record?.id || record?.reference || index)}
            record={record}
            onPress={() => onSelectRecord?.(record)}
            compact
          />
        ))
      )}
    </View>
  </View>
)

export const TimelineFeed = ({
  records,
  onSelectRecord,
}: {
  records: any[]
  onSelectRecord?: (record: any) => void
}) => (
  <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
    <Text className="text-sm font-semibold text-white">Activity</Text>
    <View className="mt-4 gap-3">
      {records.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
          <Text className="text-sm text-gray-400">No group activity yet. Payments, requests, and updates will appear here.</Text>
        </View>
      ) : (
        records.map((record, index) => (
          <CircleActivityRow
            key={String(record?.id || record?.reference || index)}
            record={record}
            onPress={() => onSelectRecord?.(record)}
          />
        ))
      )}
    </View>
  </View>
)

export const PaymentItemList = ({
  title = 'Ways to pay',
  items,
  selectedKey,
  onSelect,
}: {
  title?: string
  items: any[]
  selectedKey: string
  onSelect: (item: any) => void
}) => (
  <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
    <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">{title}</Text>
    <View className="mt-4 gap-3">
      {items.map((item) => {
        const selected = String(item?.key || item?.id || '') === String(selectedKey || '')
        const metaLabel = [paymentItemMeta(item), paymentItemBadge(item)].filter(Boolean).join(' · ')
        const identityLabel = paymentItemIdentityLabel(item)
        return (
          <TouchableOpacity
            key={String(item?.key || item?.id || item?.title)}
            onPress={() => onSelect(item)}
            className={`rounded-2xl border px-4 py-4 ${selected ? 'border-cyan-400 bg-cyan-500/10' : 'border-gray-900 bg-gray-950'}`}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-base font-semibold text-white">{paymentItemTitleLabel(item)}</Text>
                  {selected ? (
                    <View className="rounded-full border border-cyan-400/30 bg-cyan-400/15 px-2 py-1">
                      <Text className="text-[10px] font-semibold uppercase tracking-[1.2px] text-cyan-100">Selected</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="mt-1 text-sm text-gray-400">{metaLabel}</Text>
                {identityLabel ? <Text className="mt-1 text-xs text-gray-500">{identityLabel}</Text> : null}
              </View>
              <View className="items-end">
                <Text className="text-sm font-medium text-gray-200">{paymentItemAmount(item)}</Text>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'chevron-forward'}
                  size={18}
                  color={selected ? '#67e8f9' : '#64748b'}
                  style={{ marginTop: 10 }}
                />
              </View>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  </View>
)

export const PaymentCheckout = ({
  item,
  onContinue,
}: {
  item: Record<string, any> | null
  onContinue: () => void
}) => {
  if (!item) {
    return (
      <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
        <Text className="text-sm text-gray-400">Select a payment option to continue.</Text>
      </View>
    )
  }

  return (
    <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
      <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Pay into the group</Text>
      <Text className="mt-2 text-xl font-semibold text-white">{paymentItemTitleLabel(item)}</Text>
      <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
          <Text className="text-[10px] uppercase tracking-[1.5px] text-gray-500">Selected payment</Text>
        <Text className="mt-2 text-sm font-medium text-white">
          {[paymentItemMeta(item), paymentItemBadge(item)].filter(Boolean).join(' · ')}
        </Text>
        {paymentItemIdentityLabel(item) ? (
          <Text className="mt-2 text-xs text-gray-400">{paymentItemIdentityLabel(item)}</Text>
        ) : null}
        <Text className="mt-2 text-lg font-semibold text-white">{paymentItemAmount(item)}</Text>
      </View>
      <TouchableOpacity onPress={onContinue} className="mt-5 rounded-2xl bg-cyan-400 px-4 py-4">
        <Text className="text-center text-sm font-semibold text-slate-950">Continue with this payment</Text>
      </TouchableOpacity>
  </View>
)
}

