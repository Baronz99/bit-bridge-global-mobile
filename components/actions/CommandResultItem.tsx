import React from 'react'
import { Feather } from '@expo/vector-icons'
import { Text, TouchableOpacity, View } from 'react-native'

import { CommandAction } from '@/api/actions'

const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
  send: 'send',
  transfer: 'repeat',
  wallet: 'credit-card',
  bolt: 'zap',
  tv: 'tv',
  card: 'credit-card',
  globe: 'globe',
  activity: 'activity',
  receipt: 'file-text',
  shield: 'shield',
  users: 'users',
  compass: 'compass',
}

const resolveIcon = (action: CommandAction): keyof typeof Feather.glyphMap => {
  const raw = String(action.icon || '').trim().toLowerCase()
  if (raw && iconMap[raw]) return iconMap[raw]
  if (action.category === 'security') return 'shield'
  if (action.category === 'identity') return 'check-circle'
  if (action.category === 'transactions') return 'activity'
  if (action.category === 'wallets') return 'credit-card'
  return 'compass'
}

const safeText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'value' in value) {
    const nestedValue = (value as { value?: unknown }).value
    if (typeof nestedValue === 'string') return nestedValue
    if (typeof nestedValue === 'number') return String(nestedValue)
  }
  return fallback
}

export default function CommandResultItem({ action, onPress }: { action: CommandAction; onPress: () => void }) {
  const disabled = !action.enabled
  const nextBest = action.next_best_actions?.[0]
  const title = safeText(action.title, 'Action')
  const subtitle = safeText(action.subtitle)
  const badge = safeText(action.badge)
  const disabledReason = safeText(action.disabled_reason)
  const nextBestTitle = safeText(nextBest?.title)

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.86}
      onPress={onPress}
      className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4"
      style={{ opacity: disabled ? 0.92 : 1 }}
    >
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-11 w-11 items-center justify-center rounded-full bg-[#1A2740]">
          <Feather name={resolveIcon(action)} size={18} color="#D7E3FF" />
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-white">{title}</Text>
              <Text className="mt-1 text-xs leading-5 text-[#94A3B8]">{subtitle}</Text>
            </View>
            {badge ? (
              <View className="rounded-full border border-[#2A3B5A] bg-[#162238] px-2.5 py-1">
                <Text className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#9EC1FF]">{badge}</Text>
              </View>
            ) : null}
          </View>

          {disabled && disabledReason ? (
            <Text className="mt-2 text-xs text-[#FBBF24]">{disabledReason}</Text>
          ) : null}

          {!action.enabled && nextBestTitle ? (
            <Text className="mt-1 text-xs text-[#CBD5E1]">Next: {nextBestTitle}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  )
}
