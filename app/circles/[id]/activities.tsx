import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { createCircleActivity, listCircleActivities } from '@/api/circles'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import moneyFormat from '@/utils/moneyFormat'

type NoticeState = { message: string | null; error: boolean; data: any | null }
type ActivityRecord = Record<string, any>

const extractActivities = (payload: unknown): ActivityRecord[] => {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, any>
    const list = container.data || container.activities || container.items || []
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
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    deadline_at: '',
    contribution_frequency: 'one_time',
  })
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  const loadActivities = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await listCircleActivities(circleId)
      setActivities(extractActivities(response))
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout()
        router.replace('/login')
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to load activities',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }, [circleId, onLogout, router])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const handleCreate = async () => {
    if (!circleId) return
    const name = formData.name.trim()
    const targetAmount = Number(String(formData.target_amount).replace(/[^0-9.]/g, ''))
    if (!name) {
      setNotice({ message: 'Enter an activity name to continue.', error: true, data: null })
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
      })
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
      })
      setNotice({ message: 'Activity created.', error: false, data: null })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout()
        router.replace('/login')
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to post activity',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setSubmitting(false)
    }
  }

  const emptyState = useMemo(() => activities.length === 0 && !loading, [activities.length, loading])

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-10">
          <Text className="text-white text-2xl mb-2">Circle activities</Text>
          <Text className="text-gray-300 mb-6">
            Create group goals and track contributions.
          </Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <FormInput
            label="Activity name"
            value={formData.name}
            name="name"
            onChangeText={(text: string) => setFormData({ ...formData, name: text })}
          />
          <FormInput
            label="Target amount (NGN)"
            value={formData.target_amount}
            name="target_amount"
            keyboardType="numeric"
            onChangeText={(text: string) => setFormData({ ...formData, target_amount: text })}
          />
          <FormInput
            label="Deadline (YYYY-MM-DD)"
            value={formData.deadline_at}
            name="deadline_at"
            onChangeText={(text: string) => setFormData({ ...formData, deadline_at: text })}
          />
          <FormInput
            label="Frequency (one_time, weekly, monthly)"
            value={formData.contribution_frequency}
            name="contribution_frequency"
            onChangeText={(text: string) =>
              setFormData({ ...formData, contribution_frequency: text })
            }
          />

          <TouchableOpacity
            onPress={handleCreate}
            className={`${submitting ? 'bg-gray-700' : 'bg-theme-primary'} py-5 rounded-xl`}
            disabled={submitting}
          >
            <Text className="text-alt font-medium text-center">Create activity</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={loadActivities}
            className="bg-gray-900 py-4 mt-4 rounded-xl"
          >
            <Text className="text-white text-center">Refresh Activities</Text>
          </TouchableOpacity>

          {emptyState ? (
            <View className="bg-gray-900 p-4 rounded-xl mt-6">
              <Text className="text-gray-300 text-center">No activities yet.</Text>
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
                const pct = target > 0 ? Math.min(100, (raised / target) * 100) : 0
                return (
                  <View key={key} className="bg-gray-900 p-4 rounded-xl mb-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white text-sm font-semibold">{item?.name || 'Activity'}</Text>
                      <Text className="text-gray-300 text-xs uppercase">{status}</Text>
                    </View>
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
    </View>
  )
}

export default ActivitiesScreen
