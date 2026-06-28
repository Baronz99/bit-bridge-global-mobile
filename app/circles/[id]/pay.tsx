import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCirclePaymentItems, getCircleWorkspace, listCircleCollections } from '@/api/circles'
import {
  CircleShell,
  PaymentCheckout,
  PaymentItemList,
  circleBucketLabel,
  circleTitle,
  normalizePaymentItems,
} from '@/components/circles/rebuild'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { canAccessManageCircle, canViewSharedFundTab } from '@/utils/circleWorkspace'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'
import {
  DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS,
  isCircleScreenCacheFresh,
  readCircleScreenCache,
  writeCircleScreenCache,
} from '@/utils/circleScreenCache'
import { useEffect } from 'react'

type CollectionRecord = Record<string, unknown>
type CirclePayCache = {
  workspace: Record<string, any> | null
  paymentItems: any[]
  collections: CollectionRecord[]
  selectedKey: string
}

const extractCollections = (payload: unknown): CollectionRecord[] => {
  if (Array.isArray(payload)) return payload.filter(Boolean)
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    const list = container.data || container.collections || container.activities || container.items || []
    return Array.isArray(list) ? list.filter(Boolean) : []
  }
  return []
}

const isLiveCollection = (item: CollectionRecord) => {
  const status = String(item?.status || item?.lifecycle_state || '').trim().toLowerCase()
  if (['completed', 'cancelled', 'canceled', 'closed', 'archived', 'inactive', 'draft'].includes(status)) {
    return false
  }

  const activityType = String(item?.activity_type || item?.type || item?.kind || '').trim().toLowerCase()
  if (['goal', 'collection', 'campaign'].includes(activityType)) {
    return true
  }

  return false
}

const CirclePayScreen = () => {
  const { id, paymentItemKey } = useLocalSearchParams<{ id?: string | string[]; paymentItemKey?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const preselectedKey = Array.isArray(paymentItemKey) ? paymentItemKey[0] : paymentItemKey
  const cacheKey = circleId ? `circle-pay:${circleId}:${String(preselectedKey || '')}` : ''
  const cachedPay = circleId ? readCircleScreenCache<CirclePayCache>(cacheKey)?.data ?? null : null
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(() => cachedPay?.workspace ?? null)
  const [paymentItems, setPaymentItems] = useState<any[]>(() => cachedPay?.paymentItems ?? [])
  const [collections, setCollections] = useState<CollectionRecord[]>(() => cachedPay?.collections ?? [])
  const [selectedKey, setSelectedKey] = useState(() => cachedPay?.selectedKey ?? '')
  const [loading, setLoading] = useState(() => !cachedPay)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const applyPayPayload = useCallback((payload: CirclePayCache) => {
    setWorkspace(payload.workspace)
    setPaymentItems(payload.paymentItems)
    setCollections(payload.collections)
    setSelectedKey(payload.selectedKey)
  }, [])

  useEffect(() => {
    const nextCachedPay = circleId ? readCircleScreenCache<CirclePayCache>(cacheKey)?.data ?? null : null
    setWorkspace(nextCachedPay?.workspace ?? null)
    setPaymentItems(nextCachedPay?.paymentItems ?? [])
    setCollections(nextCachedPay?.collections ?? [])
    setSelectedKey(nextCachedPay?.selectedKey ?? '')
    setLoading(!nextCachedPay)
    setRefreshing(false)
    setError('')
  }, [cacheKey, circleId])

  const loadPay = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    const cached = readCircleScreenCache<CirclePayCache>(cacheKey)
    const hasVisibleData = Boolean(workspace || cached?.data.workspace)
    if (isRefresh) setRefreshing(true)
    else if (!hasVisibleData) setLoading(true)
    setError('')
    try {
      if (!isRefresh && cached?.data && isCircleScreenCacheFresh(cacheKey, DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS)) {
        if (!workspace) applyPayPayload(cached.data)
        return
      }
      const [workspaceResponse, paymentItemsResponse, collectionsResponse] = await Promise.all([
        getCircleWorkspace(circleId),
        getCirclePaymentItems(circleId),
        listCircleCollections(circleId).catch(() => null),
      ])
      const items = normalizePaymentItems(paymentItemsResponse)
      const matched = items.find((item) => String(item?.key || item?.id || '') === String(preselectedKey || ''))
      const nextPayload: CirclePayCache = {
        workspace: workspaceResponse || {},
        paymentItems: items,
        collections: extractCollections(collectionsResponse),
        selectedKey: String(matched?.key || matched?.id || items[0]?.key || items[0]?.id || ''),
      }
      applyPayPayload(nextPayload)
      writeCircleScreenCache(cacheKey, nextPayload)
    } catch {
      setError('Unable to load money options right now.')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [applyPayPayload, cacheKey, circleId, preselectedKey, workspace])

  useFocusEffect(
    useCallback(() => {
      loadPay(false)
    }, [loadPay])
  )

  const selectedItem = useMemo(
    () => paymentItems.find((item) => String(item?.key || item?.id || '') === String(selectedKey || '')) || null,
    [paymentItems, selectedKey]
  )
  const duesItem = useMemo(
    () =>
      paymentItems.find((item) => {
        const type = String(item?.type || '').toLowerCase()
        const mode = String(item?.checkout_mode || item?.payment_item_kind || item?.item_type || '').toLowerCase()
        return item?.linked_reference_type === 'CircleDuePlan' || type === 'dues' || mode === 'recurring'
      }) || null,
    [paymentItems]
  )
  const liveCollections = useMemo(() => collections.filter(isLiveCollection), [collections])
  const requestCount = useMemo(() => {
    const approvals: Array<Record<string, unknown>> = Array.isArray(workspace?.approvals?.items)
      ? workspace.approvals.items
      : []
    const pendingApprovals = approvals.filter((item) => {
      const state = String(item?.lifecycle_state || item?.status || '').toLowerCase()
      return !['approved', 'rejected', 'failed', 'completed', 'cancelled', 'paid'].includes(state)
    }).length
    const treasuryAccount = workspace?.treasury_account || {}
    const pendingPayouts = Number(
      treasuryAccount?.pending_payout_count ??
        treasuryAccount?.pending_payouts_count ??
        workspace?.pending_treasury_payout_count ??
        0
    ) || 0
    return pendingApprovals + pendingPayouts
  }, [workspace])
  const showAdminTab = canAccessManageCircle(workspace)
  const showTreasuryTab = canViewSharedFundTab(workspace)
  const canAccessTreasury = Boolean(showTreasuryTab)
  const openFundWithItem = useCallback(
    (item: Record<string, any> | null) => {
      if (!item) return
      router.push({
        pathname: '/circles/[id]/fund',
        params: {
          id: String(circleId),
          paymentItemKey: String(item?.key || item?.id || ''),
        },
      } as any)
    },
    [circleId, router]
  )

  if (!circleId) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712]">
        <Text className="text-sm text-red-300">Missing circle.</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712]">
        <ActivityIndicator color="#22d3ee" />
      </View>
    )
  }

  if (error || !workspace) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712] px-6">
        <Text className="text-center text-sm text-red-300">{error || 'Circle unavailable.'}</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CircleShell
        circleId={String(circleId)}
        title={circleTitle(workspace)}
        logoUrl={String(workspace?.logo_url || '')}
        roleLabel={getCircleRoleLabel(workspace)}
        bucketLabel={circleBucketLabel(workspace)}
        active="pay"
        showAdminTab={showAdminTab}
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => router.push(`/circles/${circleId}/members` as any)}
        onTreasury={() => router.push(`/circles/${circleId}/treasury` as any)}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
        showTreasuryTab={showTreasuryTab}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPay(true)} />}
        >
          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Payments</Text>
            <Text className="mt-2 text-lg font-semibold text-white">Everything related to this group’s payments lives here.</Text>
            <Text className="mt-2 text-sm text-gray-400">Use this space to manage the shared fund, dues, collections, and requests.</Text>
            <View className="mt-4 gap-3">
              {canAccessTreasury ? (
                <TouchableOpacity
                  onPress={() => router.push(`/circles/${circleId}/treasury` as any)}
                  className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-white">Shared Fund</Text>
                      <Text className="mt-1 text-xs text-gray-400">View fund details, balance, and payout requests.</Text>
                    </View>
                    <Text className="text-sm font-semibold text-cyan-100">Open</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                disabled={!duesItem}
                onPress={() => openFundWithItem(duesItem)}
                className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-white">Dues</Text>
                    <Text className="mt-1 text-xs text-gray-400">Current member dues and recurring payments.</Text>
                  </View>
                  <Text className="text-sm font-semibold text-white">
                    {duesItem ? 'Pay now' : 'Not set'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/circles/${circleId}/activities` as any)}
                className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-white">Collections</Text>
                    <Text className="mt-1 text-xs text-gray-400">Open collections and money goals for this group.</Text>
                  </View>
                  <Text className="text-sm font-semibold text-white">
                    {liveCollections.length > 0 ? `${liveCollections.length} open` : 'None'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/circles/${circleId}/withdraw` as any)}
                className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-white">Requests</Text>
                    <Text className="mt-1 text-xs text-gray-400">Request money or review payouts waiting for action.</Text>
                  </View>
                  <Text className="text-sm font-semibold text-white">
                    {requestCount > 0 ? `${requestCount} waiting` : 'None'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
          <PaymentItemList title="Ways to pay" items={paymentItems} selectedKey={selectedKey} onSelect={(item) => setSelectedKey(String(item?.key || item?.id || ''))} />
          <PaymentCheckout
            item={selectedItem}
            onContinue={() => openFundWithItem(selectedItem)}
          />
        </ScrollView>
      </CircleShell>
    </>
  )
}

export default CirclePayScreen




