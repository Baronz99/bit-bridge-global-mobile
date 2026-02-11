import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { raiseDispute } from '@/api/disputes'
import { FEATURE_DISPUTES } from '@/constants/featureFlags'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const OrderDispute = () => {
  const { id } = useLocalSearchParams()
  const orderId = String(id || '')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState({
    transaction_id: orderId,
    reason: '',
    note: '',
  })

  if (!FEATURE_DISPUTES) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Dispute</Text>
        <Text className="text-gray-400">Disputes are currently disabled.</Text>
      </View>
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await raiseDispute({
        circle_transaction_id: form.transaction_id,
        reason: form.reason,
        note: form.note,
      })
      setNotice(response?.message || 'Dispute submitted.')
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to submit dispute',
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
          <Text className="text-white text-2xl font-semibold">Raise a Dispute</Text>
          <Text className="text-gray-400 mt-1">Order ID: {orderId}</Text>

          <View className="mt-6">
            <FormInput
              label="Circle Transaction ID"
              value={form.transaction_id}
              onChangeText={(value: string) =>
                setForm({ ...form, transaction_id: value })
              }
            />
            <FormInput
              label="Reason"
              value={form.reason}
              onChangeText={(value: string) => setForm({ ...form, reason: value })}
            />
            <FormInput
              label="Note (optional)"
              value={form.note}
              onChangeText={(value: string) => setForm({ ...form, note: value })}
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
              <Text className="text-white text-center font-medium">Submit Dispute</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default OrderDispute
