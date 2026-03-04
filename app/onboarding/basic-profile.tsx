import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { updateBasicProfile, saveOnboardingStage } from '@/api/onboarding'
import { FEATURE_ONBOARDING } from '@/constants/featureFlags'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useAuth } from '@/services/useAuth'
import DateTimePicker from '@react-native-community/datetimepicker'

const BasicProfile = () => {
  const { userProfileData, loadProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateValue, setDateValue] = useState<Date | null>(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    date_of_birth: '',
  })

  useEffect(() => {
    const root = userProfileData?.data ?? userProfileData ?? {}
    const profile = root?.user_profile || {}
    setForm((prev) => ({
      ...prev,
      first_name: profile?.first_name || prev.first_name,
      last_name: profile?.last_name || prev.last_name,
      phone_number: profile?.phone_number || prev.phone_number,
      date_of_birth: profile?.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : prev.date_of_birth,
    }))
    if (profile?.date_of_birth) {
      const parsed = new Date(String(profile.date_of_birth))
      if (!Number.isNaN(parsed.getTime())) setDateValue(parsed)
    }
  }, [userProfileData])

  if (!FEATURE_ONBOARDING) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Basic Profile</Text>
        <Text className="text-gray-400">Onboarding is currently disabled.</Text>
      </View>
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    setNotice(null)
    try {
      await updateBasicProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        phone_number: form.phone_number,
        date_of_birth: form.date_of_birth,
      })
      await saveOnboardingStage('basic_profile')
      await loadProfile({ force: true })
      setNotice('Profile saved successfully.')
    } catch (error: any) {
      const errors = error?.response?.data?.errors
      if (Array.isArray(errors) && errors.length > 0) {
        setNotice(errors.join(', '))
        return
      }
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to save profile',
      })
      setNotice(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="pt-8">
          <Text className="text-white text-2xl font-semibold">Basic Profile</Text>
          <Text className="text-gray-400 mt-1">Tell us about yourself.</Text>

          <View className="mt-6">
            <FormInput
              label="First Name"
              value={form.first_name}
              onChangeText={(value: string) => setForm({ ...form, first_name: value })}
            />
            <FormInput
              label="Last Name"
              value={form.last_name}
              onChangeText={(value: string) => setForm({ ...form, last_name: value })}
            />
            <FormInput
              label="Phone Number"
              value={form.phone_number}
              keyboardType="phone-pad"
              onChangeText={(value: string) => setForm({ ...form, phone_number: value })}
            />
            <View className="mt-3">
              <Text className="text-gray-300 text-sm mb-2">Date of Birth</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-[#111827] border border-[rgba(255,255,255,0.12)] rounded-2xl px-4 py-3"
              >
                <Text className="text-white">
                  {form.date_of_birth
                    ? new Date(form.date_of_birth).toLocaleDateString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Select date of birth'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {notice ? <Text className="text-yellow-400 mt-2">{notice}</Text> : null}

          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-app-primary py-4 rounded-xl mt-6"
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-white text-center font-medium">Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>

      {showDatePicker ? (
        <DateTimePicker
          value={dateValue || new Date(1990, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          maximumDate={new Date()}
          onChange={(_, selectedDate) => {
            setShowDatePicker(false)
            if (!selectedDate) return
            const iso = selectedDate.toISOString().slice(0, 10)
            setDateValue(selectedDate)
            setForm((prev) => ({ ...prev, date_of_birth: iso }))
          }}
        />
      ) : null}
    </View>
  )
}

export default BasicProfile
