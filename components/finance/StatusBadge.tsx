import React from 'react'
import { Text, View } from 'react-native'

type StatusTone = 'success' | 'pending' | 'failed' | 'info'

type Props = {
  label: string
  tone?: StatusTone
}

const tones: Record<StatusTone, { container: string; text: string }> = {
  success: {
    container: 'bg-emerald-500/12 border border-emerald-500/25',
    text: 'text-emerald-200',
  },
  pending: {
    container: 'bg-amber-500/12 border border-amber-500/25',
    text: 'text-amber-200',
  },
  failed: {
    container: 'bg-red-500/12 border border-red-500/25',
    text: 'text-red-200',
  },
  info: {
    container: 'bg-sky-500/12 border border-sky-500/25',
    text: 'text-sky-200',
  },
}

const StatusBadge = ({ label, tone = 'info' }: Props) => {
  const palette = tones[tone]
  return (
    <View className={`rounded-full px-3 py-1.5 ${palette.container}`}>
      <Text className={`text-[10px] font-semibold uppercase tracking-[2px] ${palette.text}`}>{label}</Text>
    </View>
  )
}

export default StatusBadge
