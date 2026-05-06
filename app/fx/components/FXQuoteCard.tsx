import React, { useEffect, useRef } from 'react'
import { Animated, Text, View } from 'react-native'
import moneyFormat from '@/utils/moneyFormat'
import { DirectionCopy, fxPanelClass, fxSoftPanelClass } from '@/utils/fxConfig'

type QuoteState = 'activation_required' | 'idle' | 'loading' | 'ready'

type Props = {
  copy: DirectionCopy
  quoteState: QuoteState
  receiveAmountLabel: string | null
  payAmountLabel: string
  feeAmount?: number | string | null
  amountAfterFee?: number | string | null
  executionRate?: number | string | null
  freshnessLabel?: string | null
}

export default function FXQuoteCard({
  copy,
  quoteState,
  receiveAmountLabel,
  payAmountLabel,
  feeAmount,
  amountAfterFee,
  executionRate,
  freshnessLabel,
}: Props) {
  const fade = useRef(new Animated.Value(0.8)).current
  const rise = useRef(new Animated.Value(8)).current
  const amountScale = useRef(new Animated.Value(0.985)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(amountScale, { toValue: 1.01, duration: 120, useNativeDriver: true }),
        Animated.timing(amountScale, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]),
    ]).start()
  }, [fade, rise, amountScale, quoteState, receiveAmountLabel, payAmountLabel])

  const headline =
    quoteState === 'loading'
      ? 'Refreshing live quote'
      : quoteState === 'ready'
        ? receiveAmountLabel
        : `Enter ${copy.sourceCurrencyLabel} amount`

  const helper =
    quoteState === 'loading'
      ? copy.loadingHelp
      : quoteState === 'ready'
        ? 'Final amount confirmed before execution.'
        : copy.emptyHelp

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }} className={`${fxPanelClass} px-5 py-5`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] uppercase tracking-[1.8px] text-[#D8B07A]">Quote preview</Text>
        {freshnessLabel ? <Text className="text-[11px] text-[#C8AA7D]">{freshnessLabel}</Text> : null}
      </View>
      <Text className="mt-3 text-[11px] uppercase tracking-[1.4px] text-[#B98D55]">{copy.destinationLead}</Text>
      <Animated.Text
        style={{ transform: [{ scale: amountScale }] }}
        className="mt-2 text-[42px] font-semibold leading-[46px] text-[#FFF8F0]"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {headline}
      </Animated.Text>
      <Text className="mt-2 text-[13px] leading-5 text-[#E9D7BF]">{helper}</Text>
      <Text className="mt-1 text-[12px] text-[#C8AA7D]">{copy.receiveHelp}</Text>

      <View className={`${fxSoftPanelClass} mt-5 px-4 py-4`}>
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] uppercase tracking-[1.4px] text-[#B98D55]">{copy.sourceLead}</Text>
          <Text className="text-[20px] font-semibold text-[#FFF6EA]" numberOfLines={1} adjustsFontSizeToFit>
            {payAmountLabel}
          </Text>
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-[13px] text-[#D8C1A3]">Fee</Text>
          <Text className="text-[14px] font-medium text-[#FFF3E4]" numberOfLines={1}>
            {moneyFormat(Number(feeAmount) || 0, copy.sourceCurrency)}
          </Text>
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-[13px] text-[#D8C1A3]">After fee</Text>
          <Text className="text-[14px] font-medium text-[#FFF3E4]" numberOfLines={1}>
            {moneyFormat(Number(amountAfterFee) || 0, copy.sourceCurrency)}
          </Text>
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-[13px] text-[#D8C1A3]">Live rate</Text>
          <Text className="text-[14px] font-medium text-[#FFF3E4]" numberOfLines={1}>
            {copy.rateLabel} = {Number(executionRate || 0).toFixed(2)} NGN
          </Text>
        </View>
      </View>
    </Animated.View>
  )
}
