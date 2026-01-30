import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getTimelineItem } from '@/api/timeline'
import { MOCK_TIMELINE } from '@/components/timeline/mockData'
import moneyFormat from '@/utils/moneyFormat'

const StatusStep = ({ label, active }: { label: string; active: boolean }) => (
  <View className="flex-row items-center mb-2">
    <View className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-gray-700'}`} />
    <Text className={`ml-2 text-xs ${active ? 'text-emerald-300' : 'text-gray-500'}`}>{label}</Text>
  </View>
)

const ActivityDetailsScreen = () => {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState<any | null>(null)

  const loadDetails = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getTimelineItem(String(id))
      const payload = res?.data ?? res
      setRecord(payload ?? null)
    } catch {
      const fallback = MOCK_TIMELINE.find((item) => String(item.id) === String(id)) as any
      setRecord(fallback ?? null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDetails()
  }, [loadDetails])

  const status = String(record?.status || 'pending').toLowerCase()
  const meta = (record?.meta as Record<string, unknown>) || {}
  const amountCents = Number(record?.amount_cents ?? 0)
  const currency = (meta.currency as string) || 'NGN'
  const amount = amountCents ? moneyFormat(amountCents / 100, currency) : '-'
  const reference = (meta.reference as string) || (record?.id as string) || ''
  const actor = record?.actor as Record<string, unknown> | undefined
  const actorName = (actor?.name as string) || 'You'
  const isFailed = status.includes('failed') || status.includes('declined')
  const isPending = status.includes('pending') || status.includes('initialized')
  const isSuccessful = status.includes('approved') || status.includes('successful') || status.includes('completed')

  const statusSteps = useMemo(() => {
    if (isFailed) return ['Created', 'Pending', 'Failed']
    if (isPending) return ['Created', 'Pending', 'Successful']
    if (isSuccessful) return ['Created', 'Pending', 'Successful']
    return ['Created', 'Pending', 'Successful']
  }, [status])

  const handleCopy = async () => {
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(reference)
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', reference)
    }
  }

  if (!id) {
    return (
      <View className="flex-1 bg-primary items-center justify-center px-6">
        <Text className="text-white text-base">Missing activity ID.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pt-6">
          <Text className="text-white text-2xl font-semibold">Activity details</Text>
          <Text className="text-gray-400 text-xs mt-1">
            Review the full timeline and participants for this activity.
          </Text>
        </View>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text className="text-gray-400 text-xs mt-3">Loading details...</Text>
          </View>
        ) : record ? (
          <>
            <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <Text className="text-white text-lg font-semibold">{record?.label || 'Activity'}</Text>
              <Text className="text-gray-400 text-xs mt-1">{record?.occurred_at || '-'}</Text>
              <Text className="text-white text-2xl font-semibold mt-3">{amount}</Text>
              <Text className="text-gray-400 text-xs mt-1">Status: {status}</Text>
            </View>

            <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <Text className="text-white text-sm font-semibold mb-3">Status timeline</Text>
              <StatusStep label={statusSteps[0]} active />
              <StatusStep label={statusSteps[1]} active={isPending || isSuccessful || isFailed} />
              <StatusStep label={statusSteps[2]} active={isSuccessful || isFailed} />
            </View>

            <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <Text className="text-white text-sm font-semibold mb-3">Participants</Text>
              <Text className="text-gray-300 text-xs">Actor: {actorName}</Text>
              {meta.account_name ? (
                <Text className="text-gray-300 text-xs mt-2">
                  Beneficiary: {meta.account_name as string}
                </Text>
              ) : null}
            </View>

            <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <Text className="text-white text-sm font-semibold mb-3">Details</Text>
              <Text className="text-gray-400 text-xs">Reference</Text>
              <Text className="text-gray-200 text-sm mt-1">{reference || '---'}</Text>
              {meta.bank ? (
                <Text className="text-gray-400 text-xs mt-3">Bank</Text>
              ) : null}
              {meta.bank ? (
                <Text className="text-gray-200 text-sm mt-1">{meta.bank as string}</Text>
              ) : null}
              {meta.fees ? (
                <Text className="text-gray-400 text-xs mt-3">Fees</Text>
              ) : null}
              {meta.fees ? (
                <Text className="text-gray-200 text-sm mt-1">{String(meta.fees)}</Text>
              ) : null}
            </View>

            <View className="mt-5">
              <TouchableOpacity
                onPress={handleCopy}
                className="bg-app-primary py-3 rounded-xl items-center"
              >
                <Text className="text-black text-sm font-semibold">Copy reference</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  reference
                    ? router.push({ pathname: '/transaction/confirm', params: { reference } })
                    : null
                }
                className="bg-gray-900 py-3 rounded-xl items-center mt-3"
              >
                <Text className="text-white text-sm">View receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  reference
                    ? router.push({ pathname: '/orders/[id]/dispute', params: { id: reference } })
                    : null
                }
                className="bg-gray-900 py-3 rounded-xl items-center mt-3"
              >
                <Text className="text-red-300 text-sm">Raise dispute</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View className="py-10 items-center">
            <Text className="text-gray-400 text-sm">Activity not found.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

export default ActivityDetailsScreen
