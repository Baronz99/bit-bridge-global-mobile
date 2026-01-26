import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { listTimeline, TimelineQuery } from '@/api/timeline'
import { FEATURE_TIMELINE } from '@/constants/featureFlags'
import ScreenContainer from '@/components/ScreenContainer'
import PremiumTabs from '@/components/timeline/PremiumTabs'
import TimelineSectionList from '@/components/timeline/TimelineSectionList'
import SkeletonTimeline from '@/components/timeline/SkeletonTimeline'
import FilterBottomSheet, { TimelineFilterState } from '@/components/timeline/FilterBottomSheet'
import AppModal from '@/components/modal/Modal'
import { MOCK_TIMELINE } from '@/components/timeline/mockData'

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
  return raw.toLowerCase()
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

const getSecondaryCategory = (kind: string, record: Record<string, unknown>) => {
  const meta = (record.meta as Record<string, unknown>) || {}
  const txType = String(meta.transaction_type || '').toLowerCase()
  const status = String(record.status || '').toLowerCase()
  const label = getTimelineText(record).toLowerCase()

  if (label.includes('dispute') || status.includes('dispute')) return 'disputes'
  if (label.includes('reward')) return 'rewards'
  if (kind.includes('bill')) return 'subscriptions'
  if (kind.includes('circle')) return 'circles'
  if (kind.includes('card')) return 'money_out'
  if (txType === 'deposit') return 'money_in'
  if (txType === 'withdrawal') return 'money_out'
  if (label.includes('transfer')) return 'transfers'
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
    if (!FEATURE_TIMELINE) {
      setItems(MOCK_TIMELINE as unknown as Record<string, unknown>[])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await listTimeline(buildQuery())
      const payload = res as Record<string, unknown>
      const list = extractTimeline(payload)
      const cursor = (payload?.next_cursor as string) || null
      setItems(list as Record<string, unknown>[])
      setNextCursor(cursor)
    } catch (err: any) {
      setError('Unable to load timeline right now.')
      if (__DEV__) {
        setItems(MOCK_TIMELINE as unknown as Record<string, unknown>[])
      }
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    loadTimeline()
  }, [loadTimeline])

  useEffect(() => {
    if (filters.type !== 'all' && filters.type !== activeTab) {
      setActiveTab(filters.type)
    }
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
      const payload = res as Record<string, unknown>
      const list = extractTimeline(payload)
      const cursor = (payload?.next_cursor as string) || null
      setItems((prev) => [...prev, ...(list as Record<string, unknown>[])] )
      setNextCursor(cursor)
    } catch {
      setNextCursor(null)
    }
  }

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const primaryFiltered =
      activeTab === 'all'
        ? items
        : items.filter((item) => getTimelineKind(item).includes(activeTab))

    const secondaryFiltered =
      secondaryFilter === 'all'
        ? primaryFiltered
        : primaryFiltered.filter(
            (item) => getSecondaryCategory(getTimelineKind(item), item) === secondaryFilter
          )

    const alertFiltered = filters.showAlerts
      ? secondaryFiltered
      : secondaryFiltered.filter(
          (item) => getSecondaryCategory(getTimelineKind(item), item) !== 'alerts'
        )

    if (!term) return alertFiltered
    return alertFiltered.filter((item) => getTimelineText(item).toLowerCase().includes(term))
  }, [items, activeTab, secondaryFilter, searchTerm, filters.showAlerts])

  const sections = useMemo(() => {
    const grouped: Record<string, Record<string, unknown>[]> = {}
    filteredItems.forEach((item) => {
      const group = getDateGroup(getTimelineTimestamp(item))
      grouped[group] = grouped[group] ? [...grouped[group], item] : [item]
    })
    return Object.entries(grouped).map(([title, data]) => ({ title, data }))
  }, [filteredItems])

  const emptyCopy = useMemo(() => {
    if (activeTab === 'wallet') return 'No wallet activity yet.'
    if (activeTab === 'cards') return 'No card activity yet.'
    if (activeTab === 'bills') return 'No bill activity yet.'
    if (activeTab === 'circles') return 'No circle activity yet.'
    return 'No updates yet.'
  }, [activeTab])

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
                  <Text className={active ? 'text-black text-xs' : 'text-gray-300 text-xs'}>
                    {filter.label}
                  </Text>
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
          <TouchableOpacity
            onPress={loadTimeline}
            className="bg-orange-700 px-4 py-2 rounded-lg"
          >
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
          onPressItem={(item) => router.push({ pathname: '/timeline/[id]', params: { id: String(item.id) } })}
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
          <Text className="text-gray-400 text-center text-xs mb-4">
            Find an activity by text, status, or reference.
          </Text>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search timeline"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white"
          />
          <TouchableOpacity
            onPress={() => setSearchOpen(false)}
            className="bg-app-primary py-3 rounded-xl items-center mt-4"
          >
            <Text className="text-black text-sm font-semibold">Done</Text>
          </TouchableOpacity>
        </View>
      </AppModal>

      <FilterBottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
      />
    </ScreenContainer>
  )
}

export default TimelineScreen
