import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import AppModal from '@/components/modal/Modal'
import moneyFormat from '@/utils/moneyFormat'
import { DirectionCopy, fxSoftPanelClass } from '@/utils/fxConfig'

type Props = {
  open: boolean
  onClose: () => void
  onContinue: () => void
  copy: DirectionCopy
  payAmountLabel: string
  receiveAmountLabel: string | null
  feeAmount?: number | string | null
  executionRate?: number | string | null
}

export default function FXConfirmSheet({
  open,
  onClose,
  onContinue,
  copy,
  payAmountLabel,
  receiveAmountLabel,
  feeAmount,
  executionRate,
}: Props) {
  return (
    <AppModal open={open} onclose={onClose}>
      <View className="mx-auto w-full max-w-[380px] rounded-[28px] bg-[#130B05] px-5 py-5">
        <Text className="text-[11px] uppercase tracking-[1.8px] text-[#D8B07A]">Confirm conversion</Text>
        <Text className="mt-2 text-[24px] font-semibold text-[#FFF8F0]">Final review before secure confirmation</Text>
        <Text className="mt-2 text-[13px] leading-6 text-[#E9D7BF]">
          Live rate locked in for execution. You will still confirm with PIN or biometrics next.
        </Text>

        <View className={`${fxSoftPanelClass} mt-5 px-4 py-4`}>
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] uppercase tracking-[1.4px] text-[#B98D55]">You receive</Text>
            <Text className="text-[24px] font-semibold text-[#FFF8F0]" numberOfLines={1} adjustsFontSizeToFit>
              {receiveAmountLabel || moneyFormat(0, copy.destinationCurrency)}
            </Text>
          </View>
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-[13px] text-[#D8C1A3]">You pay</Text>
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
        </View>

        <View className="mt-5 flex-row gap-3">
          <TouchableOpacity onPress={onClose} className="flex-1 rounded-[18px] bg-[#23160B] py-4">
            <Text className="text-center text-[14px] font-semibold text-[#FFF7ED]">Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onContinue} className="flex-1 rounded-[18px] bg-[#FF8A1F] py-4">
            <Text className="text-center text-[14px] font-semibold text-[#FFF7ED]">Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppModal>
  )
}
