import React from 'react'
import { Feather, Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, TouchableOpacity, View } from 'react-native'

export type BusinessMetricTone = 'amber' | 'emerald' | 'sky' | 'slate'
export type BusinessStatusTone = 'live' | 'ready' | 'review' | 'setup'
export type BusinessActivityItem = {
  id: string
  title: string
  subtitle?: string
  amountLabel?: string
  signedAmountLabel?: string
  statusLabel?: string
  timeLabel?: string
  tone?: 'success' | 'pending' | 'failed' | 'info'
  onPress?: () => void
}

type IconName = React.ComponentProps<typeof Ionicons>['name']
type HeroAction = {
  label: string
  icon: IconName
  onPress?: () => void
  disabled?: boolean
  subtle?: boolean
  comingSoon?: boolean
}

type BusinessControlsAction = {
  label: string
  icon: IconName
  onPress?: () => void
  subtle?: boolean
  badge?: string | null
}

const metricToneStyles: Record<BusinessMetricTone, { dot: string; value: string }> = {
  amber: { dot: '#FFB05A', value: 'text-[#FFD7A6]' },
  emerald: { dot: '#34D399', value: 'text-emerald-200' },
  sky: { dot: '#7DD3FC', value: 'text-sky-200' },
  slate: { dot: '#94A3B8', value: 'text-slate-100' },
}

const statusToneStyles: Record<BusinessStatusTone, { gradient: readonly [string, string, string] }> = {
  live: { gradient: ['rgba(9,16,24,1)', 'rgba(11,20,30,0.98)', 'rgba(7,11,18,1)'] },
  ready: { gradient: ['rgba(17,15,12,1)', 'rgba(20,18,14,0.98)', 'rgba(8,12,18,1)'] },
  review: { gradient: ['rgba(10,16,24,1)', 'rgba(12,19,29,0.98)', 'rgba(8,12,18,1)'] },
  setup: { gradient: ['rgba(13,17,23,1)', 'rgba(12,16,22,0.98)', 'rgba(8,12,18,1)'] },
}

const activityToneStyles = {
  success: { container: 'bg-emerald-500/12', text: 'text-emerald-200' },
  pending: { container: 'bg-amber-500/12', text: 'text-amber-200' },
  failed: { container: 'bg-red-500/12', text: 'text-red-200' },
  info: { container: 'bg-sky-500/12', text: 'text-sky-200' },
} as const

export const BusinessMetricPill = ({
  label,
  value,
  subtitle,
  tone = 'slate',
}: {
  label: string
  value: string
  tone?: BusinessMetricTone
  subtitle?: string
}) => {
  const palette = metricToneStyles[tone]
  return (
    <View className="min-w-[140px] flex-1 px-1 py-1">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.dot }} />
        <Text className="text-[11px] text-slate-500">{label}</Text>
      </View>
      <Text className={`mt-2 text-[16px] font-semibold ${palette.value}`}>{value}</Text>
      {subtitle ? <Text className="mt-1 text-[11px] text-slate-500">{subtitle}</Text> : null}
    </View>
  )
}

export const BusinessSetupBanner = ({
  stage,
  title,
  body,
  ctaLabel,
  onPress,
  progress = 0,
  progressLabel,
  tone = 'amber',
}: {
  stage: string
  title: string
  body: string
  ctaLabel: string
  onPress: () => void
  progress?: number
  progressLabel?: string
  tone?: 'amber' | 'sky' | 'emerald'
}) => {
  const palette = {
    amber: { container: 'border-[#FFB05A]/18 bg-[#FFB05A]/10', title: 'text-[#FFD7A6]', fill: '#FFB05A' },
    sky: { container: 'border-sky-500/18 bg-sky-500/10', title: 'text-sky-100', fill: '#7DD3FC' },
    emerald: { container: 'border-emerald-500/18 bg-emerald-500/10', title: 'text-emerald-100', fill: '#34D399' },
  }[tone]
  const clamped = Math.max(0, Math.min(100, progress))

  return (
    <View className={`rounded-[28px] border px-5 py-5 ${palette.container}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[11px] text-slate-400">{stage}</Text>
          <Text className={`mt-2 text-[17px] font-semibold ${palette.title}`}>{title}</Text>
          <Text className="mt-2 text-sm leading-6 text-slate-200">{body}</Text>
        </View>
        <View className="rounded-full bg-black/20 px-3 py-2">
          <Text className="text-[11px] font-medium text-slate-300">{progressLabel || `${Math.round(clamped)}%`}</Text>
        </View>
      </View>
      <View className="mt-5 h-2 overflow-hidden rounded-full bg-black/25">
        <View className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: palette.fill }} />
      </View>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="mt-5 items-center rounded-[18px] bg-[#FFB05A] px-4 py-4">
        <Text className="text-sm font-semibold text-black">{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  )
}

export const BusinessHeroCard = ({
  statusTone = 'setup',
  balanceLabel,
  balanceCaption = 'Available balance',
  bankLine,
  accountLine,
  primaryActions,
  onCopyAccount,
  metaChips = [],
}: {
  statusTone?: BusinessStatusTone
  balanceLabel: string
  balanceCaption?: string
  bankLine?: string | null
  accountLine?: string | null
  primaryActions: HeroAction[]
  onCopyAccount?: () => void
  metaChips?: Array<{ label: string; value: string; tone?: BusinessMetricTone }>
}) => {
  const palette = statusToneStyles[statusTone]

  return (
    <LinearGradient colors={palette.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="overflow-hidden rounded-[38px] px-5 py-8">
      <Text className="text-[15px] font-medium text-slate-300">Treasury</Text>
      <Text className="mt-7 text-[13px] text-slate-500">{balanceCaption}</Text>
      <Text className="mt-2 text-[42px] font-semibold text-white" numberOfLines={1}>{balanceLabel}</Text>

      {(accountLine || bankLine) ? (
        <View className="mt-7 flex-row items-center justify-between gap-3 rounded-[24px] bg-white/[0.04] px-4 py-4">
          <View className="flex-1">
            <Text className="text-[12px] text-slate-500">Receiving account</Text>
            {accountLine ? <Text className="mt-1 text-[15px] font-semibold text-white" numberOfLines={1}>{accountLine}</Text> : null}
            {bankLine ? <Text className="mt-1 text-[12px] text-slate-400" numberOfLines={1}>{bankLine}</Text> : null}
          </View>
          {onCopyAccount && accountLine ? (
            <TouchableOpacity onPress={onCopyAccount} activeOpacity={0.85} className="rounded-full bg-white/[0.08] px-3.5 py-2.5">
              <View className="flex-row items-center gap-2">
                <Ionicons name="copy-outline" size={14} color="#E2E8F0" />
                <Text className="text-[11px] font-medium text-slate-300">Copy</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {metaChips.length ? (
        <View className="mt-6 rounded-[24px] border border-white/[0.06] bg-white/[0.04] px-4 py-4">
          <View className="flex-row items-center justify-between gap-4">
            {metaChips.map((item, index) => {
              const paletteTone = metricToneStyles[item.tone || 'slate']
              return (
                <React.Fragment key={`${item.label}-${item.value}`}>
                  {index > 0 ? <View className="h-10 w-px bg-white/8" /> : null}
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: paletteTone.dot }} />
                      <Text className="text-[11px] text-slate-500">{item.label}</Text>
                    </View>
                    <Text className={`mt-2 text-[16px] font-semibold ${paletteTone.value}`}>{item.value}</Text>
                  </View>
                </React.Fragment>
              )
            })}
          </View>
        </View>
      ) : null}

      <View className="mt-6 gap-3">
        {primaryActions.slice(0, 3).map((item, index) => {
          const Container = item.onPress && !item.disabled ? TouchableOpacity : View
          return (
            <Container
              key={item.label}
              {...(item.onPress && !item.disabled ? { onPress: item.onPress, activeOpacity: 0.85 } : {})}
              className={`rounded-[22px] px-5 py-4 ${item.disabled ? 'bg-white/[0.04]' : index === 0 ? 'bg-[#FFB05A]' : 'bg-white/[0.08]'}`}
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-row items-center gap-3">
                  <View className={`h-10 w-10 items-center justify-center rounded-[14px] ${item.disabled ? 'bg-white/[0.05]' : index === 0 ? 'bg-black/10' : 'bg-white/[0.08]'}`}>
                    <Ionicons name={item.icon} size={18} color={item.disabled ? '#64748B' : index === 0 ? '#111827' : '#FFB05A'} />
                  </View>
                  <Text className={`text-[15px] font-semibold ${item.disabled ? 'text-slate-500' : index === 0 ? 'text-[#111827]' : 'text-white'}`}>{item.label}</Text>
                </View>
                <Feather name="arrow-up-right" size={16} color={item.disabled ? '#475569' : index === 0 ? '#111827' : '#94A3B8'} />
              </View>
            </Container>
          )
        })}
      </View>
    </LinearGradient>
  )
}

export const BusinessControlsCard = ({
  membersLabel,
  approvalsLabel,
  controlsActions,
  utilityActions = [],
}: {
  membersLabel: string
  approvalsLabel: string
  controlsActions: BusinessControlsAction[]
  utilityActions?: BusinessControlsAction[]
}) => {
  return (
    <View className="rounded-[32px] bg-[#0D131D] px-5 py-6">
      <Text className="text-[15px] font-medium text-slate-300">Team & controls</Text>
      <View className="mt-6 flex-row items-center gap-4">
        <View className="flex-1">
          <Text className="text-[12px] text-slate-500">Members</Text>
          <Text className="mt-2 text-[30px] font-semibold text-white">{membersLabel}</Text>
        </View>
        <View className="h-12 w-px bg-white/8" />
        <View className="flex-1">
          <Text className="text-[12px] text-slate-500">Pending approvals</Text>
          <Text className="mt-2 text-[30px] font-semibold text-white">{approvalsLabel}</Text>
        </View>
      </View>

      <View className="mt-7 gap-3">
        {controlsActions.slice(0, 2).map((item) => {
          const Container = item.onPress ? TouchableOpacity : View
          return (
            <Container
              key={item.label}
              {...(item.onPress ? { onPress: item.onPress, activeOpacity: 0.85 } : {})}
              className={`rounded-[20px] px-4 py-4 ${item.subtle ? 'bg-white/[0.045]' : 'bg-white/[0.07]'}`}
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-row items-center gap-3">
                  <View className={`h-10 w-10 items-center justify-center rounded-[16px] ${item.subtle ? 'bg-white/[0.06]' : 'bg-white/[0.08]'}`}>
                    <Ionicons name={item.icon} size={18} color={item.subtle ? '#E2E8F0' : '#FFB05A'} />
                  </View>
                  <Text className="text-[14px] font-semibold text-white">{item.label}</Text>
                </View>
                {item.badge ? <Text className="text-[11px] text-slate-400">{item.badge}</Text> : null}
              </View>
            </Container>
          )
        })}
      </View>

      {utilityActions.length ? (
        <View className="mt-7 flex-row flex-wrap gap-2.5">
          {utilityActions.map((item) => {
            const Container = item.onPress ? TouchableOpacity : View
            return (
              <Container
                key={item.label}
                {...(item.onPress ? { onPress: item.onPress, activeOpacity: 0.85 } : {})}
                className="rounded-full bg-white/[0.045] px-3.5 py-2.5"
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name={item.icon} size={14} color="#94A3B8" />
                  <Text className="text-[11px] font-semibold text-slate-200">{item.label}</Text>
                  {item.badge ? <Text className="text-[10px] text-slate-500">{item.badge}</Text> : null}
                </View>
              </Container>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

export const BusinessRecentActivity = ({
  items,
  onViewAll,
  onEmptyAction,
  emptyActionLabel = 'Make first transfer',
  emptyTitle = 'No business activity yet',
  emptySubtitle = 'Fund this account or send your first business payment.',
}: {
  items: BusinessActivityItem[]
  onViewAll?: () => void
  onEmptyAction?: () => void
  emptyActionLabel?: string
  emptyTitle?: string
  emptySubtitle?: string
}) => {
  const hasItems = items.length > 0

  return (
    <View className="rounded-[32px] bg-[#0D131D] px-5 py-6">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[17px] font-semibold text-white">Recent activity</Text>
        {onViewAll ? (
          <TouchableOpacity onPress={onViewAll} activeOpacity={0.8} className="rounded-full bg-white/[0.05] px-3 py-2">
            <Text className="text-[11px] font-semibold text-slate-200">View all</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {hasItems ? (
        <View className="mt-5 gap-3">
          {items.map((item) => {
            const Container = item.onPress ? TouchableOpacity : View
            const palette = activityToneStyles[item.tone || 'info']
            return (
              <Container
                key={item.id}
                {...(item.onPress ? { onPress: item.onPress, activeOpacity: 0.85 } : {})}
                className="rounded-[22px] bg-[#0B1119] px-4 py-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-white" numberOfLines={1}>{item.title}</Text>
                    {item.subtitle ? <Text className="mt-1 text-xs leading-5 text-slate-400" numberOfLines={1}>{item.subtitle}</Text> : null}
                    <View className="mt-3 flex-row items-center gap-2">
                      {item.statusLabel ? (
                        <View className={`rounded-full px-2.5 py-1 ${palette.container}`}>
                          <Text className={`text-[10px] font-semibold ${palette.text}`}>{item.statusLabel}</Text>
                        </View>
                      ) : null}
                      {item.timeLabel ? <Text className="text-[10px] text-slate-500">{item.timeLabel}</Text> : null}
                    </View>
                  </View>
                  <View className="items-end">
                    {item.signedAmountLabel ? <Text className="text-sm font-semibold text-white">{item.signedAmountLabel}</Text> : item.amountLabel ? <Text className="text-sm font-semibold text-white">{item.amountLabel}</Text> : null}
                    <Feather name="chevron-right" size={16} color="#64748B" />
                  </View>
                </View>
              </Container>
            )
          })}
        </View>
      ) : (
        <View className="mt-5 rounded-[22px] bg-[#0B1119] px-4 py-5">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#FFB05A]/12">
              <Ionicons name="time-outline" size={18} color="#FFB05A" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-white">{emptyTitle}</Text>
              <Text className="mt-1 text-xs leading-5 text-slate-400">{emptySubtitle}</Text>
            </View>
          </View>
          {onEmptyAction ? (
            <TouchableOpacity onPress={onEmptyAction} activeOpacity={0.85} className="mt-4 items-center rounded-2xl bg-[#FFB05A]/12 px-4 py-4">
              <Text className="text-sm font-semibold text-white">{emptyActionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  )
}

export const BusinessDashboardSkeleton = () => {
  const Block = ({ className }: { className: string }) => <View className={`rounded-2xl bg-white/6 ${className}`} />

  return (
    <View className="gap-7">
      <View className="rounded-[34px] bg-[#0F1420] px-6 py-7">
        <Block className="h-4 w-24" />
        <Block className="mt-6 h-12 w-48" />
        <Block className="mt-6 h-12 w-full rounded-[20px]" />
        <Block className="mt-6 h-20 w-full rounded-[22px]" />
        <Block className="mt-6 h-16 w-full rounded-[20px]" />
        <Block className="mt-3 h-16 w-full rounded-[20px]" />
        <Block className="mt-3 h-16 w-full rounded-[20px]" />
      </View>
      <View className="rounded-[32px] bg-[#0F1420] px-5 py-6">
        <View className="flex-row gap-4">
          <Block className="h-20 flex-1" />
          <Block className="h-20 flex-1" />
        </View>
        <Block className="mt-6 h-16 w-full rounded-[20px]" />
        <Block className="mt-3 h-16 w-full rounded-[20px]" />
      </View>
      <View className="rounded-[30px] bg-[#0F1420] p-5">
        <Block className="h-4 w-36" />
        <Block className="mt-5 h-16 w-full" />
        <Block className="mt-3 h-16 w-full" />
        <Block className="mt-3 h-16 w-full" />
      </View>
    </View>
  )
}
