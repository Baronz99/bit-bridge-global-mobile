import { FlatList, Text, View } from 'react-native'
import React from 'react'

import powerDistribution from '../../data/powerDistributions.json'
import PowerProviderCard from '@/components/ProviderCard'
import useServiceAvailability from '@/hooks/useServiceAvailability'

const Index = () => {
  const { getStatus } = useServiceAvailability()

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Utilities</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Power Providers</Text>
        <Text className="text-gray-400 mt-2 text-sm">Choose your disco to buy power.</Text>
      </View>

      <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
        <Text className="text-white text-sm font-semibold">Discos</Text>
        <Text className="mt-1 text-xs text-gray-400">Select the electricity provider for your meter.</Text>
        <FlatList
          numColumns={3}
          data={powerDistribution}
          contentContainerStyle={{
            paddingBottom: 10,
            marginTop: 12,
          }}
          showsHorizontalScrollIndicator={false}
          columnWrapperStyle={{
            justifyContent: 'flex-start',
            gap: 10,
            paddingRight: 5,
            marginBottom: 10,
          }}
          renderItem={({ item }: any) => (
            <PowerProviderCard
              item={item}
              status={getStatus({
                provider: item?.biller,
                serviceType: 'ELECTRICITY',
                label: String(item?.name || 'Power provider'),
              })}
            />
          )}
          keyExtractor={(item) => item?.id?.toString()}
          className="mt-4"
        />
      </View>
    </View>
  )
}

export default Index
