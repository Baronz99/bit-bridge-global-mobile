import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { DirectionCopy, fxPanelClass } from '@/utils/fxConfig'

type Props = {
  copy: DirectionCopy
}

export default function FXActivationState({ copy }: Props) {
  const router = useRouter()

  return (
    <View className={`${fxPanelClass} mt-5 px-5 py-5`}>
      <Text className="text-[11px] uppercase tracking-[1.8px] text-[#D8B07A]">{copy.activationLead}</Text>
      <Text className="mt-2 text-[24px] font-semibold text-[#FFF8F0]">{copy.activationTitle}</Text>
      <Text className="mt-2 text-[14px] leading-6 text-[#E9D7BF]">{copy.activationBody}</Text>
      <Text className="mt-3 text-[12px] text-[#C8AA7D]">Secure conversion stays available here once Tunnel is live.</Text>
      <View className="mt-5 flex-row gap-3">
        <TouchableOpacity onPress={() => router.push('/tunnel-activation')} className="flex-1 rounded-[18px] bg-[#FF8A1F] py-4">
          <Text className="text-center text-[15px] font-semibold text-[#FFF7ED]">Activate Tunnel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/tunnel')} className="flex-1 rounded-[18px] bg-[#24170C] py-4">
          <Text className="text-center text-[15px] font-semibold text-[#FFF7ED]">Open Tunnel hub</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
