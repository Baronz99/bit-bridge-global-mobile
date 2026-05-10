import React from 'react'
import { Text, View } from 'react-native'

export type SummaryRow = {
  label: string
  value?: string | null
  emphasis?: boolean
  mono?: boolean
  wrap?: boolean
}

type Props = {
  title?: string
  rows: SummaryRow[]
  footer?: string | null
  variant?: 'card' | 'document'
}

const FinancialSummaryCard = ({ title, rows, footer, variant = 'card' }: Props) => {
  const visibleRows = rows.filter((row): row is SummaryRow => Boolean(row) && String(row.value ?? '').trim().length > 0)
  if (!visibleRows.length && !footer && !title) return null

  const containerClass =
    variant === 'document'
      ? 'px-1 py-1'
      : 'rounded-[26px] bg-[#151515] px-5 py-5'

  const rowBorderClass = variant === 'document' ? 'border-b border-[#233041]' : 'border-b border-white/6'
  const titleClass = variant === 'document' ? 'text-[#DDE5F0] text-[13px] font-semibold mb-3 uppercase tracking-[1px]' : 'text-white text-sm font-semibold mb-3'
  const labelClass = variant === 'document' ? 'text-[#93A1B5] text-[12px] leading-5 pr-4' : 'text-[#A9AFB8] text-[12px] leading-5 pr-4'
  const valueBaseClass = variant === 'document' ? 'text-[#F5F7FA]' : 'text-[#E8ECF2]'
  const footerClass = variant === 'document' ? 'text-[#7F8CA3] text-[11px] leading-4 mt-3' : 'text-[#8D94A0] text-[11px] leading-4 mt-3'

  return (
    <View className={containerClass}>
      {title ? <Text className={titleClass}>{title}</Text> : null}
      {visibleRows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          className={`flex-row items-start justify-between py-2.5 ${index < visibleRows.length - 1 ? rowBorderClass : ''}`}
        >
          <Text className={labelClass}>{row.label}</Text>
          <Text
            numberOfLines={row.wrap ? undefined : 2}
            selectable={row.mono && row.wrap}
            className={`${row.mono ? 'font-mono' : ''} ${row.emphasis ? 'text-white font-semibold' : valueBaseClass} text-[13px] leading-5 ${row.wrap ? 'max-w-[68%]' : 'max-w-[62%]'} text-right`}
          >
            {row.value}
          </Text>
        </View>
      ))}
      {footer ? <Text className={footerClass}>{footer}</Text> : null}
    </View>
  )
}

export default FinancialSummaryCard
