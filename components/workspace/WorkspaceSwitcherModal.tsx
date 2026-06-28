import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Image, Text, TouchableOpacity, View } from 'react-native'
import AppModal from '@/components/modal/Modal'
import { icons } from '@/constants/icons'
import type { ActiveAccount } from '@/services/useActiveAccount'

export type WorkspaceBusiness = {
  id: string
  name?: string
  status?: string
  current_user_role?: string
}

export type WorkspaceCircle = {
  id: string
  name?: string
  role?: string
  circle_type?: string
  member_count?: number
}

type WorkspaceSwitcherModalProps = {
  open: boolean
  onClose: () => void
  activeAccount: ActiveAccount
  activeIdentityName: string
  activeIdentityMeta?: string
  activeIdentityBadge: string
  accountHydrated: boolean
  businessLoading: boolean
  circlesLoading: boolean
  circlesError?: string | null
  businessAccounts: WorkspaceBusiness[]
  circleAccounts: WorkspaceCircle[]
  selectedBusinessName?: string | null
  selectedCircleName?: string | null
  onSelectPersonal: () => Promise<void> | void
  onSelectBusiness: (businessId: string) => Promise<void> | void
  onSelectCircle: (circleId: string) => Promise<void> | void
  onOpenBusinessCreate?: () => void
  onOpenCircles: () => void
  onLogout?: () => void
  footer?: React.ReactNode
}

const formatLabel = (value: string, fallback = 'Member') =>
  String(value || fallback)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

export default function WorkspaceSwitcherModal({
  open,
  onClose,
  activeAccount,
  activeIdentityName,
  activeIdentityMeta,
  accountHydrated,
  businessLoading,
  circlesLoading,
  circlesError,
  businessAccounts,
  circleAccounts,
  onSelectPersonal,
  onSelectBusiness,
  onSelectCircle,
  onOpenBusinessCreate,
  onOpenCircles,
  onLogout,
  footer,
}: WorkspaceSwitcherModalProps) {
  const [switchingKey, setSwitchingKey] = useState<string | null>(null)
  const isPersonalActive = activeAccount.type === 'personal'

  const handleSwitch = async (key: string, action: () => Promise<void> | void) => {
    if (switchingKey) return
    setSwitchingKey(key)
    try {
      await action()
      onClose()
    } finally {
      setSwitchingKey(null)
    }
  }

  const businessItems = businessAccounts.map((business) => ({
    key: `business-${business.id}`,
    name: business.name || 'Business account',
    meta: `Business${business.current_user_role ? ` - ${formatLabel(String(business.current_user_role), 'Member')}` : ''}${business.status ? ` - ${formatLabel(String(business.status), 'Setup')}` : ''}`,
    active: activeAccount.type === 'business' && String(activeAccount.businessId) === String(business.id),
    icon: 'business-outline' as const,
    tone: 'business' as const,
    onPress: () => onSelectBusiness(String(business.id)),
  }))
  const circleItems = circleAccounts.map((circle) => ({
    key: `circle-${circle.id}`,
    name: circle.name || 'Circle',
    meta: `Circle${circle.role ? ` - ${formatLabel(String(circle.role), 'Member')}` : ''}`,
    active: activeAccount.type === 'circle' && String(activeAccount.circleId) === String(circle.id),
    icon: 'people-outline' as const,
    tone: 'circle' as const,
    onPress: () => onSelectCircle(String(circle.id)),
  }))
  const currentItem =
    isPersonalActive
      ? {
          key: 'personal',
          name: activeIdentityName || 'Personal account',
          meta: activeIdentityMeta || 'Personal',
          active: true,
          icon: 'person-outline' as const,
          tone: 'personal' as const,
          onPress: () => onSelectPersonal(),
        }
      : [...businessItems, ...circleItems].find((item) => item.active) || null

  const renderRow = ({
    item,
    highlighted = false,
  }: {
    item: {
      key: string
      name: string
      meta: string
      active: boolean
      icon: 'person-outline' | 'business-outline' | 'people-outline'
      tone: 'personal' | 'business' | 'circle'
      onPress: () => Promise<void> | void
    }
    highlighted?: boolean
  }) => {
    const iconColor = item.tone === 'circle' ? '#7DD3FC' : item.tone === 'business' ? '#FFB05A' : '#E2E8F0'
    const isSwitching = switchingKey === item.key
    const disabled = Boolean(switchingKey && !isSwitching)

    return (
      <TouchableOpacity
        key={item.key}
        onPress={() => {
          void handleSwitch(item.key, item.onPress)
        }}
        activeOpacity={0.8}
        disabled={disabled}
        className={`flex-row items-center justify-between rounded-2xl px-3 py-3 ${highlighted ? 'bg-white/6' : 'bg-transparent'} ${disabled ? 'opacity-60' : ''}`}
      >
        <View className="flex-row flex-1 items-center gap-3">
          <View className={`h-10 w-10 items-center justify-center rounded-full ${highlighted ? 'bg-white/8' : 'bg-gray-900/80'}`}>
            <Ionicons name={item.icon} size={18} color={iconColor} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-white" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="mt-1 text-xs text-slate-400" numberOfLines={1}>
              {item.meta}
            </Text>
          </View>
        </View>
        {isSwitching ? (
          <Text className="text-[11px] font-semibold uppercase text-slate-300">Switching...</Text>
        ) : highlighted ? (
          <Text className="text-[11px] font-semibold uppercase text-slate-300">Current account</Text>
        ) : (
          <Ionicons name="chevron-forward" size={16} color="#64748B" />
        )}
      </TouchableOpacity>
    )
  }

  return (
    <AppModal open={open} onclose={onClose}>
      <View className="w-full rounded-2xl bg-[#0f172a] px-4 pb-4">
        <View className="my-2 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={onClose}
            className="h-9 w-9 items-center justify-center rounded-full border border-gray-800 bg-gray-950/50"
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <Text className="text-center text-xl font-semibold text-white">Switch account</Text>

          <View className="h-9 w-9" />
        </View>

        <View className="my-4 gap-5">
          <View>
            <Text className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">Personal</Text>
            <View className="gap-1">
              {renderRow({
                item:
                  currentItem?.key === 'personal'
                    ? currentItem
                    : {
                        key: 'personal',
                        name: 'Personal account',
                        meta: 'Personal',
                        active: false,
                        icon: 'person-outline',
                        tone: 'personal',
                        onPress: () => onSelectPersonal(),
                      },
                highlighted: currentItem?.key === 'personal',
              })}
            </View>
          </View>

          <View>
            <Text className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">Your businesses</Text>
            {businessItems.length ? (
              <View className="gap-1">
                {businessItems.map((item) => renderRow({ item, highlighted: item.active }))}
              </View>
            ) : (
              <Text className="px-3 py-2 text-sm text-slate-500">No business accounts yet.</Text>
            )}
          </View>

          <View>
            <Text className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">Groups</Text>
            {circlesLoading ? (
              <Text className="px-3 py-2 text-sm text-slate-400">Loading groups...</Text>
            ) : circlesError ? (
              <Text className="px-3 py-2 text-sm text-rose-300">{circlesError}</Text>
            ) : circleItems.length ? (
              <View className="gap-1">
                {circleItems.map((item) => renderRow({ item, highlighted: item.active }))}
              </View>
            ) : (
              <Text className="px-3 py-2 text-sm text-slate-500">No groups yet.</Text>
            )}
          </View>

          <View>
            <Text className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">Actions</Text>
            <View className="gap-1">
              {onOpenBusinessCreate ? (
                <TouchableOpacity
                  onPress={() => {
                    onClose()
                    onOpenBusinessCreate()
                  }}
                  className="flex-row items-center justify-between rounded-2xl px-3 py-3"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-900/80">
                      <Ionicons name="add" size={18} color="#E2E8F0" />
                    </View>
                    <Text className="text-sm font-semibold text-white">Create business account</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#64748B" />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => {
                  onClose()
                  onOpenCircles()
                }}
                className="flex-row items-center justify-between rounded-2xl px-3 py-3"
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-900/80">
                    <Ionicons name="settings-outline" size={18} color="#E2E8F0" />
                  </View>
                  <Text className="text-sm font-semibold text-white">Manage groups</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {footer}

          {onLogout ? (
            <TouchableOpacity
              onPress={() => {
                onClose()
                onLogout()
              }}
              className="mt-2 flex-row items-center gap-3 rounded-2xl px-3 py-3"
            >
              <Image source={icons.logout} tintColor={'#f4b000'} className="h-4 w-4" />
              <Text className="text-sm font-semibold text-white">Log out</Text>
            </TouchableOpacity>
          ) : null}

          {accountHydrated && (businessLoading || circlesLoading) ? (
            <Text className="text-center text-xs text-slate-500">
              {switchingKey
                ? 'Switching account...'
                : businessLoading && circlesLoading
                  ? 'Refreshing accounts...'
                  : businessLoading
                    ? 'Refreshing businesses...'
                    : 'Refreshing circles...'}
            </Text>
          ) : null}
        </View>
      </View>
    </AppModal>
  )
}
