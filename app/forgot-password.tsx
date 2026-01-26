import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { requestPasswordReset } from '@/api/auth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await requestPasswordReset(email.trim())
      setNotice(response?.message || 'Password reset email sent.')
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to request reset',
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
          <Text className="text-white text-2xl font-semibold">Forgot Password</Text>
          <Text className="text-gray-400 mt-1">
            Enter the email address linked to your account.
          </Text>

          <View className="mt-6">
            <FormInput
              label="Email"
              value={email}
              keyboardType="email-address"
              onChangeText={(value: string) => setEmail(value)}
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
              <Text className="text-white text-center font-medium">Send Reset</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default ForgotPassword
