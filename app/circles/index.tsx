import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native'
import { Link } from 'expo-router'
import { listCircles } from '@/api/circles'
import { FEATURE_CIRCLES } from '@/constants/featureFlags'

const getArray = (value: unknown) => (Array.isArray(value) ? value : [])

const extractCircles = (payload: unknown) => {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    const data = container.data ?? container.circles ?? container.items ?? container.results
    return getArray(data)
  }
  return []
}

const getCircleTitle = (circle: Record<string, unknown>) => {
  return (circle.name as string) || (circle.title as string) || 'Untitled Circle'
}

const getCircleDescription = (circle: Record<string, unknown>) => {
  return (circle.description as string) || (circle.summary as string) || ''
}

const CirclesScreen = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<unknown>(null)

  const loadCircles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listCircles()
      setData(res)
    } catch {
      setError('Unable to load circles right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!FEATURE_CIRCLES) return
    loadCircles()
  }, [loadCircles])

  const circles = useMemo(() => extractCircles(data), [data])

  if (!FEATURE_CIRCLES) {
    return (
      <View className="flex-1 bg-primary justify-center items-center px-6">
        <Text className="text-white text-base">Circles are not available yet.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary">
      <View className="px-4 pt-6 pb-3">
        <Text className="text-white text-lg font-semibold">Circles</Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="small" color="#ffcc00" />
          <Text className="text-white mt-3">Loading circles...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-white text-center mb-4">{error}</Text>
          <TouchableOpacity
            onPress={loadCircles}
            className="bg-orange-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : circles.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-white text-center mb-4">No circles yet.</Text>
          <TouchableOpacity
            onPress={loadCircles}
            className="bg-orange-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-white">Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={circles}
          keyExtractor={(item, index) => {
            const record = item as Record<string, unknown>
            const id = record.id ?? record.circle_id ?? record.uuid ?? record.slug
            return id ? String(id) : `circle-${index}`
          }}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const record = (item ?? {}) as Record<string, unknown>
            const id = record.id ?? record.circle_id ?? record.uuid ?? record.slug
            const title = getCircleTitle(record)
            const description = getCircleDescription(record)
            const memberCount =
              (record.members_count as number) ||
              (record.member_count as number) ||
              (Array.isArray(record.members) ? record.members.length : 0)

            const content = (
              <TouchableOpacity
                className="bg-gray-900 mx-4 my-2 p-4 rounded-xl"
                disabled={!id}
              >
                <Text className="text-white text-base font-semibold">{title}</Text>
                {description ? (
                  <Text className="text-gray-300 text-sm mt-1">{description}</Text>
                ) : null}
                <Text className="text-gray-400 text-xs mt-2">{memberCount} members</Text>
              </TouchableOpacity>
            )

            if (!id) return content

            return (
              <Link href={`/circles/${id}` as any} asChild>
                {content}
              </Link>
            )
          }}
        />
      )}
    </View>
  )
}

export default CirclesScreen
