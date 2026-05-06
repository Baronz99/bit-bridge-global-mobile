import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import { DirectionCopy, fxPanelClass } from '@/utils/fxConfig'

type Props = {
  copy: DirectionCopy
  amountInput: string
  onChangeAmount: (value: string) => void
  sourceBalanceLabel: string
  sourceBalanceValue: number
  onSelectAmount: (value: string) => void
}

const quickActions = [0.25, 0.5, 1] as const

export default function FXAmountInput({
  copy,
  amountInput,
  onChangeAmount,
  sourceBalanceLabel,
  sourceBalanceValue,
  onSelectAmount,
}: Props) {
  return (
    <View className={`${fxPanelClass} mt-5 px-5 py-5`}>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[11px] uppercase tracking-[1.8px] text-[#D8B07A]">Amount</Text>
          <Text className="mt-1 text-[13px] text-[#E6D5BF]">{copy.inputLabel}</Text>
        </View>
        <Text className="text-[12px] text-[#C8AA7D]" numberOfLines={1}>
          {sourceBalanceLabel}
        </Text>
      </View>

      <View className="mt-4 rounded-[24px] bg-[#21150B] px-4 pb-3 pt-4">
        <Text className="text-[10px] uppercase tracking-[1.6px] text-[#B98D55]">{copy.sourceCurrencyLabel}</Text>
        <View className="mt-2">
          <FormInput
            label={undefined}
            value={amountInput}
            name={copy.inputName}
            keyboardType="numeric"
            onChangeText={onChangeAmount}
            placeHolder={copy.placeholder}
            placeholderTextColor="#C69255"
            selectionColor="#FFB347"
            style={{
              color: '#FFF8ED',
              backgroundColor: '#21150B',
              borderColor: 'transparent',
              fontSize: 34,
              fontWeight: '700',
            }}
          />
        </View>
      </View>

      <View className="mt-4 flex-row gap-2">
        {quickActions.map((fraction) => {
          const label = fraction === 1 ? 'Max' : `${Math.round(fraction * 100)}%`
          const value = fraction === 1 ? sourceBalanceValue : sourceBalanceValue * fraction
          return (
            <TouchableOpacity
              key={label}
              onPress={() => onSelectAmount(value > 0 ? value.toFixed(2) : '')}
              disabled={sourceBalanceValue <= 0}
              activeOpacity={0.85}
              className="rounded-full bg-[#24170C] px-4 py-2"
            >
              <Text className="text-[12px] font-semibold text-[#FFF3E2]">{label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}
