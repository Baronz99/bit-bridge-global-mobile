import React, { useMemo } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { getRewards } from '@/api/rewards'
import useFetch from '@/services/useFetch'
import { FEATURE_REWARDS } from '@/constants/featureFlags'
import moneyFormat from '@/utils/moneyFormat'
import { dateFormat } from '@/utils/dateFormat'
import { Ionicons } from '@expo/vector-icons'

const RECENT_REWARDS_LIMIT = 10

const RewardsScreen = () => {
  const { data, loading, error, refetch } = useFetch(() => getRewards())

  const summary = useMemo(() => {
    if (data?.data && !Array.isArray(data?.data)) return data.data
    if (data?.summary && !Array.isArray(data?.summary)) return data.summary
    return null
  }, [data])

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

  const rewardsTotal = useMemo(() => {
    return rewards.reduce((sum: number, reward: any) => {
      const amount = Number(reward?.amount ?? 0)
      return sum + (Number.isNaN(amount) ? 0 : amount)
    }, 0)
  }, [rewards])
  const totalEarned = Number(summary?.total_earned ?? rewardsTotal ?? 0)
  const level = summary?.level || 1
  const nextGoal = Number(summary?.next_goal || 500)
  const progress = Math.min(totalEarned / Math.max(nextGoal, 1), 1)
  const streakDays = Number(summary?.streak_days || 0)
  const todayEarned = Number(summary?.today_earned || 0)
  const weekEarned = Number(summary?.week_earned || 0)
  const monthEarned = Number(summary?.month_earned || 0)

  const streakLabel = useMemo(() => {
    if (!streakDays) return 'No streak yet'
    return `${streakDays} day streak`
  }, [streakDays])

  const badges = useMemo(
    () => [
      {
        id: 'badge-first',
        title: 'First top-up',
        subtitle: 'Complete your first VTU/Data purchase.',
        earned: (summary?.reward_count || rewards.length) > 0,
      },
      {
        id: 'badge-streak',
        title: 'Weekly grinder',
        subtitle: 'Maintain a 3-day reward streak.',
        earned: streakDays >= 3,
      },
      {
        id: 'badge-boost',
        title: 'Reward booster',
        subtitle: 'Earn at least NGN 1,000 in rewards.',
        earned: totalEarned >= 1000,
      },
    ],
    [rewards.length, streakDays, summary?.reward_count, totalEarned]
  )

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
            Ever wondered how you&apos;re doing in life? Here you will see all your rewards.
          </Text>
          <Text className="text-gray-400 text-xs mt-2">
            Every airtime or data purchase earns you 1% instantly. Track your progress, streaks,
            and reward activity below.
          </Text>

          <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-950 p-4 items-center">
            <Text className="text-gray-400 text-[10px] uppercase tracking-[0.25em]">Total rewards</Text>
            <Text className="text-white text-2xl font-semibold mt-2">{moneyFormat(totalEarned)}</Text>
            <View className="flex-row items-center gap-2 mt-3">
              <Ionicons name="trophy-outline" size={14} color="#f4b000" />
              <Text className="text-[10px] uppercase tracking-[0.2em] text-gray-300">
                Level {level}
              </Text>
            </View>
            <View className="w-full h-2 rounded-full bg-gray-800 mt-3 overflow-hidden">
              <View style={{ width: `${Math.round(progress * 100)}%` }} className="h-full bg-app-primary" />
            </View>
            <Text className="text-gray-400 text-[10px] mt-2">
              Next goal: {moneyFormat(nextGoal)}
            </Text>
          </View>
        </View>

        <View className="mt-5 gap-3">
          <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-full items-center justify-center bg-amber-500/15 border border-amber-500/30">
                <Ionicons name="flash-outline" size={18} color="#fbbf24" />
              </View>
              <View>
                <Text className="text-white text-sm font-semibold">Today&apos;s reward</Text>
                <Text className="text-gray-400 text-xs">{moneyFormat(todayEarned)}</Text>
              </View>
            </View>
          </View>
          <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-full items-center justify-center bg-cyan-500/15 border border-cyan-500/30">
                <Ionicons name="gift-outline" size={18} color="#22d3ee" />
              </View>
              <View>
                <Text className="text-white text-sm font-semibold">This week</Text>
                <Text className="text-gray-400 text-xs">{moneyFormat(weekEarned)}</Text>
              </View>
            </View>
          </View>
          <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-full items-center justify-center bg-orange-500/15 border border-orange-500/30">
                <Ionicons name="flame-outline" size={18} color="#fb923c" />
              </View>
              <View>
                <Text className="text-white text-sm font-semibold">Streak</Text>
                <Text className="text-gray-400 text-xs">{streakLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 pr-3">
              <Text className="text-white text-base font-semibold">Achievements</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Complete milestones to unlock reward boosts.
              </Text>
            </View>
            <Text className="text-[10px] uppercase tracking-[0.2em] text-gray-400 text-right">
              Gamified progress
            </Text>
          </View>
          <View className="mt-4 gap-3">
            {badges.map((badge) => (
              <View
                key={badge.id}
                className={`rounded-2xl border px-4 py-4 ${
                  badge.earned ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-gray-800 bg-gray-950/40'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-sm font-semibold">{badge.title}</Text>
                  <View className="px-2 py-1 rounded-full border border-gray-800 bg-gray-950">
                    <Text className="text-[9px] uppercase tracking-[0.2em] text-gray-300">
                      {badge.earned ? 'Unlocked' : 'Locked'}
                    </Text>
                  </View>
                </View>
                <Text className="text-gray-400 text-xs mt-2">{badge.subtitle}</Text>
              </View>
            ))}
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
              <Text className="text-white text-base font-semibold">Rewards activity</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Every successful airtime/data purchase adds 1% instantly.
              </Text>
            </View>
            <Text className="text-gray-400 text-xs text-right">
              Latest {RECENT_REWARDS_LIMIT}
              {'\n'}
              Month total: {moneyFormat(monthEarned)}
            </Text>
          </View>

          <View className="gap-3">
          {recentRewards.length === 0 && !loading ? (
            <View className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <Text className="text-gray-300 text-center">No rewards yet.</Text>
            </View>
          ) : null}

          {recentRewards.map((reward: any, index: number) => {
            const status = String(reward?.status || '').toLowerCase()
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
            const statusTone =
              status === 'completed'
                ? 'text-green-400'
                : status === 'pending'
                  ? 'text-yellow-400'
                  : 'text-gray-400'
            return (
              <View key={reward?.id ?? index} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-3">
                    <Text className="text-white font-semibold" numberOfLines={2}>
                      {reward?.title || 'Reward'}
                    </Text>
                    {rewardDate ? (
                      <Text className="text-gray-500 text-xs mt-1">
                        {rewardDate}
                      </Text>
                    ) : null}
                  </View>
                  <View className="items-end">
                    <Text className="text-white font-semibold">
                      {moneyFormat(Number(reward?.amount ?? 0))}
                    </Text>
                    {status ? <Text className={`text-xs mt-1 ${statusTone}`}>{status}</Text> : null}
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
