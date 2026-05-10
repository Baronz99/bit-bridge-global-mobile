import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCircleWorkspace } from '@/api/circles'
import {
  CircleShell,
  TimelineFeed,
  circleBucketLabel,
  circleTitle,
} from '@/components/circles/rebuild'
import { extractCircleRecentActivity } from '@/utils/circleWorkspace'
import { decideHomeNavigation } from '@/utils/timelineRefs'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'

const CircleTimelineScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadTimeline = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const response = await getCircleWorkspace(circleId)
      setWorkspace(response || {})
    } catch (_) {
      setError('Unable to load this circle timeline right now.')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [circleId])

  useFocusEffect(
    useCallback(() => {
      loadTimeline(false)
    }, [loadTimeline])
  )

  const records = useMemo(() => extractCircleRecentActivity(workspace), [workspace])

  const handleRecordPress = useCallback(
    (record: Record<string, any>) => {
      const decision = decideHomeNavigation(record)
      if (decision.type === 'receipt') {
        router.push({
          pathname: '/transaction/receipt',
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

      router.replace(`/circles/${circleId}/timeline` as any)
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
        active="timeline"
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => replaceCircleWorkspaceSection(router, String(circleId), 'manage')}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTimeline(true)} />}
        >
          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Timeline</Text>
            <Text className="mt-2 text-xl font-semibold text-white">
              {records.length} recorded update{records.length === 1 ? '' : 's'}
            </Text>
            <Text className="mt-2 text-sm text-gray-400">
              Every dues payment, contribution, fine, and treasury update in one record.
            </Text>
            <TouchableOpacity onPress={() => router.push(`/circles/${circleId}/pay` as any)} className="mt-5 rounded-2xl bg-cyan-400 px-4 py-4">
              <Text className="text-center text-sm font-semibold text-slate-950">Open payments</Text>
            </TouchableOpacity>
          </View>
          <TimelineFeed records={records} onSelectRecord={handleRecordPress} />
        </ScrollView>
      </CircleShell>
    </>
  )
}

export default CircleTimelineScreen
