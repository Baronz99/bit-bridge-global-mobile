import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'
import { images } from '@/constants/images'
import ServiceStatusPill from '@/components/service-availability/ServiceStatusPill'
import useServiceAvailability from '@/hooks/useServiceAvailability'
import powerDistribution from '../../data/powerDistributions.json'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

const getProviderDisplayName = (item: any) => {
  const raw = String(item?.name || '').trim()
  if (!raw) return 'Power provider'
  const [primary] = raw.split(' - ')
  return primary.replace(/\s+Payment$/i, '').trim()
}

const getProviderShortCode = (item: any) => {
  const raw = String(item?.name || '').trim()
  const match = raw.match(/-\s*([A-Z]{3,6})\s*$/)
  if (match?.[1]) return match[1]
  return String(item?.image || '').trim().toUpperCase()
}

const Index = () => {
  const { getStatus } = useServiceAvailability()

  return (
    <View className="flex-1 px-4 bg-primary">
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Utilities</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Electricity Bills</Text>
        <Text className="text-gray-400 mt-2 text-sm">
          Select your disco to buy power in seconds.
        </Text>
      </View>

      <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
        <Text className="text-white text-sm font-semibold">Choose Disco</Text>
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
            marginBottom: 10,
          }}
          renderItem={({ item }: any) => {
            const displayName = getProviderDisplayName(item)
            const shortCode = getProviderShortCode(item)
            const status = getStatus({
              provider: item?.biller,
              serviceType: 'ELECTRICITY',
              label: displayName,
            })

            return (
              <Link
                href={{
                  pathname: '/electricity-provider/[id]',
                  params: { id: String(item.id) },
                }}
                asChild
              >
                <TouchableOpacity
                  key={item?.id}
                  className="mb-3 w-[31%] overflow-hidden rounded-2xl border border-gray-700/80 bg-gray-800/60 px-3 py-3"
                  style={{ minHeight: 154 }}
                >
                  <View className="h-20 w-full items-center justify-center rounded-xl bg-white px-2">
                    <Image source={getImageByKey(String(item.image))} resizeMode="contain" className="h-14 w-full" />
                  </View>

                  <View className="mt-3">
                    <Text className="text-sm font-semibold text-white" numberOfLines={2}>
                      {displayName}
                    </Text>
                    <Text className="mt-1 text-xs uppercase tracking-[0.8px] text-blue-200">
                      {shortCode}
                    </Text>
                    <View className="mt-2 items-start">
                      <ServiceStatusPill state={status.state} compact />
                    </View>
                  </View>
                </TouchableOpacity>
              </Link>
            )
          }}
          keyExtractor={(item) => item?.id?.toString()}
          className="mt-4"
        />
      </View>
    </View>
  )
}

export default Index
