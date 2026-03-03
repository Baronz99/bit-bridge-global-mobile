import { Text, TouchableOpacity, View } from 'react-native'
import React from 'react'

type ProgressState = 'processing' | 'delayed'

type Props = {
  state: ProgressState
  message?: string
  elapsedSeconds?: number
  reference?: string
  onCheckNow?: () => void
  onBack?: () => void
}

const fmtElapsed = (seconds?: number) => {
  const n = Number(seconds || 0)
  if (!Number.isFinite(n) || n <= 0) return null
  const mins = Math.floor(n / 60)
  const secs = n % 60
  if (mins <= 0) return `${secs}s elapsed`
  return `${mins}m ${secs.toString().padStart(2, '0')}s elapsed`
}

const StepDot = ({ active, done }: { active?: boolean; done?: boolean }) => {
  const color = done ? 'bg-emerald-400' : active ? 'bg-amber-300' : 'bg-slate-600'
  return <View className={`h-2.5 w-2.5 rounded-full ${color}`} />
}

const PaymentProgressCard = ({ state, message, elapsedSeconds, reference, onCheckNow, onBack }: Props) => {
  const delayed = state === 'delayed'
  const elapsedLabel = fmtElapsed(elapsedSeconds)

  return (
    <View className={`rounded-xl border p-3 mb-3 mt-2 ${delayed ? 'border-amber-400/60 bg-amber-500/10' : 'border-yellow-500/30 bg-yellow-500/10'}`}>
      <Text className="text-white font-semibold text-sm">Payment in progress</Text>
      <Text className="text-yellow-100 text-xs mt-1">
        {message || 'Payment confirmed. Waiting for provider to issue token.'}
      </Text>

      <View className="mt-3 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <StepDot done />
            <Text className="text-slate-200 text-xs">Payment confirmed</Text>
          </View>
          <Text className="text-emerald-300 text-[11px]">Done</Text>
        </View>

        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center gap-2">
            <StepDot active />
            <Text className="text-slate-200 text-xs">Provider processing</Text>
          </View>
          <Text className="text-amber-300 text-[11px]">In progress</Text>
        </View>

        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center gap-2">
            <StepDot />
            <Text className="text-slate-400 text-xs">Token issued</Text>
          </View>
          <Text className="text-slate-500 text-[11px]">Pending</Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-slate-300 text-xs">Usually takes 30-120s</Text>
        {elapsedLabel ? <Text className="text-slate-400 text-xs">{elapsedLabel}</Text> : null}
      </View>

      {reference ? (
        <Text className="text-slate-400 text-[11px] mt-2" numberOfLines={1} ellipsizeMode="middle">
          Ref: {reference}
        </Text>
      ) : null}

      <View className="flex-row gap-2 mt-3">
        {onCheckNow ? (
          <TouchableOpacity onPress={onCheckNow} className="flex-1 rounded-md border border-alt py-2.5">
            <Text className="text-alt text-center text-xs font-medium">Check now</Text>
          </TouchableOpacity>
        ) : null}
        {onBack ? (
          <TouchableOpacity onPress={onBack} className="flex-1 rounded-md border border-slate-600 py-2.5">
            <Text className="text-slate-300 text-center text-xs font-medium">Back to bills</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

export default PaymentProgressCard