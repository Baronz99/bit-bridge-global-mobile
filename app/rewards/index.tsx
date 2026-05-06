import React, { useMemo } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { getRewards } from '@/api/rewards'
import useFetch from '@/services/useFetch'
import { FEATURE_REWARDS } from '@/constants/featureFlags'
import moneyFormat from '@/utils/moneyFormat'
import { dateFormat } from '@/utils/dateFormat'

const RECENT_REWARDS_LIMIT = 10

const bridgePointsStatusCopy: Record<string, { label: string; detail: string }> = {
  accruing: {
    label: 'Accruing this month',
    detail: 'Eligible personal transfers are building toward your next wallet payout.',
  },
  paid: {
    label: 'Paid this cycle',
    detail: 'This month has already been settled to your NGN wallet.',
  },
  recently_paid: {
    label: 'Recently paid',
    detail: 'Your latest Bridge Points cycle has been paid to your NGN wallet.',
  },
  idle: {
    label: 'No points yet',
    detail: 'Make an eligible personal transfer to start earning Bridge Points.',
  },
}

const RewardsScreen = () => {
  const { data, loading, error, refetch } = useFetch(() => getRewards())

  const summary = useMemo(() => {
    if (data?.data && !Array.isArray(data?.data)) return data.data
    if (data?.summary && !Array.isArray(data?.summary)) return data.summary
    return null
  }, [data])

  const billRewards = useMemo(() => {
    if (data?.bill_rewards && !Array.isArray(data?.bill_rewards)) return data.bill_rewards
    return summary
  }, [data, summary])

  const bridgePoints = useMemo(() => {
    if (data?.bridge_points && !Array.isArray(data?.bridge_points)) return data.bridge_points
    if (data?.data?.bridge_points && !Array.isArray(data?.data?.bridge_points)) return data.data.bridge_points
    if (summary?.bridge_points && !Array.isArray(summary?.bridge_points)) return summary.bridge_points
    return null
  }, [data, summary])

  const rewards = useMemo(() => {
    if (Array.isArray(data?.rewards)) return data.rewards
    if (Array.isArray(data?.data?.rewards)) return data.data.rewards
    return []
  }, [data])

  const recentRewards = useMemo(() => {
    const keyFor = (reward: any, index: number) =>
      String(
        reward?.id ??
          reward?.reference ??
          reward?.transaction_id ??
          reward?.earned_at ??
          reward?.created_at ??
          reward?.createdAt ??
          `${reward?.title ?? 'reward'}-${reward?.amount ?? 0}-${index}`
      )

    const toTimestamp = (value: any) => {
      if (value === null || value === undefined) return -1
      if (typeof value === 'number') {
        const ms = value > 1_000_000_000_000 ? value : value > 1_000_000_000 ? value * 1000 : value
        return Number.isFinite(ms) ? ms : -1
      }
      const raw = String(value).trim()
      if (!raw) return -1
      const asNum = Number(raw)
      if (!Number.isNaN(asNum)) {
        const ms = asNum > 1_000_000_000_000 ? asNum : asNum > 1_000_000_000 ? asNum * 1000 : asNum
        return Number.isFinite(ms) ? ms : -1
      }
      const parsed = new Date(raw).getTime()
      return Number.isNaN(parsed) ? -1 : parsed
    }

    const seen = new Set<string>()
    const normalized = rewards.filter((reward: any, index: number) => {
      const key = keyFor(reward, index)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    normalized.sort((a: any, b: any) => {
      const aTs = toTimestamp(a?.earned_at ?? a?.created_at ?? a?.createdAt ?? a?.occurred_at)
      const bTs = toTimestamp(b?.earned_at ?? b?.created_at ?? b?.createdAt ?? b?.occurred_at)
      return bTs - aTs
    })

    return normalized.slice(0, RECENT_REWARDS_LIMIT)
  }, [rewards])

  const billRewardsTotal = Number(billRewards?.total_earned ?? 0)
  const billRewardsAvailable = Number(billRewards?.available_balance ?? 0)
  const billRewardCount = Number(billRewards?.reward_count ?? rewards.length ?? 0)
  const bridgePointsCount = Number(
    bridgePoints?.current_month_points ?? bridgePoints?.current_points ?? bridgePoints?.points_this_month ?? 0
  )
  const bridgePointsEstimate = Number(
    bridgePoints?.naira_estimate ?? bridgePoints?.estimated_value ?? bridgePoints?.current_month_value ?? 0
  )
  const payoutHistory = Array.isArray(bridgePoints?.payout_history) ? bridgePoints.payout_history : []
  const nextPayoutDate = dateFormat(bridgePoints?.next_payout_date, '')
  const bridgePointsStatus = String(bridgePoints?.payout_status ?? 'idle')
  const bridgePointsStatusCard = bridgePointsStatusCopy[bridgePointsStatus] ?? bridgePointsStatusCopy.idle
  const settlementMessage =
    bridgePoints?.settlement_message ?? 'Eligible Bridge Points pay out to your NGN wallet after the monthly payout cycle.'
  const lastPayout = bridgePoints?.last_payout && !Array.isArray(bridgePoints?.last_payout) ? bridgePoints.last_payout : null
  const lastPayoutDate = dateFormat(lastPayout?.paid_at, '')
  const lastPayoutMonth = dateFormat(lastPayout?.program_month, '')

  if (!FEATURE_REWARDS) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Rewards</Text>
        <Text className="text-gray-400">Rewards are currently disabled.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-gray-400 text-[10px] uppercase tracking-[0.3em]">Rewards hub</Text>
          <Text className="text-white text-2xl font-semibold mt-2">
            Track your bill rewards and Bridge Points in one place.
          </Text>
          <Text className="text-gray-400 text-xs mt-2">
            Bill Rewards stay available for airtime and data purchases. Bridge Points come from eligible bank transfers and pay out to your wallet monthly.
          </Text>
        </View>

        <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 pr-3">
              <Text className="text-white text-base font-semibold">Bill Rewards</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Spendable only on eligible airtime and data purchases.
              </Text>
            </View>
            <View className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5">
              <Text className="text-[10px] uppercase tracking-[0.2em] text-emerald-100">
                {billRewardCount} earned
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 p-4">
              <Text className="text-gray-400 text-[10px] uppercase tracking-[0.2em]">Available</Text>
              <Text className="mt-2 text-white text-xl font-semibold">{moneyFormat(billRewardsAvailable)}</Text>
            </View>
            <View className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 p-4">
              <Text className="text-gray-400 text-[10px] uppercase tracking-[0.2em]">Lifetime earned</Text>
              <Text className="mt-2 text-white text-xl font-semibold">{moneyFormat(billRewardsTotal)}</Text>
            </View>
          </View>
        </View>

        <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 pr-3">
              <Text className="text-white text-base font-semibold">Bridge Points</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Earn 1 point for each successful eligible personal bank transfer.
              </Text>
            </View>
            <View className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5">
              <Text className="text-[10px] uppercase tracking-[0.2em] text-amber-100">
                {bridgePointsStatusCard.label}
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 p-4">
              <Text className="text-gray-400 text-[10px] uppercase tracking-[0.2em]">Current month points</Text>
              <Text className="mt-2 text-white text-xl font-semibold">{bridgePointsCount}</Text>
            </View>
            <View className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 p-4">
              <Text className="text-gray-400 text-[10px] uppercase tracking-[0.2em]">Estimated value</Text>
              <Text className="mt-2 text-white text-xl font-semibold">{moneyFormat(bridgePointsEstimate)}</Text>
            </View>
          </View>

          <View className="mt-3 rounded-2xl border border-gray-800 bg-gray-950 p-4">
            <Text className="text-gray-400 text-[10px] uppercase tracking-[0.2em]">Payout status</Text>
            <Text className="mt-2 text-white text-sm font-semibold">{bridgePointsStatusCard.label}</Text>
            <Text className="mt-2 text-gray-500 text-xs">{bridgePointsStatusCard.detail}</Text>
          </View>

          <View className="mt-3 rounded-2xl border border-gray-800 bg-gray-950 p-4">
            <Text className="text-gray-400 text-[10px] uppercase tracking-[0.2em]">Next payout date</Text>
            <Text className="mt-2 text-white text-sm font-semibold">{nextPayoutDate || 'At month end'}</Text>
            <Text className="mt-2 text-gray-500 text-xs">{settlementMessage}</Text>
          </View>

          <View className="mt-3 rounded-2xl border border-gray-800 bg-gray-950 p-4">
            <Text className="text-gray-400 text-[10px] uppercase tracking-[0.2em]">Last payout</Text>
            {lastPayout ? (
              <>
                <Text className="mt-2 text-white text-sm font-semibold">
                  {moneyFormat(Number(lastPayout?.naira_value ?? 0))}
                </Text>
                <Text className="mt-2 text-gray-400 text-xs">
                  {Number(lastPayout?.total_points ?? 0)} points{lastPayoutMonth ? ` • Reward month ${lastPayoutMonth}` : ''}
                </Text>
                {lastPayoutDate ? <Text className="mt-1 text-gray-500 text-xs">{lastPayoutDate}</Text> : null}
              </>
            ) : (
              <Text className="mt-2 text-gray-500 text-xs">Your first Bridge Points payout will appear here after settlement.</Text>
            )}
          </View>
        </View>

        {loading ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? (
          <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
            <Text className="text-white font-semibold">Error</Text>
            <Text className="text-white/80">{error?.message || 'Failed to load rewards'}</Text>
            <TouchableOpacity onPress={refetch} className="mt-3 bg-red-600 py-2 rounded-lg">
              <Text className="text-white text-center">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
          <View className="flex-row items-start justify-between gap-3 mb-4">
            <View className="flex-1 pr-3">
              <Text className="text-white text-base font-semibold">Bill Rewards activity</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Every successful airtime and data purchase adds 1% instantly.
              </Text>
            </View>
            <Text className="text-gray-400 text-xs text-right">
              Latest {RECENT_REWARDS_LIMIT}
            </Text>
          </View>

          <View className="gap-3">
            {recentRewards.length === 0 && !loading ? (
              <View className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <Text className="text-gray-300 text-center">No bill rewards yet.</Text>
              </View>
            ) : null}

            {recentRewards.map((reward: any, index: number) => {
              const rewardDate = dateFormat(
                reward?.earned_at ??
                  reward?.created_at ??
                  reward?.createdAt ??
                  reward?.occurred_at ??
                  reward?.date ??
                  reward?.timestamp ??
                  reward?.updated_at ??
                  reward?.updatedAt,
                ''
              )
              return (
                <View key={reward?.id ?? index} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-3">
                      <Text className="text-white font-semibold" numberOfLines={2}>
                        {reward?.source_label || reward?.service_type || 'Reward earned'}
                      </Text>
                      {rewardDate ? (
                        <Text className="text-gray-500 text-xs mt-1">{rewardDate}</Text>
                      ) : null}
                    </View>
                    <View className="items-end">
                      <Text className="text-white font-semibold">{moneyFormat(Number(reward?.amount ?? 0))}</Text>
                      {reward?.status ? <Text className="text-xs mt-1 text-gray-400">{String(reward.status)}</Text> : null}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
          <View className="flex-row items-start justify-between gap-3 mb-4">
            <View className="flex-1 pr-3">
              <Text className="text-white text-base font-semibold">Bridge Points payout history</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Monthly wallet credits from earned Bridge Points.
              </Text>
            </View>
          </View>

          <View className="gap-3">
            {payoutHistory.length === 0 && !loading ? (
              <View className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <Text className="text-gray-300 text-center">No Bridge Points payouts yet.</Text>
              </View>
            ) : null}

            {payoutHistory.map((payout: any, index: number) => {
              const paidAt = dateFormat(payout?.paid_at, '')
              const programMonth = dateFormat(payout?.program_month, '')
              return (
                <View key={payout?.id ?? index} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <View className="flex-row justify-between items-start gap-3">
                    <View className="flex-1 pr-3">
                      <Text className="text-white font-semibold">Bridge Points Reward</Text>
                      <Text className="text-gray-500 text-xs mt-1">
                        {programMonth ? `Reward month: ${programMonth}` : 'Monthly payout'}
                      </Text>
                      {paidAt ? <Text className="text-gray-500 text-xs mt-1">{paidAt}</Text> : null}
                    </View>
                    <View className="items-end">
                      <Text className="text-white font-semibold">{moneyFormat(Number(payout?.naira_value ?? 0))}</Text>
                      <Text className="text-xs mt-1 text-gray-400">{Number(payout?.total_points ?? 0)} points</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default RewardsScreen
