import React from 'react'
import { Feather } from '@expo/vector-icons'
import { Text, TouchableOpacity, View } from 'react-native'

export default function CommandBarEntry({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.9}
      onPress={onPress}
      className="mt-4 rounded-[24px] border border-white/10 bg-[#121B2D] px-4 py-4"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-white/6">
          <Feather name="search" size={18} color="#D7E3FF" />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-white">What would you like to do?</Text>
          <Text className="mt-1 text-xs text-[#94A3B8]">Send money, buy airtime, cards, statements, or support.</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}
