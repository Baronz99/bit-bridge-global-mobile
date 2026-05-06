import React, { ReactNode } from 'react'
import { Image, Text, TouchableOpacity, View } from 'react-native'
import { icons } from '@/constants/icons'

type Props = {
  title: string
  subtitle?: string | null
  children: ReactNode
  primaryActionLabel?: string
  onPrimaryAction?: (() => void) | null
  secondaryActionLabel?: string
  onSecondaryAction?: (() => void) | null
}

const ReceiptDocument = ({
  title,
  subtitle = 'Official transaction confirmation for your records.',
  children,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: Props) => {
  return (
    <View className="rounded-[32px] bg-[#0D1624] border border-[#22324A] px-5 py-5">
      <View className="flex-row items-center gap-3">
        <Image source={icons.appLogoClear} className="w-10 h-10" resizeMode="contain" />
        <View className="flex-1">
          <Text className="text-[#C9933A] text-[10px] uppercase tracking-[3px]">BitBridge</Text>
          <Text className="text-white text-[20px] font-semibold mt-1">{title}</Text>
        </View>
      </View>

      <Text className="text-[#9AA7BA] text-[13px] mt-3 leading-5">{subtitle}</Text>

      <View className="h-px bg-[#22324A] mt-5 mb-4" />

      {children}

      {(primaryActionLabel && onPrimaryAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <>
          <View className="h-px bg-[#22324A] mt-4 mb-5" />
          <View className="gap-3">
            {primaryActionLabel && onPrimaryAction ? (
              <TouchableOpacity onPress={onPrimaryAction} className="bg-theme-primary py-4 rounded-[18px] items-center">
                <Text className="text-alt text-sm font-semibold">{primaryActionLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <TouchableOpacity onPress={onSecondaryAction} className="bg-[#132235] border border-[#24364B] py-4 rounded-[18px] items-center">
                <Text className="text-white text-sm font-semibold">{secondaryActionLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  )
}

export default ReceiptDocument
