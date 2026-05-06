import React, { useMemo } from 'react'
import type { ImageSourcePropType } from 'react-native'
import { Image, Text, TouchableOpacity, View } from 'react-native'
import { type Href, router } from 'expo-router'
import { Feather, Ionicons } from '@expo/vector-icons'

import { getRewards } from '@/api/rewards'
import { getWallet } from '@/api/wallet'
import ScreenContainer from '@/components/ScreenContainer'
import { icons } from '@/constants/icons'
import { FEATURE_REWARDS } from '@/constants/featureFlags'
import { useActiveAccount } from '@/services/useActiveAccount'
import { useAuth } from '@/services/useAuth'
import useFetch from '@/services/useFetch'
import { getTierFromProfile, isTierEligibleForBankTransfer } from '@/utils/bankTransfer'
import moneyFormat from '@/utils/moneyFormat'

type HubItem = {
  id: string
  label: string
  link: Href
  image: ImageSourcePropType
}

export default function BridgeHub() {
  const { userProfileData } = useAuth()
  const { activeAccount } = useActiveAccount()
  const isPersonalAccount = activeAccount?.type === 'personal'
  const isCircleAccount = activeAccount?.type === 'circle'
  const canUseBankTransfer = isTierEligibleForBankTransfer(getTierFromProfile(userProfileData))
  const { data: walletData } = useFetch(() => getWallet(activeAccount), {
    autoFetch: isCircleAccount,
    queryKey: ['wallet', activeAccount, 'bridge-header'],
  })
  const { data: rewardsData } = useFetch(() => getRewards(), {
    autoFetch: FEATURE_REWARDS && isPersonalAccount,
    queryKey: ['rewards', 'bridge-summary'],
  })
  const circleAccount = (walletData as any)?.data?.circle ?? (walletData as any)?.circle ?? null
  const rewardsSummary = useMemo(() => {
    if (rewardsData?.data && !Array.isArray(rewardsData?.data)) return rewardsData.data
    if (rewardsData?.summary && !Array.isArray(rewardsData?.summary)) return rewardsData.summary
    return null
  }, [rewardsData])
  const rewardsList = useMemo(() => {
    if (Array.isArray(rewardsData?.rewards)) return rewardsData.rewards
    if (Array.isArray(rewardsData?.data?.rewards)) return rewardsData.data.rewards
    return []
  }, [rewardsData])
  const rewardsTotal = useMemo(() => {
    const summaryTotal = Number(rewardsSummary?.total_earned ?? NaN)
    if (Number.isFinite(summaryTotal)) return summaryTotal
    return rewardsList.reduce((sum: number, item: any) => {
      const amount = Number(item?.amount ?? 0)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)
  }, [rewardsList, rewardsSummary?.total_earned])
  const rewardsCount = Number(rewardsSummary?.reward_count ?? rewardsList.length ?? 0)
  const rewardsDescription = rewardsTotal > 0
    ? `${rewardsCount > 0 ? `${rewardsCount} reward${rewardsCount === 1 ? '' : 's'} earned` : 'Rewards earned'} from airtime and data purchases.`
    : 'Earn 1% cashback automatically on eligible airtime and data purchases.'
  const circleName = String(
    circleAccount?.name ?? circleAccount?.title ?? circleAccount?.display_name ?? 'Circle'
  )
  const circleRoleLabel = String(
    circleAccount?.current_user_role ??
      circleAccount?.membership_role ??
      circleAccount?.role ??
      'member'
  )
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
  const circleMembersCount = Number(circleAccount?.member_count ?? circleAccount?.members_count ?? 0)

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
        { id: 'virtual-account', label: 'Deposit Account', link: '/anchor-account', image: icons.wallet },
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
            <Text className="text-white text-[28px] font-semibold">
              {isCircleAccount ? circleName : 'Bridge'}
            </Text>
            <Text className="text-gray-400 mt-2 text-sm">
              {isCircleAccount
                ? 'Bridge wallet actions stay in personal or business accounts.'
                : 'Local NGN rail for everyday money movement.'}
            </Text>
            {isCircleAccount ? (
              <View className="flex-row flex-wrap gap-2 mt-4">
                <View className="bg-emerald-500/10 border border-emerald-500/25 rounded-full px-3 py-1.5">
                  <Text className="text-xs text-emerald-100">Circle account</Text>
                </View>
                {circleMembersCount > 0 ? (
                  <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1.5">
                    <Text className="text-xs text-gray-300">{circleMembersCount} members</Text>
                  </View>
                ) : null}
                <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1.5">
                  <Text className="text-xs text-gray-300">{circleRoleLabel}</Text>
                </View>
              </View>
            ) : null}
          </View>
          <View className="h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10">
            <Ionicons name={isCircleAccount ? 'people-outline' : 'swap-horizontal'} size={20} color="#f4b000" />
          </View>
        </View>
      </View>

      <View className="mt-8 gap-7">
        {isCircleAccount ? (
          <>
            <View className="rounded-[24px] border border-amber-500/20 bg-gray-900/70 px-4 py-4 shadow-lg">
              <Text className="text-white text-lg font-semibold">Unavailable in circle mode</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Send, receive, funding, and other Bridge wallet actions stay in personal or business context. Use the account switcher to change accounts.
              </Text>
            </View>
          </>
        ) : (
          <>
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

        {FEATURE_REWARDS && isPersonalAccount ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/rewards')}
            className="rounded-[24px] border border-gray-800 bg-gray-900/70 px-4 py-4 shadow-lg"
          >
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <View className="h-2 w-2 rounded-full bg-amber-400/80" />
                  <Text className="text-sm font-semibold text-white">Rewards</Text>
                </View>
                <Text className="mt-3 text-[28px] font-semibold text-white">
                  {moneyFormat(rewardsTotal)}
                </Text>
                <Text className="mt-2 text-xs leading-5 text-slate-400">
                  {rewardsDescription}
                </Text>
              </View>
              <View className="items-end pt-0.5">
                <View className="rounded-full bg-white/[0.05] px-3 py-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[11px] font-semibold text-slate-200">View</Text>
                    <Feather name="arrow-right" size={13} color="#CBD5E1" />
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

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
          </>
        )}
      </View>
    </ScreenContainer>
  )
}
