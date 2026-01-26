import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { changeTransactionPin } from '@/api/transactionPin'
import { FEATURE_TRANSACTION_PIN } from '@/constants/featureFlags'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const ChangePin = () => {
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState({ current_pin: '', new_pin: '' })

  if (!FEATURE_TRANSACTION_PIN) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Change PIN</Text>
        <Text className="text-gray-400">PIN management is currently disabled.</Text>
      </View>
    )
  }

  const handleSubmit = async () => {
    if (!form.current_pin || !form.new_pin) {
      setNotice('Both PIN fields are required.')
      return
    }
    if (form.current_pin.length !== 4 || form.new_pin.length !== 4) {
      setNotice('PINs must be 4 digits.')
      return
    }

    setLoading(true)
    setNotice(null)
    try {
      const response = await changeTransactionPin({
        current_pin: form.current_pin,
        new_pin: form.new_pin,
      })
      setNotice(response?.message || 'PIN updated successfully.')
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to change PIN',
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
          <Text className="text-white text-2xl font-semibold">Change PIN</Text>
          <Text className="text-gray-400 mt-1">Enter your current and new PIN.</Text>

          <View className="mt-6">
            <FormInput
              label="Current PIN"
              value={form.current_pin}
              keyboardType="numeric"
              secureTextEntry
              onChangeText={(value: string) =>
                setForm({ ...form, current_pin: value.replace(/[^0-9]/g, '') })
              }
            />
            <FormInput
              label="New PIN"
              value={form.new_pin}
              keyboardType="numeric"
              secureTextEntry
              onChangeText={(value: string) =>
                setForm({ ...form, new_pin: value.replace(/[^0-9]/g, '') })
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
              <Text className="text-white text-center font-medium">Update PIN</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default ChangePin
