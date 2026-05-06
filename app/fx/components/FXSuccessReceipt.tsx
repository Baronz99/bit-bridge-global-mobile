import React, { useEffect, useRef } from 'react'
import { Animated, Text, TouchableOpacity, View } from 'react-native'
import moneyFormat from '@/utils/moneyFormat'
import { DirectionCopy, fxCardClass, fxSoftPanelClass } from '@/utils/fxConfig'

type Props = {
  copy: DirectionCopy
  message: string
  receivedAmountLabel: string
  payAmountLabel: string
  feeAmount?: number | string | null
  executionRate?: number | string | null
  receiptReference?: string | null
  successBalanceLabel: string
  successBalanceValue: number
  onDone: () => void
  onViewReceipt?: () => void
}

export default function FXSuccessReceipt({
  copy,
  message,
  receivedAmountLabel,
  payAmountLabel,
  feeAmount,
  executionRate,
  receiptReference,
  successBalanceLabel,
  successBalanceValue,
  onDone,
  onViewReceipt,
}: Props) {
  const fade = useRef(new Animated.Value(0)).current
  const rise = useRef(new Animated.Value(14)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start()
  }, [fade, rise])

  return (
    <Animated.View
      style={{ opacity: fade, transform: [{ translateY: rise }] }}
      className={`${fxCardClass} mt-5 overflow-hidden px-5 py-5`}
    >
      <View className="absolute right-[-28] top-[-18] h-28 w-28 rounded-full bg-[#2B8A68]/10" />
      <Text className="text-[11px] uppercase tracking-[1.8px] text-[#7CE2BA]">Conversion complete</Text>
      <Text className="mt-3 text-[11px] uppercase tracking-[1.4px] text-[#9BDCC0]">You received</Text>
      <Text className="mt-2 text-[40px] font-semibold leading-[44px] text-[#FFF8F0]" numberOfLines={1} adjustsFontSizeToFit>
        {receivedAmountLabel}
      </Text>
      <Text className="mt-2 text-[13px] leading-5 text-[#D6EBDD]">{message}</Text>

      <View className={`${fxSoftPanelClass} mt-5 px-4 py-4`}>
        <View className="flex-row items-center justify-between">
          <Text className="text-[13px] text-[#D8C1A3]">You paid</Text>
          <Text className="text-[15px] font-medium text-[#FFF3E4]" numberOfLines={1}>{payAmountLabel}</Text>
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-[13px] text-[#D8C1A3]">Fee</Text>
          <Text className="text-[15px] font-medium text-[#FFF3E4]" numberOfLines={1}>
            {moneyFormat(Number(feeAmount) || 0, copy.sourceCurrency)}
          </Text>
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-[13px] text-[#D8C1A3]">Rate</Text>
          <Text className="text-[15px] font-medium text-[#FFF3E4]" numberOfLines={1}>
            {copy.rateLabel} = {Number(executionRate || 0).toFixed(2)} NGN
          </Text>
        </View>
        <View className="mt-4 flex-row items-center justify-between border-t border-[#3A2610] pt-4">
          <Text className="text-[13px] text-[#D8C1A3]">{successBalanceLabel}</Text>
          <Text className="text-[16px] font-semibold text-[#FFF6EA]" numberOfLines={1} adjustsFontSizeToFit>
            {moneyFormat(Number(successBalanceValue) || 0, copy.successCurrency)}
          </Text>
        </View>
        {receiptReference ? (
          <Text className="mt-3 text-[12px] text-[#9BDCC0]">Ref: {receiptReference}</Text>
        ) : null}
      </View>

      <View className="mt-5 flex-row gap-3">
        <TouchableOpacity onPress={onDone} className="flex-1 rounded-[18px] bg-[#24170C] py-4">
          <Text className="text-center text-[14px] font-semibold text-[#FFF7ED]">Done</Text>
        </TouchableOpacity>
        {onViewReceipt ? (
          <TouchableOpacity onPress={onViewReceipt} className="flex-1 rounded-[18px] bg-[#FF8A1F] py-4">
            <Text className="text-center text-[14px] font-semibold text-[#FFF7ED]">View receipt</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  )
}
