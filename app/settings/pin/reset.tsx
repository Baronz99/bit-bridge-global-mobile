import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import {
  requestTransactionPinReset,
  confirmTransactionPinReset,
} from '@/api/transactionPin'
import { FEATURE_TRANSACTION_PIN } from '@/constants/featureFlags'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const ResetPin = () => {
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [form, setForm] = useState({
    phone_number: '',
    code: '',
    new_pin: '',
  })

  if (!FEATURE_TRANSACTION_PIN) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Reset PIN</Text>
        <Text className="text-gray-400">PIN management is currently disabled.</Text>
      </View>
    )
  }

  const handleRequest = async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await requestTransactionPinReset({
        phone_number: form.phone_number || undefined,
      })
      setNotice(response?.message || 'OTP sent. Enter the code to reset your PIN.')
      setStep('confirm')
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

  const handleConfirm = async () => {
    if (!form.code || form.new_pin.length !== 4) {
      setNotice('Enter the code and a 4-digit PIN.')
      return
    }
    setLoading(true)
    setNotice(null)
    try {
      const response = await confirmTransactionPinReset({
        code: form.code,
        new_pin: form.new_pin,
        phone_number: form.phone_number || undefined,
      })
      setNotice(response?.message || 'PIN reset successfully.')
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to reset PIN',
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
          <Text className="text-white text-2xl font-semibold">Reset PIN</Text>
          <Text className="text-gray-400 mt-1">Use OTP to reset your PIN.</Text>

          <View className="mt-6">
            <FormInput
              label="Phone Number (optional)"
              value={form.phone_number}
              keyboardType="phone-pad"
              onChangeText={(value: string) => setForm({ ...form, phone_number: value })}
            />
            {step === 'confirm' ? (
              <>
                <FormInput
                  label="OTP Code"
                  value={form.code}
                  keyboardType="numeric"
                  onChangeText={(value: string) => setForm({ ...form, code: value })}
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
              </>
            ) : null}
          </View>

          {notice ? <Text className="text-yellow-400 mt-2">{notice}</Text> : null}

          <TouchableOpacity
            onPress={step === 'request' ? handleRequest : handleConfirm}
            className="bg-app-primary py-4 rounded-xl mt-6"
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-white text-center font-medium">
                {step === 'request' ? 'Send OTP' : 'Confirm Reset'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default ResetPin
