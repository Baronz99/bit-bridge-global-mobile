import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { inviteCircleMember } from '@/api/circles'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const InviteCircleMemberScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
  })
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  const handleInvite = async () => {
    if (!circleId) {
      setNotice({ message: 'Missing circle ID.', error: true, data: null })
      return
    }
    const email = formData.email.trim()
    if (!email) {
      setNotice({ message: 'Enter an email to invite.', error: true, data: null })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await inviteCircleMember(circleId, { email, role: 'member' })
      setFormData({ email: '' })
      setNotice({
        message: response?.message || `Invitation sent to ${email}.`,
        error: false,
        data: response?.data || null,
      })
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
        fallback: error?.message || 'Unable to invite member',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-10">
          <Text className="text-white text-2xl mb-2">Invite Member</Text>
          <Text className="text-gray-300 mb-6">Add a member to this circle.</Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <FormInput
            label="Member Email"
            value={formData.email}
            name="email"
            keyboardType="email-address"
            onChangeText={(text: string) => setFormData({ ...formData, email: text })}
          />

          <TouchableOpacity
            onPress={handleInvite}
            className="bg-theme-primary py-6 mt-2 rounded-xl"
          >
            <Text className="text-alt font-medium text-center">Send Invite</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>

      <Loader open={loading} />
    </View>
  )
}

export default InviteCircleMemberScreen
