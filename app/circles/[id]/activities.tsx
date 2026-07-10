import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { createCircleActivity, listCircleCollections } from '@/api/circles'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import moneyFormat from '@/utils/moneyFormat'
import { getCircleTypeConfig } from '@/utils/circleTypeConfig'
import { backOrFallback, normalizeRouteParam } from '@/utils/navigationRecovery'
import ScreenContainer from '@/components/ScreenContainer'

type NoticeState = { message: string | null; error: boolean; data: any | null }
type ActivityRecord = Record<string, any>

const extractActivities = (payload: unknown): ActivityRecord[] => {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, any>
    const list = container.data || container.collections || container.activities || container.items || []
    return Array.isArray(list) ? list : []
  }
  return []
}

const extractCreatedActivity = (payload: unknown): ActivityRecord | null => {
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, any>
    return (container.activity as ActivityRecord) || null
  }
  return null
}

const ActivitiesScreen = () => {
  const { id, circleType, circleName, templateName, templateFrequency } = useLocalSearchParams<{
    id?: string | string[]
    circleType?: string | string[]
    circleName?: string | string[]
    templateName?: string | string[]
    templateFrequency?: string | string[]
  }>()
  const circleId = normalizeRouteParam(id)
  const routeCircleType = normalizeRouteParam(circleType)
  const routeCircleName = normalizeRouteParam(circleName)
  const routeTemplateName = normalizeRouteParam(templateName)
  const routeTemplateFrequency = normalizeRouteParam(templateFrequency)
  const circleTypeConfig = getCircleTypeConfig(routeCircleType)
  const router = useRouter()
  const collectionSingularLabel = 'Collection'
  const paymentsFallbackRoute = circleId ? `/circles/${circleId}/pay` : '/circles'
  const ACTIVITY_TYPES = [
    { value: 'goal', label: 'Goal', helper: 'Raise toward a target' },
    { value: 'collection', label: 'Collection', helper: 'Collect money for a purpose' },
    { value: 'campaign', label: 'Campaign', helper: 'Open fundraising drive' },
  ] as const

  const inferActivityType = (value?: string | null) => {
    const text = String(value || '').toLowerCase()
    if (text.includes('campaign')) return 'campaign'
    if (/(contribution|support|welfare|collection)/i.test(text)) return 'collection'
    return 'goal'
  }

  const resolveActivityType = (item?: ActivityRecord | null) => {
    const explicitType = String(item?.activity_type || item?.type || '').toLowerCase().trim()
    if (explicitType) return explicitType
    return inferActivityType(String(item?.payment_item_kind || item?.name || ''))
  }

  const activityTypeLabel = (value?: string | null) =>
    ACTIVITY_TYPES.find((item) => item.value === String(value || '').toLowerCase())?.label || 'Goal'

  const activityTypeHelper = (value?: string | null) =>
    ACTIVITY_TYPES.find((item) => item.value === String(value || '').toLowerCase())?.helper || ACTIVITY_TYPES[0].helper

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    deadline_at: '',
    contribution_frequency: 'one_time',
    activity_type: 'goal' })
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null })

  const loadActivities = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await listCircleCollections(circleId)
      setActivities(extractActivities(response))
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to load collections' })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  useEffect(() => {
    if (!routeTemplateName) return
    setFormData((previous) => ({
      ...previous,
      name: String(routeTemplateName),
      contribution_frequency: String(routeTemplateFrequency || previous.contribution_frequency || 'one_time'),
      activity_type: inferActivityType(routeTemplateName),
    }))
  }, [routeTemplateFrequency, routeTemplateName])

  const handleCreate = async () => {
    if (!circleId) return
    const name = formData.name.trim()
    const targetAmount = Number(String(formData.target_amount).replace(/[^0-9.]/g, ''))
    if (!name) {
      setNotice({ message: 'Enter a collection name to continue.', error: true, data: null })
      return
    }
    if (!targetAmount || Number.isNaN(targetAmount)) {
      setNotice({ message: 'Enter a valid target amount.', error: true, data: null })
      return
    }
    if (!formData.deadline_at) {
      setNotice({ message: 'Select a deadline date.', error: true, data: null })
      return
    }
    setSubmitting(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await createCircleActivity(circleId, {
        name,
        target_amount_cents: Math.round(targetAmount * 100),
        deadline_at: formData.deadline_at,
        contribution_frequency: formData.contribution_frequency,
        activity_type: formData.activity_type })
      const created = extractCreatedActivity(response)
      if (created) {
        setActivities((prev) => [created, ...prev])
      } else {
        await loadActivities()
      }
      setFormData({
        name: '',
        target_amount: '',
        deadline_at: '',
        contribution_frequency: 'one_time',
        activity_type: 'goal' })
      setNotice({ message: 'Collection created.', error: false, data: null })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to post activity' })
      setNotice({ message, error: true, data: null })
    } finally {
      setSubmitting(false)
    }
  }

  const emptyState = useMemo(() => activities.length === 0 && !loading, [activities.length, loading])

  return (
    <ScreenContainer
      scroll={false}
      includeTopInset
      includeTabBarPadding={false}
      horizontalPadding={16}
      topPadding={16}
      bottomPadding={16}
      className="flex-1 bg-primary"
    >
      <KeyboardAvoidWrapper>
        <View className="flex-1">
          <Text className="text-white text-2xl mb-2">Collections</Text>
          <Text className="text-gray-300 mb-6">
            Set up the collection members will see in Money.
          </Text>

          <TouchableOpacity accessibilityLabel="Back to Payments" onPress={() => backOrFallback(router, paymentsFallbackRoute)} className="self-start rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 mb-4">
            <Text className="text-white text-[11px] font-semibold">Back to Payments</Text>
          </TouchableOpacity>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 mb-4">
            <Text className="text-white text-xs uppercase tracking-[0.16em] mb-2">Starter templates</Text>
            <Text className="text-gray-400 text-xs mb-3">{routeCircleName ? `${routeCircleName}: ` : ''}{circleTypeConfig.createDescription}</Text>
            <View className="flex-row flex-wrap gap-2">
              {circleTypeConfig.starterTemplates.map((template) => (
                <TouchableOpacity
                  key={template.name}
                  onPress={() =>
                    setFormData((prev) => ({
                      ...prev,
                      name: template.name,
                      contribution_frequency: template.contribution_frequency,
                      activity_type: inferActivityType(template.name),
                    }))
                  }
                  className="rounded-full border border-gray-700 bg-gray-950 px-3 py-2"
                >
                  <Text className="text-white text-xs">{template.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <FormInput
            label={`${collectionSingularLabel} name`}
            value={formData.name}
            onChangeText={(text: string) => setFormData({ ...formData, name: text })}
          />
          <View className="mb-4">
            <Text className="mb-2 text-sm text-gray-300">Structure</Text>
            <View className="flex-row flex-wrap gap-2">
              {ACTIVITY_TYPES.map((option) => {
                const active = formData.activity_type === option.value
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setFormData({ ...formData, activity_type: option.value })}
                    className={`rounded-full border px-3 py-2 ${active ? 'border-cyan-400 bg-cyan-400/15' : 'border-gray-700 bg-gray-950'}`}
                  >
                    <Text className="text-xs font-semibold text-white">{option.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text className="mt-2 text-xs text-gray-400">{activityTypeHelper(formData.activity_type)}</Text>
          </View>
          <FormInput
            label="Target amount (NGN)"
            value={formData.target_amount}
            keyboardType="numeric"
            onChangeText={(text: string) => setFormData({ ...formData, target_amount: text })}
          />
          <FormInput
            label="Deadline (YYYY-MM-DD)"
            value={formData.deadline_at}
            onChangeText={(text: string) => setFormData({ ...formData, deadline_at: text })}
          />
          <FormInput
            label="Frequency (one_time, weekly, monthly)"
            value={formData.contribution_frequency}
            onChangeText={(text: string) =>
              setFormData({ ...formData, contribution_frequency: text })
            }
          />

          <TouchableOpacity
            onPress={handleCreate}
            className={`${submitting ? 'bg-gray-700' : 'bg-theme-primary'} py-5 rounded-xl`}
            disabled={submitting}
          >
            <Text className="text-alt font-medium text-center">Create {collectionSingularLabel.toLowerCase()}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={loadActivities}
            className="bg-gray-900 py-4 mt-4 rounded-xl"
          >
            <Text className="text-white text-center">Refresh collections</Text>
          </TouchableOpacity>

          {emptyState ? (
            <View className="bg-gray-900 p-4 rounded-xl mt-6">
              <Text className="text-gray-300 text-center">{circleTypeConfig.emptyActivityLabel}</Text>
            </View>
          ) : (
            <View className="mt-6">
              {activities.map((item, index) => {
                const key = String(item?.id ?? item?.uuid ?? `activity-${index}`)
                const target = Number(item?.target_amount_cents || 0) / 100
                const raised = Number(item?.raised_amount_cents || 0) / 100
                const status = item?.status || 'active'
                const freq = item?.contribution_frequency || 'one_time'
                const deadline = item?.deadline_at || item?.created_at || ''
                const activityType = resolveActivityType(item)
                const pct = target > 0 ? Math.min(100, (raised / target) * 100) : 0
                return (
                  <View key={key} className="bg-gray-900 p-4 rounded-xl mb-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white text-sm font-semibold">{item?.name || 'Collection'}</Text>
                      <Text className="text-gray-300 text-xs uppercase">{status}</Text>
                    </View>
                    <Text className="text-gray-500 text-[10px] mt-1">{activityTypeLabel(activityType)}</Text>
                    <Text className="text-gray-400 text-xs mt-1">
                      {moneyFormat(raised)} raised of {moneyFormat(target)}
                    </Text>
                    <View className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden">
                      <View className="h-full bg-app-primary" style={{ width: `${pct}%` }} />
                    </View>
                    <Text className="text-gray-500 text-[10px] mt-2">
                      Deadline: {deadline || 'Not set'} | {freq}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </KeyboardAvoidWrapper>
      <Loader open={loading} />
    </ScreenContainer>
  )
}

export default ActivitiesScreen


