import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { updateBasicProfile, saveOnboardingStage } from '@/api/onboarding'
import { FEATURE_ONBOARDING } from '@/constants/featureFlags'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const BasicProfile = () => {
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    date_of_birth: '',
  })

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
      setNotice('Profile saved successfully.')
    } catch (error: any) {
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
            <FormInput
              label="Date of Birth (YYYY-MM-DD)"
              value={form.date_of_birth}
              onChangeText={(value: string) => setForm({ ...form, date_of_birth: value })}
            />
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
    </View>
  )
}

export default BasicProfile
