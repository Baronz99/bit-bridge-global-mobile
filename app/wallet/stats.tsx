import React, { useMemo } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import useFetch from '@/services/useFetch'
import { getStatistics } from '@/api/statistics'
import { FEATURE_STATS } from '@/constants/featureFlags'

const WalletStats = () => {
  const { data, loading, error, refetch } = useFetch(() => getStatistics())

  const stats = useMemo(() => {
    return data?.data ?? data
  }, [data])

  if (!FEATURE_STATS) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Wallet Stats</Text>
        <Text className="text-gray-400">Statistics are currently disabled.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-white text-2xl font-semibold mt-6">Wallet Stats</Text>
        <Text className="text-gray-400 mt-1">Overview of your activity.</Text>

        {loading ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? (
          <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
            <Text className="text-white font-semibold">Error</Text>
            <Text className="text-white/80">{error?.message || 'Failed to load stats'}</Text>
            <TouchableOpacity onPress={refetch} className="mt-3 bg-red-600 py-2 rounded-lg">
              <Text className="text-white text-center">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="bg-gray-900 rounded-xl p-4 mt-6">
          <Text className="text-white font-semibold">Raw Stats</Text>
          <Text className="text-gray-400 text-xs mt-2">
            {stats ? JSON.stringify(stats) : 'No stats available.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

export default WalletStats
