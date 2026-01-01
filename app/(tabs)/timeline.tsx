import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native'
import { listTimeline } from '@/api/timeline'
import { FEATURE_TIMELINE } from '@/constants/featureFlags'

const getArray = (value: unknown) => (Array.isArray(value) ? value : [])

const extractTimeline = (payload: unknown) => {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    const data = container.data ?? container.timeline ?? container.items ?? container.results
    return getArray(data)
  }
  return []
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

const TimelineScreen = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<unknown>(null)

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listTimeline()
      setData(res)
    } catch {
      setError('Unable to load timeline right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!FEATURE_TIMELINE) return
    loadTimeline()
  }, [loadTimeline])

  const items = useMemo(() => extractTimeline(data), [data])

  if (!FEATURE_TIMELINE) {
    return (
      <View className="flex-1 bg-primary justify-center items-center px-6">
        <Text className="text-white text-base">Timeline is not available yet.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary">
      <View className="px-4 pt-6 pb-3">
        <Text className="text-white text-lg font-semibold">Timeline</Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="small" color="#ffcc00" />
          <Text className="text-white mt-3">Loading timeline...</Text>
        </View>
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
      ) : items.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-white text-center mb-4">No updates yet.</Text>
          <TouchableOpacity
            onPress={loadTimeline}
            className="bg-orange-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-white">Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => {
            const record = item as Record<string, unknown>
            const id = record.id ?? record.uuid ?? record.slug
            return id ? String(id) : `timeline-${index}`
          }}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const record = (item ?? {}) as Record<string, unknown>
            const time =
              (record.created_at as string) ||
              (record.createdAt as string) ||
              (record.timestamp as string) ||
              ''
            return (
              <View className="bg-gray-900 mx-4 my-2 p-4 rounded-xl">
                <Text className="text-white text-sm">{getTimelineText(record)}</Text>
                {time ? <Text className="text-gray-400 text-xs mt-2">{time}</Text> : null}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

export default TimelineScreen
