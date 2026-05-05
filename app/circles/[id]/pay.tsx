import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCirclePaymentItems, getCircleWorkspace } from '@/api/circles'
import {
  CircleShell,
  PaymentCheckout,
  PaymentItemList,
  circleBucketLabel,
  circleTitle,
  normalizePaymentItems,
} from '@/components/circles/rebuild'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'

const CirclePayScreen = () => {
  const { id, paymentItemKey } = useLocalSearchParams<{ id?: string | string[]; paymentItemKey?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const preselectedKey = Array.isArray(paymentItemKey) ? paymentItemKey[0] : paymentItemKey
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [paymentItems, setPaymentItems] = useState<any[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadPay = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [workspaceResponse, paymentItemsResponse] = await Promise.all([
        getCircleWorkspace(circleId),
        getCirclePaymentItems(circleId),
      ])
      const items = normalizePaymentItems(paymentItemsResponse)
      setWorkspace(workspaceResponse || {})
      setPaymentItems(items)
      const matched = items.find((item) => String(item?.key || item?.id || '') === String(preselectedKey || ''))
      setSelectedKey(String(matched?.key || matched?.id || items[0]?.key || items[0]?.id || ''))
    } catch (_) {
      setError('Unable to load payment items right now.')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [circleId, preselectedKey])

  useFocusEffect(
    useCallback(() => {
      loadPay(false)
    }, [loadPay])
  )

  const selectedItem = useMemo(
    () => paymentItems.find((item) => String(item?.key || item?.id || '') === String(selectedKey || '')) || null,
    [paymentItems, selectedKey]
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
        roleLabel={getCircleRoleLabel(workspace)}
        bucketLabel={circleBucketLabel(workspace)}
        active="pay"
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => replaceCircleWorkspaceSection(router, String(circleId), 'manage')}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPay(true)} />}
        >
          <PaymentItemList items={paymentItems} selectedKey={selectedKey} onSelect={(item) => setSelectedKey(String(item?.key || item?.id || ''))} />
          <PaymentCheckout
            item={selectedItem}
            onContinue={() =>
              router.push({
                pathname: '/circles/[id]/fund',
                params: {
                  id: String(circleId),
                  paymentItemKey: String(selectedItem?.key || selectedItem?.id || ''),
                },
              } as any)
            }
          />
        </ScrollView>
      </CircleShell>
    </>
  )
}

export default CirclePayScreen
