import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { setTransactionPin } from '@/api/transactionPin'
import { FEATURE_TRANSACTION_PIN } from '@/constants/featureFlags'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const SetPin = () => {
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState({ pin: '', confirm: '' })

  if (!FEATURE_TRANSACTION_PIN) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Set PIN</Text>
        <Text className="text-gray-400">PIN management is currently disabled.</Text>
      </View>
    )
  }

  const handleSubmit = async () => {
    if (!form.pin || form.pin.length !== 4) {
      setNotice('PIN must be 4 digits.')
      return
    }
    if (form.pin !== form.confirm) {
      setNotice('PINs do not match.')
      return
    }

    setLoading(true)
    setNotice(null)
    try {
      const response = await setTransactionPin(form.pin)
      setNotice(response?.message || 'PIN set successfully.')
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to set PIN',
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
          <Text className="text-white text-2xl font-semibold">Set Transaction PIN</Text>
          <Text className="text-gray-400 mt-1">Create a 4-digit PIN.</Text>

          <View className="mt-6">
            <FormInput
              label="PIN"
              value={form.pin}
              keyboardType="numeric"
              secureTextEntry
              onChangeText={(value: string) =>
                setForm({ ...form, pin: value.replace(/[^0-9]/g, '') })
              }
            />
            <FormInput
              label="Confirm PIN"
              value={form.confirm}
              keyboardType="numeric"
              secureTextEntry
              onChangeText={(value: string) =>
                setForm({ ...form, confirm: value.replace(/[^0-9]/g, '') })
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
              <Text className="text-white text-center font-medium">Save PIN</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default SetPin
