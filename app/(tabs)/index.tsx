// app/(tabs)/index.tsx — FULL REPLACEMENT (Recent Activity = Timeline + Currency-aware)
// ✅ Home “Recent Activity” uses /timeline (bank-grade cards)
// ✅ View all routes to /(tabs)/timeline
// ✅ Keeps your existing Home features working (profile, onboarding banner, quick services, orders, repurchase modal, etc.)
// ✅ Currency-aware amounts: Virtual Card / USD renders as $; NGN renders as ₦ via moneyFormat()

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Constants from 'expo-constants'
import { Link, Redirect, useRouter } from 'expo-router'
import { AntDesign, Feather } from '@expo/vector-icons'

import { getUserOrders } from '@/api/orders'
import { getRescentPurchaseOrder, repurchaseOrder } from '@/api/billOrder'
import { getTransactions } from '@/api/transactions'
import { listTimeline } from '@/api/timeline'

import { icons } from '@/constants/icons'
import { images } from '@/constants/images'

import { useAuth } from '@/services/useAuth'
import useFetch from '@/services/useFetch'

import moneyFormat from '@/utils/moneyFormat'

import AppModal from '@/components/modal/Modal'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import ScreenContainer from '@/components/ScreenContainer'
import ViewBox from '@/components/view-box/ViewBoxIcon'

// ---------------------------
// Timeline helpers (Home-only) ✅
// ---------------------------
type TimelineItem = Record<string, any>

type TimelineRoot = {
  items?: unknown
  data?: unknown
  timeline?: unknown
  results?: unknown
  next_cursor?: string | null
  cursor?: string | null
}

const extractTimeline = (payload: unknown): TimelineItem[] => {
  const container = (payload ?? {}) as TimelineRoot & Record<string, any>
  const list =
    container?.items ??
    container?.data ??
    container?.timeline ??
    container?.results ??
    container
  return Array.isArray(list) ? list : []
}

const getTimelineText = (t: TimelineItem) => {
  // Backend appears to have: kind, label, meta.description
  const label = t?.label
  const desc =
    t?.meta?.description ??
    t?.description ??
    t?.narration ??
    t?.title ??
    t?.summary ??
    t?.message ??
    t?.note ??
    ''
  const type = t?.type ?? t?.kind ?? t?.meta?.transaction_type ?? t?.transaction_type ?? ''
  const status = t?.status ?? t?.state ?? ''

  const s1 = String(label || '').trim()
  if (s1) return s1

  const s2 = String(desc || '').trim()
  if (s2) return s2

  return String(type || status || 'Activity').replace(/_/g, ' ')
}

const getTimelineKind = (t: TimelineItem) => {
  return String(
    t?.kind ??
      t?.type ??
      t?.meta?.transaction_type ??
      t?.transaction_type ??
      t?.event_type ??
      t?.category ??
      t?.source ??
      ''
  ).toLowerCase()
}

const getTimelineStatus = (t: TimelineItem) => {
  return String(t?.status ?? t?.state ?? t?.payment_status ?? '').toLowerCase()
}

const getTimelineCurrency = (t: TimelineItem) => {
  const direct = String(t?.meta?.currency ?? t?.currency ?? '').toUpperCase()
  if (direct) return direct

  // Fallback inference (safe):
  const label = String(t?.label ?? '').toLowerCase()
  const walletType = String(t?.meta?.wallet_type ?? '').toLowerCase()
  const bank = String(t?.meta?.bank ?? '').toLowerCase()

  if (walletType.includes('virtual') || label.includes('virtual card') || bank.includes('virtual card')) {
    return 'USD'
  }

  return 'NGN'
}

const minorUnitDivisor = (currency: string) => {
  const cur = (currency || '').toUpperCase()
  if (cur === 'JPY') return 1
  return 100 // NGN, USD
}

const getTimelineAmount = (t: TimelineItem): number => {
  const currency = getTimelineCurrency(t)

  // Prefer amount_cents from backend (your logs show amount_cents)
  const cents = Number(t?.amount_cents)
  if (Number.isFinite(cents)) return cents / minorUnitDivisor(currency)

  // Fallbacks
  const raw =
    t?.amount ??
    t?.total_amount ??
    t?.value ??
    t?.meta?.amount ??
    t?.metadata?.amount ??
    t?.data?.amount

  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

const getTimelineTimestamp = (t: TimelineItem): number => {
  // Backend shows occurred_at
  const dt =
    t?.occurred_at ??
    t?.created_at ??
    t?.createdAt ??
    t?.timestamp ??
    t?.time ??
    t?.date ??
    t?.updated_at

  const ms = Date.parse(String(dt || ''))
  return Number.isFinite(ms) ? ms : 0
}

const formatTime = (ms: number) => {
  if (!ms) return ''
  const d = new Date(ms)
  const day = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-GB', { month: 'short' })
  const hr = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${mon}, ${hr}:${min}`
}

const formatMoneyByCurrency = (amount: number, currency: string) => {
  const cur = (currency || 'NGN').toUpperCase()

  if (cur === 'USD') {
    // “Bank-grade” formatting
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  // Default to existing NGN formatter
  return moneyFormat(amount)
}

const isMoneyKind = (kind: string) => {
  const k = (kind || '').toLowerCase()
  return (
    k.includes('wallet') ||
    k.includes('transaction') ||
    k.includes('deposit') ||
    k.includes('withdraw') ||
    k.includes('transfer') ||
    k.includes('bill') ||
    k.includes('airtime') ||
    k.includes('data') ||
    k.includes('cable') ||
    k.includes('electric') ||
    k.includes('fund') ||
    k.includes('payment') ||
    k.includes('purchase') ||
    k.includes('charge') ||
    k.includes('refund') ||
    k.includes('payout')
  )
}

const pickActivityIcon = (kind: string) => {
  const k = (kind || '').toLowerCase()
  if (k.includes('deposit') || k.includes('fund')) return icons.walletColor
  if (k.includes('withdraw')) return icons.withdraw
  if (k.includes('transfer') || k.includes('send')) return icons.transfer
  if (k.includes('airtime') || k.includes('mobile')) return icons.call
  if (k.includes('data')) return icons.data
  if (k.includes('cable') || k.includes('tv')) return icons.tv
  if (k.includes('electric') || k.includes('power')) return icons.power
  return icons.tag
}

const pillForStatus = (status: string) => {
  const s = (status || '').toLowerCase()

  if (s.includes('success') || s.includes('approved') || s.includes('completed')) {
    return { label: 'Success', cls: 'bg-emerald-500/15 border-emerald-500/30' }
  }
  if (s.includes('failed') || s.includes('rejected') || s.includes('error')) {
    return { label: 'Failed', cls: 'bg-red-500/15 border-red-500/30' }
  }
  if (s.includes('pending') || s.includes('processing') || s.includes('initialized')) {
    return { label: 'Pending', cls: 'bg-amber-500/15 border-amber-500/30' }
  }

  return { label: status ? String(status) : 'Update', cls: 'bg-gray-700/30 border-gray-700' }
}

export default function Index() {
  const { authState, userProfileData, loadProfile } = useAuth()
  const router = useRouter()
  const token = authState?.token // string | null

  const [billOrder, setBillOrder] = useState<any | null>(null)
  const [openModal, setOpenModal] = useState(false)

  const { notification, setNotification } = useNotification()
  const [toggleAlert, setToggleAlert] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const [getstarted, setOpenStarted] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [loader, setLoader] = useState(false)

  // ✅ Recent activity toggle (money vs all)
  const [activityMode, setActivityMode] = useState<'money' | 'all'>('money')

  useEffect(() => {
    console.log('Runtime Versions:', Constants.manifest2?.runtimeVersion)
  }, [])

  useEffect(() => {
    loadProfile().catch(() => {})
  }, [loadProfile])

  if (!token) return <Redirect href={'/login' as any} />

  // -------- Fetches (keep existing behavior) --------
  const fetchRecentPurchases = useCallback(() => getRescentPurchaseOrder(), [])
  const fetchRecentOrders = useCallback(() => getUserOrders(), [])

  // Old deposits-only transactions (kept, but no longer the main “Recent Activity”)
  const fetchRecentTransactions = useCallback(() => {
    return getTransactions({ params: { transaction_type: 'deposit' } })
  }, [])

  // ✅ NEW: Recent Activity from Timeline
  const fetchRecentTimeline = useCallback(() => {
    // Keep it small but enough to filter properly
    return listTimeline({ limit: 25 })
  }, [])

  const {
    data: recentPurchases,
    loading: recentPurchasesLoading,
    error: recentPurchasesError,
  } = useFetch(fetchRecentPurchases, true)

  const { data: recentOrdersRaw } = useFetch(fetchRecentOrders, true)
  const { data: recentTransactionsRaw } = useFetch(fetchRecentTransactions, true)

  const {
    data: recentTimelineRaw,
    loading: timelineLoading,
    error: timelineError,
  } = useFetch(fetchRecentTimeline, true)

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadProfile({ force: true })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => setRefreshing(false), 700)
      })
  }, [loadProfile])

  // -------- Quick services --------
  const quickItems = useMemo(
    () =>
      [
        { id: 0, label: 'Airtime', link: '/airtime-top-up', image: icons.call },
        { id: 2, label: 'Data', link: '/data-subscription', image: icons.data },
        { id: 1, label: 'Electricity', link: '/electricity-provider', image: icons.power },
        { id: 3, label: 'Cable TV', link: '/cable-tv-provider', image: icons.tv },
      ] as const,
    []
  )

  // -------- KYC state helpers --------
  const kycLevel = useMemo(() => {
    const payload = userProfileData?.data ?? userProfileData
    return String(payload?.kyc_level || payload?.user_kyc?.kyc_level || 'tier_0')
      .trim()
      .toLowerCase()
  }, [userProfileData])

  const tierRank = useMemo(() => {
    if (!kycLevel || kycLevel === 'nil') return 0
    const match = kycLevel.match(/tier[_\s-]?(\d+)/)
    return match ? Number(match[1]) : 0
  }, [kycLevel])

  const hasCardAccess = useMemo(() => {
    const payload = userProfileData?.data ?? userProfileData
    const phoneVerified = payload?.phone_verified === true || payload?.phone_verified_at
    if (!kycLevel && !phoneVerified) return false
    if (kycLevel === 'tier_0' || kycLevel === 'nil') return false
    return true
  }, [userProfileData, kycLevel])

  const KYC_REQUIRED_NOW = ['send_receive', 'virtual_cards', 'taxes']

  const onboardingBanner = useMemo(() => {
    const payload = userProfileData?.data ?? userProfileData
    if (!payload) return null

    const stage = payload?.onboarding_stage || 'email_confirmed'
    const primaryUseCase = String(payload?.primary_use_case || '').trim()
    const profile = payload?.user_profile || {}
    const phoneVerified =
      payload?.phone_verified === true || payload?.phone_verified_at || profile?.phone_verified_at

    const hasBasicProfile = Boolean(
      profile?.first_name || profile?.last_name || profile?.phone_number || profile?.date_of_birth
    )

    const bvnStatus = payload?.user_kyc?.bvn_status
    const bvnVerified = bvnStatus === 'verified'
    const needsTier2 = primaryUseCase && KYC_REQUIRED_NOW.includes(primaryUseCase)

    const isFullyReady =
      primaryUseCase && hasBasicProfile && phoneVerified && (!needsTier2 || bvnVerified)

    if (isFullyReady) return null

    if (!primaryUseCase || stage === 'email_confirmed') {
      return {
        title: 'Personalize your BitBridge account',
        subtitle: 'Pick how you plan to use BitBridge so we can guide your limits and KYC flow.',
        cta: 'Complete setup',
        href: '/onboarding/use-case',
      }
    }

    if (!hasBasicProfile) {
      return {
        title: 'Complete your basic profile',
        subtitle: 'Add your name, phone number, and date of birth to continue verification.',
        cta: 'Complete profile',
        href: '/onboarding/basic-profile',
      }
    }

    if (!phoneVerified) {
      return {
        title: 'Verify your phone number',
        subtitle: 'Confirm your phone number to unlock core wallet actions.',
        cta: 'Verify phone',
        href: '/kyc/otp',
      }
    }

    if (needsTier2 && !bvnVerified) {
      return {
        title: 'Verify your BVN to reach Tier 2',
        subtitle: 'BVN verification unlocks transfers, tunnel wallet, and higher limits.',
        cta: 'Verify BVN',
        href: '/kyc/bvn',
      }
    }

    return {
      title: 'Keep your BitBridge account secure',
      subtitle: 'Continue verification so we can unlock all features for you.',
      cta: 'Continue setup',
      href: '/onboarding',
    }
  }, [userProfileData])

  const recommendedServices = useMemo(() => {
    const utilities = [
      { id: 'airtime', label: 'Airtime', link: '/airtime-top-up', image: icons.call },
      { id: 'data', label: 'Data', link: '/data-subscription', image: icons.data },
      { id: 'electricity', label: 'Electricity', link: '/electricity-provider', image: icons.power },
      { id: 'cable', label: 'Cable TV', link: '/cable-tv-provider', image: icons.tv },
    ]

    const curated: { id: string; label: string; link: string; image: any }[] = []
    if (tierRank >= 2) {
      curated.push({
        id: 'transfer',
        label: 'Bank transfer',
        link: '/bank-transfer',
        image: icons.transfer,
      })
    }
    if (hasCardAccess) {
      curated.push({ id: 'cards', label: 'Virtual cards', link: '/cards', image: icons.wallet })
    }

    for (const item of utilities) {
      if (curated.length >= 3) break
      curated.push(item)
    }

    return curated
  }, [tierRank, hasCardAccess])

  const prevsummary = useMemo(
    () => [
      {
        id: 2,
        label: 'Bought',
        amount: userProfileData?.wallet?.total_bills ?? 0,
        icon: icons.walletColor,
      },
      {
        id: 3,
        label: 'Withdrawals',
        amount: userProfileData?.wallet?.withdrawn ?? 0,
        icon: icons.withdraw,
      },
      { id: 4, label: 'Sold', amount: 0, icon: icons.tag },
    ],
    [userProfileData]
  )

  const handleRepurchase = async (id: string) => {
    try {
      setLoader(true)
      const response = await repurchaseOrder(id)
      setOpenModal(false)
      setToggleAlert(true)
      setNotification({
        error: false,
        message: response?.message ?? 'Success',
        data: response?.data,
      })
    } catch (err: any) {
      setOpenModal(false)
      setToggleAlert(true)
      setNotification({
        error: true,
        message: err?.message || 'Repurchase failed',
        data: null,
      })
    } finally {
      setLoader(false)
    }
  }

  // -------- Data transforms --------
  const recentOrders = useMemo(() => {
    const payload = (recentOrdersRaw as any)?.data ?? recentOrdersRaw
    const list = Array.isArray(payload) ? payload : payload?.orders
    if (!Array.isArray(list)) return []
    return list.slice(0, 3)
  }, [recentOrdersRaw])

  const recentTransactions = useMemo(() => {
    const payload = (recentTransactionsRaw as any)?.data ?? recentTransactionsRaw
    const list = Array.isArray(payload) ? payload : payload?.data
    if (!Array.isArray(list)) return []
    return list.slice(0, 3)
  }, [recentTransactionsRaw])

  const recentActivity = useMemo(() => {
    const list = extractTimeline(recentTimelineRaw)

    const sorted = [...list].sort((a, b) => getTimelineTimestamp(b) - getTimelineTimestamp(a))

    const filtered =
      activityMode === 'money'
        ? sorted.filter((item) => isMoneyKind(getTimelineKind(item)))
        : sorted

    return filtered.slice(0, 3)
  }, [recentTimelineRaw, activityMode])

  const showTopError = recentPurchasesError?.message || timelineError?.message

  const goToTimeline = () => {
    router.push('/(tabs)/timeline' as any)
  }

  return (
    <>
      <ScreenContainer
        topPadding={16}
        scrollProps={{
          refreshControl: (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#f3f3f3', '#1d4ed8', '#f4b000']}
              progressBackgroundColor={'#111827'}
            />
          ),
        }}
      >
        <Image source={images.bg} className="absolute top-0 w-full z-0" />

        <View className="flex-1">
          {/* Header wallet card */}
          <View className="rounded-3xl border border-gray-800 bg-gray-900/80 p-5 overflow-hidden">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-white/70 text-xs tracking-widest uppercase">Bridge Wallet</Text>
                <Text className="text-white text-3xl font-semibold mt-2">
                  {moneyFormat(userProfileData?.wallet?.balance ?? 0)}
                </Text>
                <View className="flex-row mt-3 items-center gap-2">
                  <Image source={icons.trophy} className="w-5 h-5" />
                  <Text className="text-white text-sm">
                    {moneyFormat(userProfileData?.wallet?.commission ?? 0)}
                  </Text>
                </View>
              </View>

              <View className="flex-col items-end gap-2">
                <Link href={'/history' as any} asChild>
                  <TouchableOpacity className="gap-2 items-center rounded-full flex-row py-1 px-3 bg-gray-900/60 border border-gray-800">
                    <Text className="text-white text-xs">History</Text>
                    <Feather name="arrow-right" size={12} color="white" />
                  </TouchableOpacity>
                </Link>

                <Link href={'/fundWallet' as any} asChild>
                  <TouchableOpacity className="bg-app-primary rounded-full py-2 px-3">
                    <Text className="text-white text-xs">Fund Wallet</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>

            <View className="flex-row gap-2 mt-5">
              <TouchableOpacity
                onPress={() => setSendOpen(true)}
                className="bg-gray-900/80 border border-gray-800 rounded-full py-2 px-3 flex-1"
              >
                <Text className="text-white text-center text-xs">Send money</Text>
              </TouchableOpacity>

              <Link href={'/convert-ngn-to-usd' as any} asChild>
                <TouchableOpacity className="bg-gray-900/80 border border-gray-800 rounded-full py-2 px-3 flex-1">
                  <Text className="text-white text-center text-xs">Convert</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View className="mt-3">
              <TouchableOpacity
                onPress={() => setOpenStarted(true)}
                className="bg-gray-900/70 border border-gray-800 py-3 rounded-xl"
              >
                <Text className="text-white text-center">Explore services</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Onboarding banner */}
          {onboardingBanner ? (
            <View className="mt-4 rounded-2xl border border-sky-500/40 bg-sky-900/20 p-4">
              <View className="flex-row gap-3">
                <View className="h-9 w-9 rounded-full bg-sky-500/20 items-center justify-center">
                  <Feather name="alert-circle" size={18} color="#7dd3fc" />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-sm font-semibold">{onboardingBanner.title}</Text>
                  <Text className="text-gray-300 text-xs mt-1">{onboardingBanner.subtitle}</Text>
                </View>
              </View>

              <Link href={onboardingBanner.href as any} asChild>
                <TouchableOpacity className="mt-3 bg-app-primary rounded-full py-2 items-center">
                  <Text className="text-black text-xs font-semibold">{onboardingBanner.cta}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : null}

          {/* Top error */}
          {showTopError ? (
            <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
              <Text className="text-white font-semibold">Network/Error</Text>
              <Text className="text-white/80">{showTopError}</Text>
            </View>
          ) : null}

          {/* Account chip */}
          {userProfileData?.account ? (
            <Link href={'/accountDetails' as any} asChild>
              <TouchableOpacity className="my-4 bg-gray-900 border border-gray-800 py-3 w-52 flex flex-row gap-4 items-center rounded-2xl px-4">
                <Text className="text-white text-lg text-left font-semibold">Moniepoint</Text>
                <AntDesign name="caret-down" size={14} color="gray" />
              </TouchableOpacity>
            </Link>
          ) : null}

          {/* Quick services */}
          <View className="mt-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-white text-lg font-semibold">Quick services</Text>
              <Link href={'/(tabs)/service' as any} asChild>
                <TouchableOpacity>
                  <Text className="text-alt font-medium">Browse all</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View className="mt-3 flex-row flex-wrap -mx-2">
              {quickItems.map((item) => (
                <View key={item.id} className="w-1/2 px-2 py-2">
                  <Link href={item.link as any} asChild>
                    <TouchableOpacity className="bg-gray-900/80 border border-gray-800 rounded-2xl py-4 items-center">
                      <ViewBox icon={item.image} label={item.label} />
                    </TouchableOpacity>
                  </Link>
                </View>
              ))}
            </View>
          </View>

          {/* Summary chips */}
          <View className="my-8">
            <FlatList
              data={prevsummary}
              renderItem={({ item }) => (
                <TouchableOpacity className="bg-gray-900/70 border border-gray-800 p-4 min-w-40 rounded-2xl flex-row items-center gap-3">
                  <Image source={item.icon} className="w-6 h-6" />
                  <View>
                    <Text className="text-base text-white/80 font-semibold">{item.label}</Text>
                    <Text className="text-sm text-gray-400">{moneyFormat(item.amount)}</Text>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => <View className="w-4" />}
            />
          </View>

          {/* Recent Orders */}
          {recentOrders.length ? (
            <View className="mb-8">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white text-lg font-semibold">Recent Orders</Text>
                <Link href={'/orders' as any} asChild>
                  <TouchableOpacity>
                    <Text className="text-alt font-medium">View all</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              <View className="gap-3">
                {recentOrders.map((order: any, index: number) => (
                  <Link
                    key={String(order?.id ?? index)}
                    href={{
                      pathname: '/transaction/confirm',
                      params: { orderId: String(order?.id), source: 'order' },
                    }}
                    asChild
                  >
                    <TouchableOpacity className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4">
                      <View className="flex-row justify-between">
                        <Text className="text-white font-semibold">
                          Order #{order?.id ?? 'Unknown'}
                        </Text>
                        <Text className="text-gray-300">
                          {moneyFormat(Number(order?.total_amount ?? order?.amount ?? 0))}
                        </Text>
                      </View>
                      <Text className="text-gray-400 text-xs mt-1">
                        {order?.status || 'pending'}
                      </Text>
                    </TouchableOpacity>
                  </Link>
                ))}
              </View>
            </View>
          ) : null}

          {/* ✅ Recent Activity (timeline) */}
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-lg font-semibold">Recent Activity</Text>

              <TouchableOpacity onPress={goToTimeline}>
                <Text className="text-alt font-medium">View all</Text>
              </TouchableOpacity>
            </View>

            {/* Toggle */}
            <View className="flex-row gap-2 mb-3">
              <TouchableOpacity
                onPress={() => setActivityMode('money')}
                className={
                  activityMode === 'money'
                    ? 'px-3 py-2 rounded-full border bg-app-primary border-app-primary'
                    : 'px-3 py-2 rounded-full border bg-gray-900/60 border-gray-800'
                }
              >
                <Text
                  className={
                    activityMode === 'money'
                      ? 'text-black text-xs font-semibold'
                      : 'text-white text-xs font-semibold'
                  }
                >
                  Money
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActivityMode('all')}
                className={
                  activityMode === 'all'
                    ? 'px-3 py-2 rounded-full border bg-app-primary border-app-primary'
                    : 'px-3 py-2 rounded-full border bg-gray-900/60 border-gray-800'
                }
              >
                <Text
                  className={
                    activityMode === 'all'
                      ? 'text-black text-xs font-semibold'
                      : 'text-white text-xs font-semibold'
                  }
                >
                  All
                </Text>
              </TouchableOpacity>
            </View>

            {timelineLoading ? (
              <View className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4">
                <ActivityIndicator />
              </View>
            ) : recentActivity.length ? (
              <View className="gap-3">
                {recentActivity.map((item: any, index: number) => {
                  const kind = getTimelineKind(item)
                  const text = getTimelineText(item)
                  const status = getTimelineStatus(item)
                  const pill = pillForStatus(status)
                  const icon = pickActivityIcon(kind)
                  const id = item?.id ?? item?.uuid ?? index

                  const currency = getTimelineCurrency(item)
                  const amount = getTimelineAmount(item)
                  const ts = getTimelineTimestamp(item)

                  return (
                    <TouchableOpacity
                      key={String(id)}
                      onPress={() => {
                        if (item?.id != null) {
                          router.push({
                            pathname: '/timeline/[id]' as any,
                            params: { id: String(item.id) },
                          })
                        } else {
                          goToTimeline()
                        }
                      }}
                      className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4"
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="flex-row items-start gap-3 flex-1 pr-3">
                          <View className="h-10 w-10 rounded-full bg-gray-950/40 border border-gray-800 items-center justify-center">
                            <Image source={icon} className="w-5 h-5" />
                          </View>

                          <View className="flex-1">
                            <Text className="text-white font-semibold" numberOfLines={1}>
                              {text}
                            </Text>

                            <View className="flex-row items-center gap-2 mt-1">
                              <View className={`px-2 py-1 rounded-full border ${pill.cls}`}>
                                <Text className="text-xs font-semibold text-white/90">
                                  {pill.label}
                                </Text>
                              </View>
                              <Text className="text-gray-400 text-xs">{formatTime(ts)}</Text>
                            </View>
                          </View>
                        </View>

                        <Text className="text-white font-semibold">
                          {formatMoneyByCurrency(amount, currency)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : (
              <View className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4">
                <Text className="text-gray-300 text-sm font-semibold">No recent activity yet.</Text>
                <Text className="text-gray-400 text-xs mt-1">
                  Your latest transactions and events will appear here.
                </Text>
              </View>
            )}

            {/* Optional fallback: if timeline empty but old deposit list exists */}
            {!recentActivity.length && recentTransactions.length ? (
              <View className="mt-3 gap-3">
                {recentTransactions.map((tx: any, index: number) => (
                  <TouchableOpacity
                    key={String(tx?.id ?? index)}
                    className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4"
                  >
                    <View className="flex-row justify-between">
                      <Text className="text-white font-semibold">
                        {tx?.transaction_type || 'deposit'}
                      </Text>
                      <Text className="text-gray-300">
                        {moneyFormat(Number(tx?.amount ?? 0))}
                      </Text>
                    </View>
                    <Text className="text-gray-400 text-xs mt-1">{tx?.status || 'pending'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          {/* Existing horizontal “recent purchases” list (kept) */}
          <View>
            {recentPurchasesLoading ? (
              <ActivityIndicator />
            ) : (
              <FlatList
                data={(recentPurchases as any) || []}
                renderItem={({ item }: any) => (
                  <TouchableOpacity
                    onPress={() => {
                      setOpenModal(true)
                      setBillOrder(item)
                    }}
                    className="bg-alt/80 border rounded-2xl text-sm h-16 w-40 shadow-sm flex flex-col justify-center items-center"
                  >
                    <Text className="font-semibold">{item?.biller}</Text>
                    <Text className="text-primary font-medium text-xl">
                      {moneyFormat(item?.amount ?? 0)}
                    </Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item: any, index) => String(item?.id ?? index)}
                horizontal
                shouldRasterizeIOS={false}
                ItemSeparatorComponent={() => <View className="w-4" />}
              />
            )}
          </View>
        </View>
      </ScreenContainer>

      {/* Repurchase confirm modal */}
      <AppModal onclose={() => setOpenModal(false)} open={openModal}>
        <View className="bg-black/70 justify-center items-center px-6">
          <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
            <Text className="text-white text-xl font-semibold text-center mb-4">
              Confirm Transaction
            </Text>
            <Text className="text-gray-300 text-center mb-6">
              Are you sure you want to proceed with this transaction?
            </Text>

            <View>
              <Text className="text-white font-semibold text-center text-lg">
                {billOrder?.biller}
              </Text>
              <LabelText label="Description" value={`subscription ${billOrder?.service_type ?? ''}`} />
              <LabelText label="Recipient" value={billOrder?.meter_number ?? ''} />
              <Text className="text-3xl text-white text-center my-2">
                {moneyFormat(billOrder?.amount ?? 0)}
              </Text>
            </View>

            <View className="flex-row gap-4 justify-between">
              <TouchableOpacity
                onPress={() => setOpenModal(false)}
                className="flex-1 bg-gray-700 py-3 rounded-xl items-center"
              >
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleRepurchase(String(billOrder?.id))}
                className="flex-1 bg-green-600 py-3 rounded-xl items-center"
              >
                <Text className="text-white font-medium">Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AppModal>

      {/* Notification modal */}
      <AppModal open={toggleAlert} onclose={() => setToggleAlert(false)}>
        <NotificationAlert
          onPress={() => setToggleAlert(false)}
          message={notification?.message}
          error={notification.error}
          data={notification.data}
        />
      </AppModal>

      {/* Explore services modal */}
      <AppModal open={getstarted} onclose={() => setOpenStarted(false)}>
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
          <Text className="text-white text-xl font-semibold text-center mb-2">
            Explore services
          </Text>
          <Text className="text-gray-300 text-center mb-5">Recommended for you</Text>

          <View className="flex-row flex-wrap -mx-2">
            {recommendedServices.map((item) => (
              <View key={item.id} className="w-1/3 px-2">
                <TouchableOpacity
                  onPress={() => {
                    setOpenStarted(false)
                    router.push(item.link as any)
                  }}
                  className="bg-gray-900/80 border border-gray-800 rounded-2xl py-3 items-center"
                >
                  <ViewBox icon={item.image} label={item.label} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => {
              setOpenStarted(false)
              router.push('/(tabs)/service' as any)
            }}
            className="bg-app-primary py-3 rounded-xl items-center mt-5"
          >
            <Text className="text-white font-medium">Browse all services</Text>
          </TouchableOpacity>
        </View>
      </AppModal>

      {/* Send money modal */}
      <AppModal open={sendOpen} onclose={() => setSendOpen(false)}>
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
          <Text className="text-white text-xl font-semibold text-center mb-2">Send money</Text>
          <Text className="text-gray-400 text-center text-xs mb-5">
            Choose how you want to send your funds.
          </Text>

          <TouchableOpacity
            onPress={() => {
              setSendOpen(false)
              router.push('/send-money')
            }}
            className="bg-gray-950 border border-gray-800 py-3 rounded-xl items-center"
          >
            <Text className="text-white text-sm font-semibold">Send to BitBridge user</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSendOpen(false)
              router.push('/bank-transfer')
            }}
            className="bg-gray-950 border border-gray-800 py-3 rounded-xl items-center mt-3"
          >
            <Text className="text-white text-sm font-semibold">Bank transfer</Text>
          </TouchableOpacity>
        </View>
      </AppModal>

      <Loader open={loader} />
    </>
  )
}

const LabelText = ({ label, value }: any) => (
  <View className="justify-between flex-row mt-2">
    <Text className="text-white">{label}</Text>
    <Text className="text-white text-center">{value}</Text>
  </View>
)
