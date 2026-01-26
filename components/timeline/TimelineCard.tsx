import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import moneyFormat from '@/utils/moneyFormat'

type TimelineCardProps = {
  item: Record<string, unknown>
  onPress?: () => void
}

const getTimelineKind = (record: Record<string, unknown>) => {
  const raw = (record.kind as string) || (record.type as string) || ''
  return raw.toLowerCase()
}

const getActorName = (record: Record<string, unknown>) => {
  const actor = record.actor as Record<string, unknown> | undefined
  return (actor?.name as string) || (record.actor_name as string) || 'You'
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  const initials = parts.slice(0, 2).map((part) => part[0]).join('')
  return initials.toUpperCase() || 'BB'
}

const getTimelineText = (record: Record<string, unknown>) => {
  return (
    (record.label as string) ||
    (record.title as string) ||
    (record.text as string) ||
    (record.message as string) ||
    'Timeline update'
  )
}

const getSubtitle = (kind: string, record: Record<string, unknown>) => {
  const meta = (record.meta as Record<string, unknown>) || {}
  if (kind.includes('circle')) {
    return `${meta.circle_name || 'Circle'}  •  Circle`
  }
  if (kind.includes('bill')) {
    const service = (meta.biller as string) || (meta.service_type as string) || 'Bills'
    return `${service}  •  Bills`
  }
  if (kind.includes('card')) return 'Virtual card  •  Cards'
  if (kind.includes('wallet') || kind.includes('transaction')) {
    const bank = (meta.bank as string) || 'Transfer'
    return `${bank}  •  Wallet`
  }
  return 'Update  •  Activity'
}

const getAmountText = (record: Record<string, unknown>, kind: string) => {
  const meta = (record.meta as Record<string, unknown>) || {}
  const amountRaw =
    (record.amount_cents as number | string | undefined) ??
    (record.amountCents as number | string | undefined)
  const amountCents = amountRaw !== undefined ? Number(amountRaw) : null
  if (amountCents === null || Number.isNaN(amountCents)) return null
  const walletType = String(meta.wallet_type || '')
  const currency =
    (meta.currency as string) ||
    (record.currency as string) ||
    (walletType.toLowerCase() === 'usd' || kind.includes('card') ? 'USD' : 'NGN')
  return moneyFormat(amountCents / 100, currency)
}

const getAmountSign = (record: Record<string, unknown>, kind: string) => {
  const meta = (record.meta as Record<string, unknown>) || {}
  const txType = String(meta.transaction_type || '').toLowerCase()
  if (txType === 'deposit') return '+'
  if (txType === 'withdrawal') return '-'
  if (kind.includes('bill') || kind.includes('card')) return '-'
  return ''
}

const getStatusText = (record: Record<string, unknown>) => {
  const status = String(record.status || '')
  if (!status) return ''
  if (status.includes('approved') || status.includes('successful') || status.includes('completed')) {
    return 'Successful'
  }
  if (status.includes('pending') || status.includes('initialized')) return 'Pending'
  if (status.includes('failed') || status.includes('declined')) return 'Failed'
  if (status.includes('reversed')) return 'Reversed'
  if (status.includes('resolved')) return 'Resolved'
  return status
}

const getStatusTone = (status: string) => {
  const normalized = status.toLowerCase()
  if (normalized.includes('successful') || normalized.includes('approved') || normalized.includes('resolved')) {
    return 'bg-emerald-500/15 text-emerald-300'
  }
  if (normalized.includes('pending')) return 'bg-amber-500/15 text-amber-300'
  if (normalized.includes('failed')) return 'bg-red-500/15 text-red-300'
  return 'bg-gray-700/60 text-gray-300'
}

const getTime = (value: string) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const maskReference = (value?: string) => {
  if (!value) return '----'
  const raw = String(value).replace(/\s+/g, '')
  if (raw.length <= 4) return raw
  return `****${raw.slice(-4)}`
}

const getVisibility = (record: Record<string, unknown>) => {
  const meta = (record.meta as Record<string, unknown>) || {}
  return (meta.visibility as string) || (meta.scope as string) || 'Private'
}

const getIcon = (kind: string) => {
  if (kind.includes('wallet')) return 'credit-card'
  if (kind.includes('bill')) return 'file-text'
  if (kind.includes('card')) return 'zap'
  if (kind.includes('circle')) return 'users'
  if (kind.includes('social')) return 'bell'
  return 'activity'
}

const TimelineCard = ({ item, onPress }: TimelineCardProps) => {
  const kind = getTimelineKind(item)
  const actorName = getActorName(item)
  const initials = getInitials(actorName)
  const title = getTimelineText(item)
  const subtitle = getSubtitle(kind, item)
  const amount = getAmountText(item, kind)
  const amountSign = getAmountSign(item, kind)
  const status = getStatusText(item)
  const statusTone = getStatusTone(status)
  const timestamp = getTime((item.occurred_at as string) || (item.created_at as string) || '')
  const meta = (item.meta as Record<string, unknown>) || {}
  const reference = maskReference(meta.reference as string)
  const visibility = getVisibility(item)
  const icon = getIcon(kind)
  const amountTone =
    status.toLowerCase().includes('pending') ? 'text-gray-400' : 'text-white'

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      className="bg-gray-900/80 my-2 p-4 rounded-2xl border border-white/5"
      style={{ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 2 }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center flex-1">
          <View className="w-12 h-12 rounded-full bg-gray-800 items-center justify-center border border-white/5 mr-3">
            <Feather name={icon as any} size={16} color="#f59e0b" />
            <View className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-gray-900 items-center justify-center border border-white/10">
              <Text className="text-[9px] text-white font-semibold">{initials}</Text>
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-white text-sm font-semibold">{title}</Text>
            <Text className="text-gray-400 text-xs mt-1">{subtitle}</Text>
          </View>
        </View>
        <View className="items-end ml-3">
          <Text className={`text-sm font-semibold ${amountTone}`}>
            {amount ? `${amountSign}${amount}` : ''}
          </Text>
          {status ? (
            <View className={`px-2 py-1 rounded-full mt-2 ${statusTone}`}>
              <Text className="text-[10px] uppercase">{status}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-gray-500 text-[11px]">{timestamp}</Text>
        <Text className="text-gray-500 text-[11px]">{`Ref: ${reference}`}</Text>
        <View className="px-2 py-1 rounded-full bg-gray-800/80">
          <Text className="text-gray-300 text-[10px]">{visibility}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default TimelineCard
