// components/timeline/TimelineCard.tsx
import React, { useMemo } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import moneyFormat from '@/utils/moneyFormat'

type TimelineCardProps = {
  item: Record<string, any>
  onPress?: () => void
}

const norm = (v: any) => String(v ?? '').toLowerCase().trim()

const getKind = (record: any) => norm(record.kind || record.type)

const getTitle = (record: any) =>
  String(record.label || record.title || record.text || record.message || 'Timeline update')

const getSubtitle = (kind: string, record: any) => {
  const meta = (record.meta as any) || {}
  if (kind.includes('circle')) return `${meta.circle_name || 'Circle'}  •  Circles`
  if (kind.includes('bill')) {
    const service = meta.biller || meta.service_type || 'Bills'
    return `${service}  •  Bills`
  }
  if (kind.includes('card')) return 'Virtual card  •  Cards'
  if (kind.includes('wallet') || kind.includes('transaction')) {
    const bank = meta.bank || 'Wallet'
    return `${bank}  •  Wallet`
  }
  return 'Update  •  Activity'
}

const getStatusLabel = (record: any) => {
  const s = norm(record.status)
  if (!s) return ''
  if (s.includes('approved') || s.includes('successful') || s.includes('completed') || s.includes('paid'))
    return 'Successful'
  if (s.includes('pending') || s.includes('initialized') || s.includes('processing')) return 'Pending'
  if (s.includes('failed') || s.includes('declined')) return 'Failed'
  if (s.includes('reversed') || s.includes('reversal')) return 'Reversed'
  if (s.includes('resolved')) return 'Resolved'
  return String(record.status)
}

const getStatusTone = (label: string) => {
  const s = norm(label)
  if (s.includes('successful') || s.includes('approved') || s.includes('resolved'))
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
  if (s.includes('pending'))
    return 'bg-amber-500/15 text-amber-300 border-amber-500/20'
  if (s.includes('failed'))
    return 'bg-red-500/15 text-red-300 border-red-500/20'
  return 'bg-gray-700/40 text-gray-300 border-gray-700/40'
}

const formatDate = (value?: string) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const formatTime = (value?: string) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const maskRef = (value?: string) => {
  const raw = String(value ?? '').replace(/\s+/g, '')
  if (!raw) return '----'
  if (raw.length <= 6) return raw
  return `****${raw.slice(-4)}`
}

const getIcon = (kind: string) => {
  if (kind.includes('wallet') || kind.includes('transaction') || kind.includes('transfer')) return 'credit-card'
  if (kind.includes('bill')) return 'file-text'
  if (kind.includes('card')) return 'zap'
  if (kind.includes('circle')) return 'users'
  return 'activity'
}

const getAmount = (record: any, kind: string) => {
  const meta = (record.meta as any) || {}

  const centsRaw = record.amount_cents ?? record.amountCents ?? meta.amount_cents ?? meta.amountCents
  const cents = centsRaw !== undefined && centsRaw !== null ? Number(centsRaw) : null

  const currency =
    meta.currency ||
    record.currency ||
    (String(meta.wallet_type || '').toLowerCase() === 'usd' || kind.includes('card') ? 'USD' : 'NGN')

  if (cents !== null && Number.isFinite(cents)) return moneyFormat(cents / 100, currency)

  const amtRaw = record.amount ?? meta.amount ?? record.total_amount ?? meta.total_amount
  const amt = amtRaw !== undefined && amtRaw !== null ? Number(amtRaw) : null
  if (amt !== null && Number.isFinite(amt)) return moneyFormat(amt, currency)

  return ''
}

const getAmountSign = (record: any, kind: string) => {
  const meta = (record.meta as any) || {}
  const txType = norm(meta.transaction_type)
  if (txType === 'deposit' || txType === 'credit') return '+'
  if (txType === 'withdrawal' || txType === 'debit') return '-'
  if (kind.includes('bill') || kind.includes('card')) return '-'
  return ''
}

const TimelineCard = ({ item, onPress }: TimelineCardProps) => {
  const kind = useMemo(() => getKind(item), [item])
  const title = useMemo(() => getTitle(item), [item])
  const subtitle = useMemo(() => getSubtitle(kind, item), [kind, item])
  const status = useMemo(() => getStatusLabel(item), [item])
  const statusTone = useMemo(() => getStatusTone(status), [status])

  const occurredAt = String(item.occurred_at || item.created_at || item.createdAt || '')
  const dateText = `${formatDate(occurredAt)} ${formatTime(occurredAt)}`.trim()

  const meta = (item.meta as any) || {}
  const refRaw =
    meta.reference ||
    item.reference ||
    meta.transaction_reference ||
    meta.payment_reference ||
    meta.provider_reference ||
    meta.session_id ||
    ''
  const ref = maskRef(String(refRaw || ''))

  const amount = useMemo(() => getAmount(item, kind), [item, kind])
  const sign = useMemo(() => getAmountSign(item, kind), [item, kind])
  const icon = useMemo(() => getIcon(kind), [kind])

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        console.log('[TimelineCard] onPress fired')
        onPress?.()
      }}
      className="bg-gray-900/80 my-2 p-4 rounded-2xl border border-white/5"
      style={{ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 2 }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center flex-1">
          <View className="w-12 h-12 rounded-full bg-gray-800 items-center justify-center border border-white/5 mr-3">
            <Feather name={icon as any} size={16} color="#f59e0b" />
          </View>

          <View className="flex-1">
            <Text className="text-white text-sm font-semibold">{title}</Text>
            <Text className="text-gray-400 text-xs mt-1">{subtitle}</Text>

            {!!dateText && <Text className="text-gray-500 text-[11px] mt-2">{dateText}</Text>}
          </View>
        </View>

        <View className="items-end ml-3">
          {!!amount && <Text className="text-white text-sm font-semibold">{`${sign}${amount}`}</Text>}

          {!!status && (
            <View className={`px-2 py-1 rounded-full mt-2 border ${statusTone}`}>
              <Text className="text-[10px] uppercase">{status}</Text>
            </View>
          )}
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-gray-500 text-[11px]">{`Ref: ${ref}`}</Text>
        <View className="px-2 py-1 rounded-full bg-gray-800/80">
          <Text className="text-gray-300 text-[10px]">
            {String(meta.visibility || meta.scope || 'Private')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default TimelineCard
