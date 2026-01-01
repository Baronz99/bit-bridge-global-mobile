import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { getCircle } from '@/api/circles'
import { FEATURE_CIRCLES } from '@/constants/featureFlags'

const getArray = (value: unknown) => (Array.isArray(value) ? value : [])

const extractCircle = (payload: unknown) => {
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    return (container.data as Record<string, unknown>) ?? container
  }
  return {}
}

const extractTimeline = (payload: unknown) => {
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    const circle = extractCircle(payload)
    return getArray(
      circle.timeline ??
        circle.feed ??
        container.timeline ??
        (container.data as Record<string, unknown> | undefined)?.timeline
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

const getTimelineText = (item: Record<string, unknown>) => {
  return (
    (item.text as string) ||
    (item.body as string) ||
    (item.message as string) ||
    (item.title as string) ||
    'Timeline update'
  )
}

const CircleDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id

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
  const timeline = useMemo(() => extractTimeline(data), [data])
  const title = getTitle(circle)
  const description = getDescription(circle)
  const memberCount =
    (circle.members_count as number) ||
    (circle.member_count as number) ||
    (Array.isArray(circle.members) ? circle.members.length : 0)

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
            <Text className="text-white text-xl font-semibold">{title}</Text>
            {description ? (
              <Text className="text-gray-300 text-sm mt-2">{description}</Text>
            ) : null}
            <Text className="text-gray-400 text-xs mt-3">{memberCount} members</Text>
          </View>

          <View className="px-4 mt-4">
            <Text className="text-white text-lg font-semibold mb-2">Timeline</Text>
            {timeline.length === 0 ? (
              <View className="bg-gray-900 p-4 rounded-xl">
                <Text className="text-gray-300 text-sm">No timeline updates yet.</Text>
              </View>
            ) : (
              timeline.map((item, index) => {
                const record = (item ?? {}) as Record<string, unknown>
                const key = String(record.id ?? record.uuid ?? `timeline-${index}`)
                const time =
                  (record.created_at as string) ||
                  (record.createdAt as string) ||
                  (record.timestamp as string) ||
                  ''

                return (
                  <View key={key} className="bg-gray-900 p-4 rounded-xl mb-3">
                    <Text className="text-white text-sm">{getTimelineText(record)}</Text>
                    {time ? (
                      <Text className="text-gray-400 text-xs mt-2">{time}</Text>
                    ) : null}
                  </View>
                )
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

export default CircleDetailScreen
