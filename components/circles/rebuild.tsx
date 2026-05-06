import React, { useCallback, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getBusinessEntities } from '@/api/business'
import { listCircles } from '@/api/circles'
import WorkspaceSwitcherModal, { WorkspaceBusiness, WorkspaceCircle } from '@/components/workspace/WorkspaceSwitcherModal'
import { useActiveAccount } from '@/services/useActiveAccount'
import { useAuth } from '@/services/useAuth'
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

export const paymentItemBadge = (item: Record<string, any>) => {
  const status = String(item?.status || '').toLowerCase()
  if (status.includes('overdue')) return 'Overdue'
  if (status.includes('due')) return 'Due now'
  if (status.includes('current') || status.includes('paid')) return 'Paid up'
  if (String(item?.type || '').toLowerCase() === 'treasury_topup' || item?.support_fallback) return 'Optional'
  return 'Upcoming'
}

export const paymentItemMeta = (item: Record<string, any>) => {
  const mode = String(item?.payment_item_kind || item?.checkout_mode || item?.item_type || '').toLowerCase()
  if (mode === 'recurring') return 'Recurring'
  if (mode === 'fixed') return 'Fixed'
  if (mode === 'quantity') return 'Quantity based'
  if (mode === 'open') return item?.support_fallback ? 'Open support' : 'Open contribution'
  if (item?.support_fallback) return 'Open support'
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

export const paymentEventLabel = (record: Record<string, any>) => {
  const actorObject = record?.actor && typeof record.actor === 'object' && !Array.isArray(record.actor) ? record.actor : {}
  const actor = String(
    actorObject.display_name ||
      actorObject.name ||
      actorObject.fallback_name ||
      record?.actor_name ||
      record?.user_name ||
      record?.performed_by ||
      'Member'
  ).trim()
  const backendLabel = String(record?.label || record?.display_message || record?.description || record?.message || record?.title || '').trim()
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
  if (itemTitle) return `${actor} paid ${itemTitle}`
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
  const paymentItemTitle = String(record?.payment_item_title || '').trim()
  const paymentPurposeLabel = String(record?.payment_purpose_label || '').trim()
  if (activityType === 'approval') return 'Treasury withdrawal'
  if (paymentItemTitle) return paymentItemTitle
  if (paymentPurposeLabel) return paymentPurposeLabel
  if (activityType === 'due_payment') return 'Due payment'
  if (activityType === 'contribution') return 'Treasury top-up'
  if (activityType === 'withdrawal') return 'Treasury withdrawal'
  return humanize(String(record?.kind || record?.activity_type || 'Circle record'), 'Circle record')
}

export const recordSubtitle = (record: Record<string, any>) => {
  const actorObject = record?.actor && typeof record.actor === 'object' && !Array.isArray(record.actor) ? record.actor : {}
  const actor = String(
    actorObject.display_name ||
      actorObject.name ||
      actorObject.fallback_name ||
      record?.actor_name ||
      'Member'
  ).trim()
  const activityType = String(record?.activity_type || '').toLowerCase()
  const status = String(record?.status || '').toLowerCase()
  const quantity = Number(record?.meta?.payment_item_quantity || record?.payment_item_quantity || 0)
  const title = recordTitle(record)

  if (activityType === 'approval') {
    const destination = `To ${actor} wallet`
    if (status === 'approved') return `Requested by ${actor} • ${destination}`
    if (status === 'failed') return `Requested by ${actor} • ${destination}`
    if (status === 'rejected') return `Requested by ${actor} • ${destination}`
    return `Requested by ${actor} • ${destination}`
  }

  if (quantity > 1) {
    return `Paid by ${actor} • Qty ${quantity}`
  }

  if (activityType === 'withdrawal') {
    return `Paid to ${actor} wallet`
  }

  if (title.toLowerCase() === 'treasury top-up') {
    return `Funded by ${actor}`
  }

  return `Paid by ${actor}`
}

export const recordTimeLabel = (record: Record<string, any>) => {
  const raw = record?.occurred_at || record?.created_at || record?.updated_at
  if (!raw) return ''
  const parsed = new Date(String(raw))
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const CircleShell = ({
  circleId,
  title,
  roleLabel,
  bucketLabel,
  active,
  onHome,
  onPay,
  onManage,
  onTimeline,
  children,
}: {
  circleId: string
  title: string
  roleLabel: string
  bucketLabel?: string
  active: 'home' | 'pay' | 'manage' | 'timeline'
  onHome: () => void
  onPay: () => void
  onManage: () => void
  onTimeline: () => void
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
  const [businessAccounts, setBusinessAccounts] = useState<WorkspaceBusiness[]>([])
  const [circleAccounts, setCircleAccounts] = useState<WorkspaceCircle[]>([])

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

  return (
    <View className="flex-1 bg-[#020712]">
      <View className="px-5 pb-5" style={{ paddingTop: Math.max(insets.top, 12) }}>
        <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Circle</Text>
              <Text className="mt-2 text-[28px] font-semibold text-white">{title}</Text>
              {bucketLabel ? <Text className="mt-2 text-sm text-gray-400">{bucketLabel}</Text> : null}
              <View className="mt-3 self-start rounded-full border border-gray-700 bg-gray-950 px-4 py-2">
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
          <View className="mt-5 flex-row flex-wrap gap-3">
            <TouchableOpacity onPress={onHome} className={pill(active === 'home')}>
              <Text className="text-sm font-medium text-white">Home</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onPay} className={pill(active === 'pay')}>
              <Text className="text-sm font-medium text-white">Pay</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onManage} className={pill(active === 'manage')}>
              <Text className="text-sm font-medium text-white">Manage</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onTimeline} className={pill(active === 'timeline')}>
              <Text className="text-sm font-medium text-white">Timeline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View className="flex-1 px-5">{children}</View>
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
}: {
  balanceCents: number
  onPay: () => void
}) => (
  <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
    <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Treasury</Text>
    <Text className="mt-3 text-[30px] font-semibold text-white">{moneyFormat(Number(balanceCents || 0) / 100)}</Text>
    <TouchableOpacity onPress={onPay} className="mt-5 rounded-2xl bg-cyan-400 px-4 py-4">
      <Text className="text-center text-sm font-semibold text-slate-950">Pay into Circle</Text>
    </TouchableOpacity>
  </View>
)

export const PaymentItemPreviewList = ({
  items,
  onSelect,
}: {
  items: any[]
  onSelect: (item: any) => void
}) => (
  <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
    <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Payment Items</Text>
    <View className="mt-4 gap-3">
      {items.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
          <Text className="text-sm text-gray-400">No active payment items yet.</Text>
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
                <Text className="text-base font-semibold text-white">{item?.title}</Text>
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
}: {
  records: any[]
  onSelectRecord?: (record: any) => void
}) => (
  <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
    <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Recent Records</Text>
    <View className="mt-4 gap-3">
      {records.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
          <Text className="text-sm text-gray-400">No records yet.</Text>
        </View>
      ) : (
        records.slice(0, 6).map((record, index) => (
          <TouchableOpacity
            key={String(record?.id || record?.reference || index)}
            onPress={() => onSelectRecord?.(record)}
            disabled={!onSelectRecord}
            className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-white">{paymentEventLabel(record)}</Text>
                <Text className="mt-1 text-xs text-gray-400">{recordSubtitle(record)}</Text>
                <Text className="mt-2 text-[11px] text-gray-500">
                  {[recordStatusLabel(record), recordTimeLabel(record)].filter(Boolean).join(' • ')}
                </Text>
              </View>
              <Text className={`text-sm font-semibold ${recordDirection(record) === 'debit' ? 'text-amber-200' : 'text-emerald-200'}`}>
                {recordAmountLabel(record)}
              </Text>
            </View>
          </TouchableOpacity>
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
    <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Timeline</Text>
    <View className="mt-4 gap-3">
      {records.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
          <Text className="text-sm text-gray-400">No records yet.</Text>
        </View>
      ) : (
        records.map((record, index) => (
          <TouchableOpacity
            key={String(record?.id || record?.reference || index)}
            onPress={() => onSelectRecord?.(record)}
            disabled={!onSelectRecord}
            className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4"
          >
            <Text className="text-sm font-medium text-white">{paymentEventLabel(record)}</Text>
            <Text className="mt-1 text-xs text-gray-500">
              {[recordStatusLabel(record), recordTimeLabel(record)].filter(Boolean).join(' • ')}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  </View>
)

export const PaymentItemList = ({
  items,
  selectedKey,
  onSelect,
}: {
  items: any[]
  selectedKey: string
  onSelect: (item: any) => void
}) => (
  <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
    <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Payment Items</Text>
    <View className="mt-4 gap-3">
      {items.map((item) => {
        const selected = String(item?.key || item?.id || '') === String(selectedKey || '')
        return (
          <TouchableOpacity
            key={String(item?.key || item?.id || item?.title)}
            onPress={() => onSelect(item)}
            className={`rounded-2xl border px-4 py-4 ${selected ? 'border-cyan-400 bg-cyan-500/10' : 'border-gray-900 bg-gray-950'}`}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">{item?.title}</Text>
                <Text className="mt-1 text-sm text-gray-400">{paymentItemMeta(item)}</Text>
                <Text className="mt-2 text-xs font-medium text-gray-500">{paymentItemBadge(item)}</Text>
              </View>
              <Text className="text-sm font-medium text-gray-200">{paymentItemAmount(item)}</Text>
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
        <Text className="text-sm text-gray-400">Select a payment item to continue.</Text>
      </View>
    )
  }

  return (
    <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
      <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Checkout</Text>
      <Text className="mt-2 text-xl font-semibold text-white">{item?.title}</Text>
      <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-400">Rule</Text>
          <Text className="text-sm font-medium text-white">{paymentItemAmount(item)}</Text>
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-sm text-gray-400">Status</Text>
          <Text className="text-sm font-medium text-white">{paymentItemBadge(item)}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onContinue} className="mt-5 rounded-2xl bg-cyan-400 px-4 py-4">
        <Text className="text-center text-sm font-semibold text-slate-950">Continue to payment</Text>
      </TouchableOpacity>
    </View>
  )
}
