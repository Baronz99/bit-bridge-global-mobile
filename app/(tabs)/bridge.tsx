import React, { useMemo } from 'react'
import type { ImageSourcePropType } from 'react-native'
import { Image, Text, TouchableOpacity, View } from 'react-native'
import { type Href, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import ScreenContainer from '@/components/ScreenContainer'
import ViewBox from '@/components/view-box/ViewBoxIcon'
import { icons } from '@/constants/icons'
import { FEATURE_CIRCLES } from '@/constants/featureFlags'
import { useAuth } from '@/services/useAuth'
import { getTierFromProfile, isTierEligibleForBankTransfer } from '@/utils/bankTransfer'

type HubItem = {
  id: string
  label: string
  link: Href
  image: ImageSourcePropType
}

export default function BridgeHub() {
  const router = useRouter()
  const { userProfileData } = useAuth()
  const canUseBankTransfer = isTierEligibleForBankTransfer(getTierFromProfile(userProfileData))

  const primaryActions = useMemo(
    () =>
      [
        { id: 'send', label: 'Send Money', subtitle: 'Move money across local rails.', link: '/send-money', image: icons.transfer },
        {
          id: 'receive',
          label: 'Receive',
          subtitle: 'Accept NGN deposits into your Bridge rail.',
          link: '/anchor-account',
          image: icons.wallet,
        },
      ] as (HubItem & { subtitle: string })[],
    []
  )

  const railActions = useMemo(
    () =>
      [
        ...(canUseBankTransfer
          ? [{ id: 'bank-transfer', label: 'Bank Transfer', link: '/bank-transfer', image: icons.transaction }]
          : []),
        { id: 'beneficiaries', label: 'Beneficiaries', link: '/beneficiaries', image: icons.user },
        { id: 'fund', label: 'Fund Wallet', link: '/fundWallet', image: icons.walletColor },
        { id: 'virtual-account', label: 'Virtual Account', link: '/anchor-account', image: icons.wallet },
      ] as HubItem[],
    [canUseBankTransfer]
  )

  const utilities = useMemo(
    () =>
      [
        { id: 'airtime', label: 'Airtime', link: '/airtime-top-up', image: icons.call },
        { id: 'data', label: 'Data', link: '/data-subscription', image: icons.data },
        { id: 'electricity', label: 'Electricity', link: '/powerProviders', image: icons.power },
        { id: 'cable', label: 'Cable TV', link: '/cableProviders', image: icons.tv },
      ] as HubItem[],
    []
  )

  const renderCompactItem = (item: HubItem, tone: 'default' | 'utility' = 'default') => {
    const iconWrapClass =
      tone === 'utility'
        ? 'h-10 w-10 rounded-xl border border-gray-800 bg-gray-900'
        : 'h-10.5 w-10.5 rounded-xl border border-gray-800 bg-gray-900'

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.9}
        onPress={() => router.push(item.link)}
        className="items-center rounded-[20px] border border-gray-800 bg-gray-950/80 px-2 py-2.5"
      >
        <View className={`items-center justify-center ${iconWrapClass}`}>
          <Image source={item.image} tintColor="#ffcc00" resizeMode="contain" style={{ width: 18, height: 18 }} />
        </View>
        <Text className="mt-2 text-center text-[11px] font-medium text-white" numberOfLines={2}>
          {item.label}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <ScreenContainer>
      <View className="rounded-[28px] border border-gray-800 bg-gray-900/85 px-5 py-6 shadow-2xl">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-white text-[28px] font-semibold">Bridge</Text>
            <Text className="text-gray-400 mt-2 text-sm">Local NGN rail for everyday money movement.</Text>
          </View>
          <View className="h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10">
            <Ionicons name="swap-horizontal" size={20} color="#f4b000" />
          </View>
        </View>
      </View>

      <View className="mt-8 gap-7">
        <View className="flex-row gap-3">
          {primaryActions.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.9}
              onPress={() => router.push(item.link)}
              className="flex-1 rounded-[24px] border border-amber-500/20 bg-gray-900/90 px-4 py-5 shadow-lg"
            >
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
                <Image source={item.image} tintColor="#ffcc00" resizeMode="contain" style={{ width: 22, height: 22 }} />
              </View>
              <View className="mt-4 min-h-[64px]">
                <Text className="text-white text-[17px] font-semibold">{item.label}</Text>
                <Text className="mt-2 text-xs leading-5 text-gray-400">{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View className="rounded-[24px] border border-gray-800 bg-gray-900/70 px-4 py-4 shadow-lg">
          <Text className="text-white text-lg font-semibold">Bridge actions</Text>
          <Text className="text-gray-400 text-xs mt-1">Keep local movement and account control close.</Text>

          <View className="flex-row flex-wrap mt-5 -mx-1">
            {railActions.map((item) => (
              <View key={item.id} className="w-1/3 px-1 pb-2.5">
                {renderCompactItem(item)}
              </View>
            ))}
          </View>
        </View>

        <View className="rounded-[24px] border border-gray-800 bg-gray-900/70 px-4 py-4 shadow-lg">
          <Text className="text-white text-lg font-semibold">Utilities</Text>
          <Text className="text-gray-400 text-xs mt-1">Everyday local payments without leaving Bridge.</Text>

          <View className="flex-row flex-wrap mt-5 -mx-1">
            {utilities.map((item) => (
              <View key={item.id} className="w-1/4 px-1">
                {renderCompactItem(item, 'utility')}
              </View>
            ))}
          </View>
        </View>

        {FEATURE_CIRCLES ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => router.push('/circles')}
            className="rounded-[24px] border border-amber-500/35 bg-gray-900/80 px-5 py-4 shadow-lg"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <View className="bg-amber-500/10 border border-amber-500/25 rounded-full self-start px-3 py-1.5">
                  <Text className="text-xs text-amber-200">Premium shared money</Text>
                </View>
                <Text className="mt-3 text-white text-lg font-semibold">Circles</Text>
                <Text className="mt-1 text-gray-300 text-sm">Shared balances and group payouts inside Bridge.</Text>
              </View>
              <View className="h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
                <Ionicons name="people-outline" size={20} color="#f4b000" />
              </View>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScreenContainer>
  )
}
