import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import NotificationAlert from '@/components/notification'
import { verifyKyc } from '@/api/account'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useAuth } from '@/services/useAuth'

const AnchorKycVerify = () => {
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string | null; error: boolean }>({
    message: null,
    error: false,
  })
  const [form, setForm] = useState({
    bvn: '',
    dob: '',
    gender: '',
  })

  const handleSubmit = async () => {
    if (!form.bvn.trim() || !form.dob.trim()) {
      setNotice({ message: 'BVN and date of birth are required.', error: true })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false })
    try {
      const response = await verifyKyc({
        bvn: form.bvn.trim(),
        dob: form.dob.trim(),
        gender: form.gender.trim() || undefined,
      })
      setNotice({
        message: response?.message || 'KYC verification submitted.',
        error: false,
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
        fallback: error?.message || 'Unable to verify KYC',
      })
      setNotice({ message, error: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="pt-8">
          <Text className="text-white text-2xl font-semibold">Anchor KYC Verify</Text>
          <Text className="text-gray-400 mt-1">
            Provide BVN and date of birth to verify your Anchor account.
          </Text>

          <View className="mt-6">
            <FormInput
              label="BVN"
              value={form.bvn}
              onChangeText={(value: string) => setForm({ ...form, bvn: value })}
              keyboardType="numeric"
            />
            <FormInput
              label="Date of Birth (YYYY-MM-DD)"
              value={form.dob}
              onChangeText={(value: string) => setForm({ ...form, dob: value })}
            />
            <FormSelect
              label="Gender (optional)"
              selectedValue={form.gender}
              onValueChange={(value: string) => setForm({ ...form, gender: value })}
              options={[
                { label: 'Select gender', value: '' },
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
              ]}
            />
          </View>

          {notice.message ? (
            <NotificationAlert message={notice.message} error={notice.error} data={null} />
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-app-primary py-4 rounded-xl mt-6"
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-white text-center font-medium">Submit Verification</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default AnchorKycVerify
