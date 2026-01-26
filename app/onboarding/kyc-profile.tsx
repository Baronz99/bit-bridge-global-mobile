import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { updateKycProfile, saveOnboardingStage } from '@/api/onboarding'
import { FEATURE_ONBOARDING } from '@/constants/featureFlags'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const KycProfile = () => {
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState({
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
  })

  if (!FEATURE_ONBOARDING) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">KYC Profile</Text>
        <Text className="text-gray-400">Onboarding is currently disabled.</Text>
      </View>
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    setNotice(null)
    try {
      await updateKycProfile({
        address_line1: form.address_line1,
        city: form.city,
        state: form.state,
        postal_code: form.postal_code,
      })
      await saveOnboardingStage('kyc_profile')
      setNotice('KYC profile saved successfully.')
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to save KYC profile',
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
          <Text className="text-white text-2xl font-semibold">KYC Profile</Text>
          <Text className="text-gray-400 mt-1">Add your address details.</Text>

          <View className="mt-6">
            <FormInput
              label="Address Line 1"
              value={form.address_line1}
              onChangeText={(value: string) => setForm({ ...form, address_line1: value })}
            />
            <FormInput
              label="City"
              value={form.city}
              onChangeText={(value: string) => setForm({ ...form, city: value })}
            />
            <FormInput
              label="State"
              value={form.state}
              onChangeText={(value: string) => setForm({ ...form, state: value })}
            />
            <FormInput
              label="Postal Code"
              value={form.postal_code}
              onChangeText={(value: string) => setForm({ ...form, postal_code: value })}
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
              <Text className="text-white text-center font-medium">Save KYC Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default KycProfile
