import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import StatusBadge from './StatusBadge'
import FinancialSummaryCard, { SummaryRow } from './FinancialSummaryCard'

type Props = {
  eyebrow?: string
  title: string
  supportingText?: string | null
  primaryLabel: string
  primaryValue: string
  statusLabel?: string | null
  statusTone?: 'success' | 'pending' | 'failed' | 'info'
  summaryTitle?: string
  summaryRows: SummaryRow[]
  primaryActionLabel?: string
  onPrimaryAction?: (() => void) | null
  secondaryActionLabel?: string
  onSecondaryAction?: (() => void) | null
  variant?: 'card' | 'document'
}

const CompletionPanel = ({
  eyebrow,
  title,
  supportingText,
  primaryLabel,
  primaryValue,
  statusLabel,
  statusTone = 'info',
  summaryTitle = 'Summary',
  summaryRows,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'card',
}: Props) => {
  const wrapperClass =
    variant === 'document'
      ? 'px-1 py-1'
      : 'rounded-[32px] bg-[#0F1115] px-5 py-5 border border-white/6'

  const amountClass =
    variant === 'document'
      ? 'rounded-[24px] bg-[#132235] border border-[#24364B] px-5 py-5 mt-5'
      : 'rounded-[28px] bg-[#171A21] px-5 py-5 mt-5'

  const eyebrowClass = variant === 'document' ? 'text-[#C9933A] text-[10px] uppercase tracking-[3px]' : 'text-[#D49A3A] text-[10px] uppercase tracking-[3px]'
  const supportingClass = variant === 'document' ? 'text-[#9AA7BA] text-[13px] leading-5 mt-2' : 'text-[#A9AFB8] text-[13px] leading-5 mt-2'
  const primaryLabelClass = variant === 'document' ? 'text-[#9FB0C6] text-[11px] uppercase tracking-[2px]' : 'text-[#9AA3AF] text-[11px] uppercase tracking-[2px]'

  return (
    <View className={wrapperClass}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          {eyebrow ? <Text className={eyebrowClass}>{eyebrow}</Text> : null}
          <Text className="text-white text-[24px] font-semibold mt-2 leading-8">{title}</Text>
          {supportingText ? <Text className={supportingClass}>{supportingText}</Text> : null}
        </View>
        {statusLabel ? <StatusBadge label={statusLabel} tone={statusTone} /> : null}
      </View>

      <View className={amountClass}>
        <Text className={primaryLabelClass}>{primaryLabel}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit className="text-white text-[34px] font-semibold mt-2 leading-10">
          {primaryValue}
        </Text>
      </View>

      <View className="mt-4">
        <FinancialSummaryCard title={summaryTitle} rows={summaryRows} variant={variant === 'document' ? 'document' : 'card'} />
      </View>

      {primaryActionLabel || secondaryActionLabel ? (
        <View className="mt-5 gap-3">
          {primaryActionLabel && onPrimaryAction ? (
            <TouchableOpacity onPress={onPrimaryAction} className="bg-theme-primary rounded-[18px] py-4 px-4">
              <Text className="text-alt text-center font-semibold">{primaryActionLabel}</Text>
            </TouchableOpacity>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <TouchableOpacity onPress={onSecondaryAction} className="bg-[#171A21] rounded-[18px] py-4 px-4">
              <Text className="text-white text-center font-semibold">{secondaryActionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export default CompletionPanel
