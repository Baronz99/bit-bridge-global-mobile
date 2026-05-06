import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getCircleWorkspace } from '@/api/circles'
import {
  CircleShell,
  circleBucketLabel,
  circleTitle,
  paymentEventLabel,
  recordAmountLabel,
  recordDirection,
  recordStatusLabel,
  recordSubtitle,
  recordTimeLabel,
  recordTitle,
} from '@/components/circles/rebuild'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { extractCircleRecentActivity } from '@/utils/circleWorkspace'
import { extractReceiptReference } from '@/utils/timelineRefs'

const findRecord = (records: any[], eventId: string) => {
  const target = String(eventId || '').trim()
  if (!target) return null

  return (
    records.find((record) => String(record?.id || '').trim() === target) ||
    records.find((record) => String(record?.uuid || '').trim() === target) ||
    records.find((record) => String(record?.reference || '').trim() === target) ||
    null
  )
}

const actorName = (record: Record<string, any>) => {
  const actor = record?.actor && typeof record.actor === 'object' && !Array.isArray(record.actor) ? record.actor : {}
  return String(
    actor.display_name || actor.name || actor.fallback_name || record?.actor_name || record?.user_name || 'Member'
  ).trim()
}

const beneficiaryLabel = (record: Record<string, any>) => {
  const meta = record?.meta && typeof record.meta === 'object' && !Array.isArray(record.meta) ? record.meta : {}
  const accountName = String(meta.account_name || meta.destination_account_name || '').trim()
  if (accountName) return accountName
  if (String(record?.activity_type || '').toLowerCase() === 'approval' || String(record?.activity_type || '').toLowerCase() === 'withdrawal') {
    return `${actorName(record)} wallet`
  }
  return ''
}

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  if (!String(value || '').trim()) return null
  return (
    <View className="mt-4">
      <Text className="text-[11px] uppercase tracking-[1.6px] text-gray-500">{label}</Text>
      <Text className="mt-1 text-sm text-gray-200">{value}</Text>
    </View>
  )
}

const CircleTimelineEventDetailScreen = () => {
  const { id, eventId } = useLocalSearchParams<{ id?: string | string[]; eventId?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const resolvedEventId = Array.isArray(eventId) ? eventId[0] : eventId
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEvent = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    setError('')
    try {
      const response = await getCircleWorkspace(circleId)
      setWorkspace(response || {})
    } catch (_) {
      setError('Unable to load this circle event right now.')
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useFocusEffect(
    useCallback(() => {
      loadEvent()
    }, [loadEvent])
  )

  const records = useMemo(() => extractCircleRecentActivity(workspace), [workspace])
  const record = useMemo(() => findRecord(records, String(resolvedEventId || '')), [records, resolvedEventId])
  const receiptReference = useMemo(() => extractReceiptReference(record || undefined, { allowWalletTx: true }), [record])
  const title = record ? recordTitle(record) : 'Circle event'
  const subtitle = record ? recordSubtitle(record) : ''
  const direction = record ? recordDirection(record) : 'credit'
  const requestedBy = record ? actorName(record) : ''
  const destination = record ? beneficiaryLabel(record) : ''
  const meta = record?.meta && typeof record.meta === 'object' && !Array.isArray(record.meta) ? record.meta : {}
  const itemRule = String(record?.payment_item_kind || meta.payment_item_kind || '').trim()
  const quantity = Number(record?.payment_item_quantity || meta.payment_item_quantity || 0)
  const note = String(meta.note || meta.narration || meta.description || record?.note || '').trim()

  if (!circleId || !resolvedEventId) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020712] px-6">
        <Text className="text-center text-sm text-red-300">Missing circle event.</Text>
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
        active="timeline"
        onHome={() => router.replace(`/circles/${circleId}` as any)}
        onPay={() => router.push(`/circles/${circleId}/pay` as any)}
        onManage={() => router.push(`/circles/${circleId}/manage` as any)}
        onTimeline={() => router.replace(`/circles/${circleId}/timeline` as any)}
      >
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32, gap: 16 }}>
          {!record ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-6">
              <Text className="text-lg font-semibold text-white">Event not found</Text>
              <Text className="mt-2 text-sm text-gray-400">
                This record is no longer present in the current circle feed.
              </Text>
              <TouchableOpacity
                onPress={() => router.replace(`/circles/${circleId}/timeline` as any)}
                className="mt-5 rounded-2xl bg-cyan-400 px-4 py-4"
              >
                <Text className="text-center text-sm font-semibold text-slate-950">Back to Timeline</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Record</Text>
                <Text className="mt-2 text-2xl font-semibold text-white">{title}</Text>
                <Text className="mt-1 text-sm text-gray-400">{subtitle}</Text>
                <Text className={`mt-4 text-[30px] font-semibold ${direction === 'debit' ? 'text-amber-200' : 'text-emerald-200'}`}>
                  {recordAmountLabel(record)}
                </Text>
                <Text className="mt-2 text-sm text-gray-400">
                  {[recordStatusLabel(record), recordTimeLabel(record)].filter(Boolean).join(' � ')}
                </Text>
              </View>

              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Full details</Text>
                <Text className="mt-2 text-sm text-gray-300">{paymentEventLabel(record)}</Text>
                <DetailRow label="Requested by" value={requestedBy} />
                <DetailRow label="Paid to" value={destination} />
                <DetailRow label="Activity" value={String(record?.activity_type || record?.kind || '').replace(/_/g, ' ')} />
                <DetailRow label="Pricing" value={itemRule.replace(/_/g, ' ')} />
                <DetailRow label="Quantity" value={quantity > 0 ? String(quantity) : ''} />
                <DetailRow label="Reference" value={String(receiptReference || record?.reference || record?.id || '')} />
                <DetailRow label="Note" value={note} />
              </View>

              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Actions</Text>
                {receiptReference ? (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/transaction/record/[reference]',
                        params: { reference: receiptReference },
                      } as any)
                    }
                    className="mt-4 rounded-2xl bg-cyan-400 px-4 py-4"
                  >
                    <Text className="text-center text-sm font-semibold text-slate-950">View Receipt</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => router.replace(`/circles/${circleId}/timeline` as any)}
                  className="mt-3 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4"
                >
                  <Text className="text-center text-sm font-semibold text-white">Back to Timeline</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </CircleShell>
    </>
  )
}

export default CircleTimelineEventDetailScreen
