import React from 'react'
import { Feather } from '@expo/vector-icons'
import { Text, View } from 'react-native'

export default function CommandEmptyState() {
  return (
    <View className="mt-10 items-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-8">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-white/6">
        <Feather name="search" size={18} color="#D7E3FF" />
      </View>
      <Text className="mt-4 text-center text-base font-semibold text-white">We couldn’t find that.</Text>
      <Text className="mt-2 text-center text-sm leading-6 text-[#94A3B8]">
        Try Send money, Buy airtime, Cards, or Support.
      </Text>
    </View>
  )
}
