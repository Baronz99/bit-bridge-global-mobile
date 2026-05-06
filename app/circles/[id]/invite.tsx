import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { CircleMemberRole, getCircle, inviteCircleMember } from '@/api/circles'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }
const ROLE_OPTIONS: CircleMemberRole[] = ['member', 'treasurer', 'admin']

const InviteCircleMemberScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id

  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [formData, setFormData] = useState({
    email: '',
    role: 'member' as CircleMemberRole,
  })
  const [assignableRoles, setAssignableRoles] = useState<CircleMemberRole[]>(['member'])
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null })

  React.useEffect(() => {
    let mounted = true
    const loadCircle = async () => {
      if (!circleId) return
      try {
        const response = await getCircle(circleId)
        const payload = (response?.data ?? response) as any
        const allowed = Array.isArray(payload?.assignable_roles)
          ? payload.assignable_roles.filter((item: string) => ROLE_OPTIONS.includes(item as CircleMemberRole))
          : ['member']
        if (!mounted) return
        setAssignableRoles(allowed.length > 0 ? allowed : ['member'])
        setFormData((current) => ({
          ...current,
          role: allowed.includes(current.role) ? current.role : (allowed[0] as CircleMemberRole),
        }))
      } catch {
        if (!mounted) return
        setAssignableRoles(['member'])
      } finally {
        if (mounted) setBootstrapping(false)
      }
    }

    loadCircle()
    return () => {
      mounted = false
    }
  }, [circleId])

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
      const response = await inviteCircleMember(circleId, { email, role: formData.role })
      const payload: any = response
      setFormData((current) => ({ ...current, email: '' }))
      setNotice({
        message: payload?.message || `Invitation sent to ${email}.`,
        error: false,
        data: payload?.data || null })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to invite member' })
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

          <View className="mt-4">
            <Text className="text-white text-sm mb-2">Role</Text>
            <View className="flex-row flex-wrap gap-2">
              {assignableRoles.map((role) => {
                const active = formData.role === role
                return (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setFormData((current) => ({ ...current, role }))}
                    disabled={bootstrapping}
                    className={`px-4 py-3 rounded-full border ${
                      active ? 'bg-app-primary border-app-primary' : 'bg-gray-950 border-gray-800'
                    }`}
                  >
                    <Text className={`text-xs font-medium uppercase ${active ? 'text-black' : 'text-white'}`}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text className="text-gray-400 text-xs mt-2">
              Only the group creator can assign another admin. Treasurers can help propose withdrawals when shared controls are enabled.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleInvite}
            className="bg-theme-primary py-6 mt-6 rounded-xl"
            disabled={bootstrapping}
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


