import React, { useEffect, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { getCircle, updateMyCircleMembership } from '@/api/circles'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const formatNextChangeDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const CircleDisplayNameScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const { userProfileData } = useAuth()
  const currentUserId = String((userProfileData as any)?.data?.id || (userProfileData as any)?.id || '')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [nextChangeAt, setNextChangeAt] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
  const trimmedLength = displayName.trim().length

  useEffect(() => {
    let mounted = true

    const loadCircle = async () => {
      if (!circleId) return
      setLoading(true)
      try {
        const response = await getCircle(circleId)
        const payload = (response?.data ?? response) as any
        const members = Array.isArray(payload?.members) ? payload.members : []
        const me = members.find((member: any) => String(member?.user?.id || '') === currentUserId)
        const currentValue = String(me?.display_name || me?.user?.display_name || '').trim()
        const nextChangeValue = String(me?.next_display_name_change_at || '').trim()
        if (mounted) setDisplayName(currentValue)
        if (mounted) setNextChangeAt(nextChangeValue || null)
      } catch {
        if (mounted) {
          setNotice({ message: 'Unable to load your Circle Name right now.', error: true, data: null })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadCircle()
    return () => {
      mounted = false
    }
  }, [circleId, currentUserId])

  const handleSave = async () => {
    if (!circleId) return

    setSaving(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await updateMyCircleMembership(circleId, { display_name: displayName.trim() || null })
      const payload = (response?.data ?? response) as any
      setNextChangeAt(String(payload?.next_display_name_change_at || '').trim() || null)
      setNotice({ message: 'Circle Name updated.', error: false, data: null })
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to update your Circle Name.',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-10">
          <Text className="text-white text-2xl mb-2">Circle Name</Text>
          <Text className="text-gray-300 mb-6">
            Choose the name people in this circle will recognize first.
          </Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <View className="rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text className="text-white text-base font-semibold">Set your Circle Name</Text>
                <Text className="text-gray-400 text-xs mt-2">
                  This only changes how you appear inside this circle. Your legal identity stays unchanged.
                </Text>
              </View>
              <View className="h-12 w-12 rounded-full border border-gray-700 bg-gray-950 items-center justify-center">
                <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                  {(displayName.trim() || 'BB')
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              </View>
            </View>

            <View className="mt-4">
              <FormInput
                label="Circle Name"
                value={displayName}
                name="display_name"
                onChangeText={(text: string) => setDisplayName(text.slice(0, 24))}
              />
            </View>

            <View className="flex-row items-center justify-between mt-3">
              <Text className="text-gray-500 text-xs flex-1">
                Up to 24 characters. Reserved words and blocked language are not allowed.
              </Text>
              <Text className="text-gray-500 text-xs">{trimmedLength}/24</Text>
            </View>
            <Text className="text-gray-500 text-xs mt-3">
              You can change your Circle Name once every 60 days.
            </Text>
            {nextChangeAt ? (
              <Text className="text-gray-500 text-xs mt-2">
                Next change available after {formatNextChangeDate(nextChangeAt)}.
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={handleSave}
            className={`py-4 mt-6 rounded-2xl ${saving ? 'bg-gray-700' : 'bg-app-primary'}`}
            disabled={saving}
          >
            <Text className="text-black text-sm font-semibold text-center">
              {saving ? 'Saving...' : 'Save Circle Name'}
            </Text>
          </TouchableOpacity>

          <Text className="text-gray-500 text-xs mt-4">
            People will see your Circle Name first, with your real identity shown second where appropriate.
          </Text>
        </View>
      </KeyboardAvoidWrapper>

      <Loader open={loading} />
    </View>
  )
}

export default CircleDisplayNameScreen
