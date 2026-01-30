import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { queryTransaction } from '@/api/paymentProcessors'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const QueryTransactionScreen = () => {
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [formValue, setFormValue] = useState('')
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  const handleQuery = async () => {
    if (!formValue.trim()) {
      setNotice({ message: 'Enter a payment processor ID.', error: true, data: null })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await queryTransaction(formValue.trim())
      const payload: any = response
      setResult(payload?.data ?? payload)
      setNotice({
        message: payload?.message || 'Transaction queried.',
        error: false,
        data: payload?.data || null,
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
        fallback: error?.message || 'Unable to query transaction',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-10">
          <Text className="text-white text-2xl mb-2">Query Transaction</Text>
          <Text className="text-gray-300 mb-6">Check payment processor status.</Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <FormInput
            label="Payment Processor ID"
            value={formValue}
            name="processor_id"
            onChangeText={(text: string) => setFormValue(text)}
          />

          <TouchableOpacity onPress={handleQuery} className="bg-theme-primary py-6 rounded-xl">
            <Text className="text-alt font-medium text-center">Query</Text>
          </TouchableOpacity>

          {result ? (
            <View className="bg-gray-900 p-4 rounded-xl mt-6">
              <Text className="text-white font-semibold mb-2">Result</Text>
              {Object.entries(result).map(([key, value]) => (
                <View key={key} className="flex-row justify-between py-1">
                  <Text className="text-gray-400 text-xs">{key}</Text>
                  <Text className="text-gray-200 text-xs">
                    {typeof value === 'string' || typeof value === 'number'
                      ? String(value)
                      : JSON.stringify(value)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidWrapper>
      <Loader open={loading} />
    </View>
  )
}

export default QueryTransactionScreen
