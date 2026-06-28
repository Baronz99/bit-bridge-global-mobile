import { Image, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'
import { images } from '@/constants/images'
import { ServiceAvailabilityRow } from '@/api/serviceAvailability'
import ServiceStatusPill from '@/components/service-availability/ServiceStatusPill'

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

const PowerProviderCard = ({ item, status }: { item: any; status?: ServiceAvailabilityRow }) => {
  const displayName = getProviderDisplayName(item)
  const shortCode = getProviderShortCode(item)

  return (
    <Link href={`/powerProviders/${item.id}`} asChild>
      <TouchableOpacity
        key={item?.id}
        className="mb-3 w-full overflow-hidden rounded-2xl border border-gray-700/80 bg-gray-800/60 px-3 py-3"
        style={{ minHeight: 154 }}
      >
        <View className="h-20 w-full items-center justify-center rounded-xl bg-black/20 px-3">
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
            <ServiceStatusPill state={status?.state || 'unknown'} compact />
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  )
}

export default PowerProviderCard
