import React from 'react'
import { Image, TouchableOpacity } from 'react-native'
import { splitString } from '@/utils'
import { images } from '@/constants/images'

/**
 * Pure UI Provider Card (NO navigation inside).
 * Parent screen must wrap with <Link href=... asChild>.
 */
const ProviderCard = ({ item }: { item: any }) => {
  // images is typed; dynamic index needs Record cast + fallback
  const dict = images as Record<string, any>
  const key = String(splitString(item?.name ?? ''))
  const img = dict[key] ?? images.fail ?? images.bg

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      className="bg-gray-900 w-40 h-40 overflow-hidden rounded-lg flex-row items-center gap-3 mb-3"
    >
      <Image source={img} resizeMode="contain" className="w-full h-full object-contain" />
    </TouchableOpacity>
  )
}

export default ProviderCard
