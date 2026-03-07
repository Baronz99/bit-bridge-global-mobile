// app/(tabs)/timeline.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { listTimeline, TimelineQuery } from '@/api/timeline'
import ScreenContainer from '@/components/ScreenContainer'
import PremiumTabs from '@/components/timeline/PremiumTabs'
import TimelineSectionList from '@/components/timeline/TimelineSectionList'
import SkeletonTimeline from '@/components/timeline/SkeletonTimeline'
import FilterBottomSheet, { TimelineFilterState } from '@/components/timeline/FilterBottomSheet'
import AppModal from '@/components/modal/Modal'
import { extractReceiptReference, getTimelineId, isWalletTimelineId } from '@/utils/timelineRefs'
import { log } from '@/utils/logger'

const PRIMARY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'cards', label: 'Cards' },
  { key: 'bills', label: 'Bills' },
  { key: 'circles', label: 'Circles' },
]

const SECONDARY_FILTERS = [
  { key: 'all', label: 'All activity' },
  { key: 'money_in', label: 'Money In' },
  { key: 'money_out', label: 'Money Out' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'subscriptions', label: 'Subscriptions/Bills' },
  { key: 'circles', label: 'Circle Events' },
  { key: 'alerts', label: 'Alerts/Updates' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'rewards', label: 'Rewards' },
]

const getTimelineKind = (record: Record<string, unknown>) => {
  const raw = (record.kind as string) || (record.type as string) || ''
  return String(raw || '').toLowerCase()
}

const getTimelineTimestamp = (record: Record<string, unknown>) => {
  return (
    (record.occurred_at as string) ||
    (record.created_at as string) ||
    (record.createdAt as string) ||
    (record.timestamp as string) ||
    ''
  )
}

const getTimelineText = (record: Record<string, unknown>) => {
  return (
    (record.label as string) ||
    (record.title as string) ||
    (record.text as string) ||
    (record.message as string) ||
    'Timeline update'
  )
}

const getDateGroup = (value: string) => {
  if (!value) return 'Earlier'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Earlier'
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startOfDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
  const diffDays = Math.floor((startOfToday - startOfDate) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * ✅ Better categorization so wallet purchases/transfers don't "disappear"
 * under secondary filters.
 */
const getSecondaryCategory = (kind: string, record: Record<string, unknown>) => {
  const meta: any = (record as any).meta || {}
  const txType = String(meta.transaction_type || meta.transactionType || '').toLowerCase()
  const status = String((record as any).status || meta.status || '').toLowerCase()
  const label = getTimelineText(record).toLowerCase()
  const desc = String(meta.description ?? meta.address ?? '').toLowerCase()

  if (label.includes('dispute') || status.includes('dispute')) return 'disputes'
  if (label.includes('reward')) return 'rewards'

  // bills/subscriptions
  if (kind.includes('bill') || txType.includes('bill') || label.includes('bill')) return 'subscriptions'

  // circles
  if (kind.includes('circle') || txType.includes('circle')) return 'circles'

  // transfers
  if (txType.includes('transfer') || label.includes('transfer') || desc.includes('transfer')) return 'transfers'

  // money in (credits)
  if (
    txType === 'deposit' ||
    txType.includes('credit') ||
    label.includes('funded') ||
    desc.includes('fund') ||
    desc.includes('credit')
  )
    return 'money_in'

  // money out (debits/purchases)
  if (
    txType === 'withdrawal' ||
    txType === 'purchase' ||
    txType.includes('debit') ||
    label.includes('purchase') ||
    desc.includes('purchase') ||
    desc.includes('debit')
  )
    return 'money_out'

  // card-ish activity
  if (kind.includes('card') || txType.includes('card') || desc.includes('card')) return 'money_out'

  return 'alerts'
}

const extractTimeline = (payload: unknown) => {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    const data = container.data ?? container.timeline ?? container.items ?? container.results
    return Array.isArray(data) ? data : []
  }
  return []
}

const logTimelineSource = (
  source: 'API' | 'EMPTY',
  list: Record<string, unknown>[],
  extra?: Record<string, unknown>
) => {
  log('[TimelineData]', {
    SOURCE: source,
    count: list.length,
    first2: list.slice(0, 2),
    ...(extra || {}),
  })
}

/**
 * ✅ IMPORTANT:
 * CardReceipt endpoint expects LOCAL Card.id (UUID/hex-ish) in /cards/:id/details and /cards/:id/history.
 * Your timeline meta uses bridge_card_id but in your logs it equals the local id you're calling.
 */
const getCardIdFromTimeline = (record: Record<string, unknown>) => {
  const meta = (record.meta as Record<string, any>) || {}

  const candidates = [
    meta.card_id,
    meta.cardId,
    meta.virtual_card_id,
    meta.virtualCardId,

    // timeline meta uses this key; in your logs it matches local id used in /cards/:id/*
    meta.bridge_card_id,
    meta.bridgeCardId,

    meta.card?.id,
    meta.card?.uuid,
    meta.card?.card_id,
    meta.card?.cardId,
    meta.card?.bridge_card_id,
    meta.card?.bridgeCardId,
    meta.card?.virtual_card_id,
    meta.card?.virtualCardId,

    (record as any).card_id,
    (record as any).cardId,
    (record as any).bridge_card_id,
    (record as any).bridgeCardId,
  ]

  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (v) return v
  }

  return ''
}

/**
 * ✅ Prevent "everything with bridge_card_id" from hijacking navigation to CardReceipt.
 * Only treat as card-linked if it looks like a card action (purchase/funding/etc).
 */
const isCardLinkedWalletTxn = (item: Record<string, unknown>) => {
  const meta: any = (item as any)?.meta || {}
  const txType = String(meta.transaction_type ?? meta.transactionType ?? '').toLowerCase()
  const desc = String(meta.description ?? meta.address ?? (item as any).label ?? '').toLowerCase()

  if (!txType && !desc) return false

  if (txType.includes('card')) return true
  if (txType === 'purchase' || txType === 'debit') return true
  if (desc.includes('virtual card')) return true
  if (desc.includes('card purchase')) return true
  if (desc.includes('card funding')) return true
  if (desc.includes('bridge')) return true

  return false
}

/**
 * ✅ CardReceipt fallback params
 */
const getCardReceiptNavParams = (item: Record<string, unknown>) => {
  const record: any = (item as any) || {}
  const meta: any = record.meta || {}

  const cardId = getCardIdFromTimeline(record)

  const centsRaw = record.amount_cents ?? record.amountCents ?? meta.amount_cents ?? meta.amountCents ?? null
  const amountCents = Number.isFinite(Number(centsRaw)) ? Number(centsRaw) : null
  const amount = amountCents == null ? '' : String(amountCents / 100)

  const status = String(record.status ?? meta.status ?? '')
  const created_at = String(record.occurred_at ?? record.created_at ?? meta.occurred_at ?? meta.created_at ?? '')
  const description = String(record.label ?? record.description ?? meta.description ?? meta.address ?? '')
  const currency = String(meta.currency ?? record.currency ?? 'USD')

  const reference = String(
    meta.transaction_record_reference ??
      meta.transactionRecordReference ??
      meta.reference ??
      record.reference ??
      ''
  )

  return {
    id: cardId,
    amount,
    amount_cents: amountCents == null ? '' : String(amountCents),
    status,
    created_at,
    description,
    currency,
    reference,
  }
}

const TimelineScreen = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [secondaryFilter, setSecondaryFilter] = useState('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [filters, setFilters] = useState<TimelineFilterState>({
    startDate: '',
    endDate: '',
    status: 'all',
    type: 'all',
    minAmount: '',
    maxAmount: '',
    source: 'all',
    showAlerts: true,
  })

  const buildQuery = useCallback(
    (cursor?: string): TimelineQuery => ({
      cursor,
      limit: 25,
      type: activeTab,
      status: filters.status,
      startDate: filters.startDate,
      endDate: filters.endDate,
      minAmount: filters.minAmount,
      maxAmount: filters.maxAmount,
      source: filters.source,
      showAlerts: filters.showAlerts,
      search: searchTerm,
    }),
    [activeTab, filters, searchTerm]
  )

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listTimeline(buildQuery())
      const payload = (res as any)?.data ?? res
      const list = extractTimeline(payload)
      const cursor = (payload?.next_cursor as string) || (payload as any)?.data?.next_cursor || null
      setItems(list as Record<string, unknown>[])
      setNextCursor(cursor)
      logTimelineSource('API', list as Record<string, unknown>[], {
        next_cursor: cursor || null,
      })

      if ((list as any[])?.length === 0) {
        logTimelineSource('EMPTY', [], { reason: 'api_response_empty_or_unexpected_shape' })
      }

      if (__DEV__) {
        const kinds = Array.from(
          new Set((list as any[]).map((x) => String(x?.kind || x?.type || '').toLowerCase()))
        ).slice(0, 25)
        log('[Timeline] loaded', { count: (list as any[])?.length, kinds })
      }
    } catch (error: any) {
      log('[Timeline] load failed', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      })
      setError('Unable to load timeline right now.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    loadTimeline()
  }, [loadTimeline])

  useEffect(() => {
    if (filters.type !== 'all' && filters.type !== activeTab) setActiveTab(filters.type)
  }, [filters.type, activeTab])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTimeline()
    setRefreshing(false)
  }

  const handleNext = async () => {
    if (!nextCursor || loading) return
    try {
      const res = await listTimeline(buildQuery(nextCursor))
      const payload = (res as any)?.data ?? res
      const list = extractTimeline(payload)
      const cursor = (payload?.next_cursor as string) || (payload as any)?.data?.next_cursor || null
      setItems((prev) => [...prev, ...(list as Record<string, unknown>[])])
      setNextCursor(cursor)
    } catch (error: any) {
      log('[Timeline] next page failed', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      })
      setNextCursor(null)
    }
  }

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    // primary tab: allow either exact match or "wallet_transaction" etc.
    const primaryFiltered =
      activeTab === 'all'
        ? items
        : items.filter((item) => {
            const k = getTimelineKind(item)
            if (!k) return false
            if (activeTab === 'wallet') return k.includes('wallet')
            if (activeTab === 'cards') return k.includes('card')
            if (activeTab === 'bills') return k.includes('bill')
            if (activeTab === 'circles') return k.includes('circle')
            return k.includes(activeTab)
          })

    const secondaryFiltered =
      secondaryFilter === 'all'
        ? primaryFiltered
        : primaryFiltered.filter((item) => getSecondaryCategory(getTimelineKind(item), item) === secondaryFilter)

    const alertFiltered = filters.showAlerts
      ? secondaryFiltered
      : secondaryFiltered.filter((item) => getSecondaryCategory(getTimelineKind(item), item) !== 'alerts')

    if (!term) return alertFiltered
    return alertFiltered.filter((item) => getTimelineText(item).toLowerCase().includes(term))
  }, [items, activeTab, secondaryFilter, searchTerm, filters.showAlerts])

  const sections = useMemo(() => {
    const grouped: Record<string, Record<string, unknown>[]> = {}
    filteredItems.forEach((item) => {
      const group = getDateGroup(getTimelineTimestamp(item))
      grouped[group] = grouped[group] ? [...grouped[group], item] : [item]
    })

    const groupOrder = Object.entries(grouped).map(([title, data]) => {
      const newest =
        data
          .map((x) => new Date(getTimelineTimestamp(x)).getTime())
          .filter((t) => Number.isFinite(t))
          .sort((a, b) => b - a)[0] ?? 0
      return { title, data, newest }
    })

    groupOrder.sort((a, b) => b.newest - a.newest)
    return groupOrder.map(({ title, data }) => ({ title, data }))
  }, [filteredItems])

  const emptyCopy = useMemo(() => {
    if (activeTab === 'wallet') return 'No wallet activity yet.'
    if (activeTab === 'cards') return 'No card activity yet.'
    if (activeTab === 'bills') return 'No bill activity yet.'
    if (activeTab === 'circles') return 'No circle activity yet.'
    return 'No updates yet.'
  }, [activeTab])

  /**
   * ✅ Routing priority:
   * 1) CardReceipt only if cardId exists AND it truly looks like a card-linked wallet txn.
   * 2) If receipt reference exists -> /transaction/receipt
   * 3) wallet-tx-* with no receipt ref -> modal
   * 4) else /timeline/[id]
   */
  const handlePressItem = useCallback(
    (item: Record<string, unknown>) => {
      const id = getTimelineId(item)
      const kind = getTimelineKind(item)
      const cardId = getCardIdFromTimeline(item)
      const receiptRef = extractReceiptReference(item as any, { allowWalletTx: true })
      const metaKeys = Object.keys((((item as any)?.meta ?? {}) as any) || {})

      log('[Timeline] pressed item', { id, kind, cardId, receiptRef, metaKeys })

      // 1) CardReceipt only when truly card-linked
      if (cardId && isCardLinkedWalletTxn(item)) {
        const p = getCardReceiptNavParams(item)
        router.push({
          pathname: '/transaction/card-receipt',
          params: {
            cardId: String(cardId),
            reference: String(p.reference || ''),
            id: String(p.id || ''),
            amount: String(p.amount || ''),
            status: String(p.status || ''),
            created_at: String(p.created_at || ''),
            description: String(p.description || ''),
            currency: String(p.currency || 'USD'),
          },
        } as any)
        return
      }

      // 2) Receipt reference => canonical receipt screen (always fetches backend truth)
      if (receiptRef) {
        router.push({ pathname: '/transaction/receipt', params: { reference: receiptRef } } as any)
        return
      }

      // 3) Social/detail fallback (circles, alerts, etc.)
      if (id) {
        router.push({ pathname: '/timeline/[id]', params: { id } } as any)
        return
      }

      router.push('/(tabs)/timeline' as any)
    },
    [router]
  )

  return (
    <ScreenContainer scroll={false}>
      <View className="pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white text-2xl font-semibold">Timeline</Text>
            <Text className="text-gray-400 text-xs mt-1">All your activity in one feed.</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setSearchOpen(true)}
              className="bg-gray-900 border border-gray-800 px-3 py-2 rounded-full"
            >
              <Text className="text-white text-xs">Search</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterOpen(true)}
              className="bg-gray-900 border border-gray-800 px-3 py-2 rounded-full"
            >
              <Text className="text-white text-xs">Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <PremiumTabs tabs={PRIMARY_TABS} activeKey={activeTab} onChange={setActiveTab} />

      <View className="mt-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row items-center gap-2">
            {SECONDARY_FILTERS.map((filter) => {
              const active = secondaryFilter === filter.key
              return (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setSecondaryFilter(filter.key)}
                  className={`px-4 py-2 rounded-full border ${
                    active ? 'bg-gray-100 border-gray-200' : 'bg-gray-900 border-gray-800'
                  }`}
                >
                  <Text className={active ? 'text-black text-xs' : 'text-gray-300 text-xs'}>{filter.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <SkeletonTimeline />
      ) : error ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-white text-center mb-4">{error}</Text>
          <TouchableOpacity onPress={loadTimeline} className="bg-orange-700 px-4 py-2 rounded-lg">
            <Text className="text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-white text-center mb-2">{emptyCopy}</Text>
          <Text className="text-gray-400 text-xs">New activity will appear here.</Text>
        </View>
      ) : (
        <TimelineSectionList
          sections={sections}
          onPressItem={handlePressItem}
          onEndReached={handleNext}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListFooterComponent={
            nextCursor ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#f59e0b" />
              </View>
            ) : null
          }
        />
      )}

      <AppModal open={searchOpen} onclose={() => setSearchOpen(false)}>
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
          <Text className="text-white text-lg font-semibold text-center mb-2">Search</Text>
          <Text className="text-gray-400 text-center text-xs mb-4">Find an activity by text, status, or reference.</Text>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search timeline"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white"
          />
          <TouchableOpacity onPress={() => setSearchOpen(false)} className="bg-app-primary py-3 rounded-xl items-center mt-4">
            <Text className="text-black text-sm font-semibold">Done</Text>
          </TouchableOpacity>
        </View>
      </AppModal>

      <FilterBottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onChange={setFilters} />
    </ScreenContainer>
  )
}

export default TimelineScreen
