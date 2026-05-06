import React from 'react'
import { Animated, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DirectionCopy, fxSoftPanelClass } from '@/utils/fxConfig'

type Props = {
  copy: DirectionCopy
  sourceBalanceLabel: string
  destinationBalanceLabel: string
  onSwap: () => void
  arrowTranslate: Animated.AnimatedInterpolation<number>
  arrowOpacity: Animated.AnimatedInterpolation<number>
}

export default function FXRailHeader({
  copy,
  sourceBalanceLabel,
  destinationBalanceLabel,
  onSwap,
  arrowTranslate,
  arrowOpacity,
}: Props) {
  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[11px] uppercase tracking-[2px] text-[#D8B07A]">Rail direction</Text>
          <Text className="mt-1 text-[14px] font-medium text-[#F2E6D5]">{copy.summary}</Text>
        </View>
        <TouchableOpacity
          onPress={onSwap}
          activeOpacity={0.85}
          className="rounded-full bg-[#23160B] px-4 py-2"
        >
          <Text className="text-[12px] font-semibold text-[#FFD39A]">Swap rails</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className={`${fxSoftPanelClass} flex-1 px-4 py-4`}>
          <Text className="text-[10px] uppercase tracking-[1.8px] text-[#B98D55]">From</Text>
          <Text className="mt-2 text-[19px] font-semibold text-[#FFF6E9]">{copy.sourceRail}</Text>
          <Text className="mt-1 text-[12px] text-[#D8C1A3]">{copy.sourceCurrencyLabel}</Text>
          <Text className="mt-4 text-[22px] font-semibold text-[#FFF6E9]" numberOfLines={1} adjustsFontSizeToFit>
            {sourceBalanceLabel}
          </Text>
          <Text className="mt-1 text-[12px] text-[#C8AA7D]">{copy.sourceBalanceLabel}</Text>
        </View>

        <Animated.View
          style={{ transform: [{ translateX: arrowTranslate }], opacity: arrowOpacity }}
          className="h-12 w-12 items-center justify-center rounded-full bg-[#24170C]"
        >
          <Ionicons name="arrow-forward" size={18} color="#FFBE69" />
        </Animated.View>

        <View className={`${fxSoftPanelClass} flex-1 px-4 py-4`}>
          <Text className="text-[10px] uppercase tracking-[1.8px] text-[#B98D55]">To</Text>
          <Text className="mt-2 text-[19px] font-semibold text-[#FFF6E9]">{copy.destinationRail}</Text>
          <Text className="mt-1 text-[12px] text-[#D8C1A3]">{copy.destinationCurrencyLabel}</Text>
          <Text className="mt-4 text-[22px] font-semibold text-[#FFF6E9]" numberOfLines={1} adjustsFontSizeToFit>
            {destinationBalanceLabel}
          </Text>
          <Text className="mt-1 text-[12px] text-[#C8AA7D]">{copy.destinationBalanceLabel}</Text>
        </View>
      </View>
    </View>
  )
}
