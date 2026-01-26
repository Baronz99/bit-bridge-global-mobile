import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { confirmPasswordReset } from '@/api/auth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const ResetPassword = () => {
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState({
    reset_password_token: '',
    password: '',
    password_confirmation: '',
  })

  const handleSubmit = async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await confirmPasswordReset({
        reset_password_token: form.reset_password_token.trim(),
        password: form.password,
        password_confirmation: form.password_confirmation,
      })
      setNotice(response?.message || 'Password updated successfully.')
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to reset password',
      })
      setNotice(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="pt-10">
          <Text className="text-white text-2xl font-semibold">Reset Password</Text>
          <Text className="text-gray-400 mt-1">Enter the reset token and new password.</Text>

          <View className="mt-6">
            <FormInput
              label="Reset Token"
              value={form.reset_password_token}
              onChangeText={(value: string) =>
                setForm({ ...form, reset_password_token: value })
              }
            />
            <FormInput
              label="New Password"
              value={form.password}
              secureTextEntry
              onChangeText={(value: string) => setForm({ ...form, password: value })}
            />
            <FormInput
              label="Confirm Password"
              value={form.password_confirmation}
              secureTextEntry
              onChangeText={(value: string) =>
                setForm({ ...form, password_confirmation: value })
              }
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
              <Text className="text-white text-center font-medium">Update Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default ResetPassword
