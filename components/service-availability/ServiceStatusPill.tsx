import React from 'react'
import { Text, View } from 'react-native'
import { ServiceAvailabilityState } from '@/api/serviceAvailability'

const toneByState: Record<ServiceAvailabilityState, { wrap: string; text: string; label: string }> = {
  operational: {
    wrap: 'bg-emerald-500/15 border-emerald-400/30',
    text: 'text-emerald-300',
    label: 'Operational',
  },
  degraded: {
    wrap: 'bg-amber-500/15 border-amber-400/30',
    text: 'text-amber-300',
    label: 'Degraded',
  },
  outage: {
    wrap: 'bg-red-500/15 border-red-400/30',
    text: 'text-red-300',
    label: 'Outage',
  },
  unknown: {
    wrap: 'bg-slate-500/15 border-slate-300/25',
    text: 'text-slate-200',
    label: 'Unknown',
  },
}

const ServiceStatusPill = ({ state = 'unknown', compact = false }: { state?: ServiceAvailabilityState; compact?: boolean }) => {
  const tone = toneByState[state] || toneByState.unknown

  return (
    <View className={`rounded-full border px-2 py-1 ${tone.wrap}`}>
      <Text className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold ${tone.text}`}>{tone.label}</Text>
    </View>
  )
}

export default ServiceStatusPill
