import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCircleWorkspace } from '@/api/circles'
import {
  CircleShell,
  circleBucketLabel,
  circleTitle,
  groupCircleActivityRecords,
} from '@/components/circles/rebuild'
import { extractCircleRecentActivity } from '@/utils/circleWorkspace'
import { decideHomeNavigation } from '@/utils/timelineRefs'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { canAccessManageCircle, canViewSharedFundTab } from '@/utils/circleWorkspace'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'
import { RecentRecords } from '@/components/circles/rebuild'
import {
  DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS,
  isCircleScreenCacheFresh,
  readCircleScreenCache,
  writeCircleScreenCache,
} from '@/utils/circleScreenCache'
import { useEffect } from 'react'

type CircleWorkspaceRecord = Record<string, unknown>
type CircleActivityRecord = Record<string, unknown>
type CircleTimelineCache = {
  workspace: CircleWorkspaceRecord | null
}

const CircleTimelineScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const cacheKey = circleId ? `circle-timeline:${circleId}` : ''
  const cachedTimeline = circleId ? readCircleScreenCache<CircleTimelineCache>(cacheKey)?.data ?? null : null
  const router = useRouter()
  const [workspace, setWorkspace] = useState<CircleWorkspaceRecord | null>(() => cachedTimeline?.workspace ?? null)
  const [loading, setLoading] = useState(() => !cachedTimeline)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const applyTimelinePayload = useCallback((payload: CircleTimelineCache) => {
    setWorkspace(payload.workspace)
  }, [])

  useEffect(() => {
    const nextCachedTimeline = circleId ? readCircleScreenCache<CircleTimelineCache>(cacheKey)?.data ?? null : null
    setWorkspace(nextCachedTimeline?.workspace ?? null)
    setLoading(!nextCachedTimeline)
    setRefreshing(false)
    setError('')
  }, [cacheKey, circleId])

  const loadTimeline = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    const cached = readCircleScreenCache<CircleTimelineCache>(cacheKey)
    const hasVisibleData = Boolean(workspace || cached?.data.workspace)
    if (isRefresh) setRefreshing(true)
    else if (!hasVisibleData) setLoading(true)
    setError('')
    try {
      if (!isRefresh && cached?.data && isCircleScreenCacheFresh(cacheKey, DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS)) {
        if (!workspace) applyTimelinePayload(cached.data)
        return
      }
      const response = await getCircleWorkspace(circleId)
      const nextPayload: CircleTimelineCache = { workspace: response || {} }
      applyTimelinePayload(nextPayload)
      writeCircleScreenCache(cacheKey, nextPayload)
    } catch {
      setError('Unable to load this circle timeline right now.')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [applyTimelinePayload, cacheKey, circleId, workspace])

  useFocusEffect(
    useCallback(() => {
      loadTimeline(false)
    }, [loadTimeline])
  )

  const records = useMemo(() => extractCircleRecentActivity(workspace), [workspace])
  const groupedRecords = useMemo(() => groupCircleActivityRecords(records), [records])
  const showAdminTab = canAccessManageCircle(workspace)
  const showTreasuryTab = canViewSharedFundTab(workspace)

  const handleRecordPress = useCallback(
    (record: CircleActivityRecord) => {
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

      router.replace(`/circles/${circleId}/timeline` as never)
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
        logoUrl={String(workspace?.logo_url || '')}
        roleLabel={getCircleRoleLabel(workspace)}
        bucketLabel={circleBucketLabel(workspace)}
        active="timeline"
        showAdminTab={showAdminTab}
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => router.push(`/circles/${circleId}/members` as never)}
        onTreasury={() => router.push(`/circles/${circleId}/treasury` as never)}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
        showTreasuryTab={showTreasuryTab}
      >
        <View className="flex-1 gap-3">
          <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">
            {records.length} group update{records.length === 1 ? '' : 's'}
          </Text>
          <View className="flex-1 rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            {records.length === 0 ? (
              <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
                <Text className="text-sm text-gray-400">No group activity yet. Payments, requests, and updates will appear here.</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 12 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTimeline(true)} />}
              >
                {groupedRecords.map((section, index) => {
                  const firstRecord = section.data[0]
                  const sectionKey = String(
                    firstRecord?.id ||
                      firstRecord?.reference ||
                      firstRecord?.occurred_at ||
                      firstRecord?.created_at ||
                      `${section.title}-${index}`
                  )

                  return (
                    <View key={sectionKey} className="mb-6">
                      <Text className="mb-3 text-sm font-semibold text-gray-300">{section.title}</Text>
                      <RecentRecords records={section.data} onSelectRecord={handleRecordPress} framed={false} />
                    </View>
                  )
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </CircleShell>
    </>
  )
}

export default CircleTimelineScreen
