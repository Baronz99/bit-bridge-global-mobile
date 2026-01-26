import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import NotificationAlert from '@/components/notification'
import { getConversion } from '@/api/currency'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const CurrencyConvertScreen = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [notice, setNotice] = useState<{ message: string | null; error: boolean }>({
    message: null,
    error: false,
  })
  const [form, setForm] = useState({
    from_curr: 'ngn',
    to_curr: 'usd',
    amount: '',
  })

  const handleSubmit = async () => {
    const amountValue = Number(form.amount)
    if (!form.from_curr.trim() || !form.to_curr.trim() || !amountValue) {
      setNotice({ message: 'Enter amount and currencies.', error: true })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false })
    try {
      const response = await getConversion({
        from_curr: form.from_curr.trim(),
        to_curr: form.to_curr.trim(),
        amount: amountValue,
      })
      setResult(response?.data ?? response)
      setNotice({
        message: response?.message || 'Conversion fetched.',
        error: false,
      })
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to fetch conversion',
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
          <Text className="text-white text-2xl font-semibold">Currency Conversion</Text>
          <Text className="text-gray-400 mt-1">Check live conversion rates.</Text>

          <View className="mt-6">
            <View className="flex-row gap-2 mb-3">
              {[
                { label: 'NGN to USD', from: 'ngn', to: 'usd' },
                { label: 'USD to NGN', from: 'usd', to: 'ngn' },
              ].map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  onPress={() => setForm({ ...form, from_curr: preset.from, to_curr: preset.to })}
                  className="bg-gray-900 px-3 py-2 rounded-full"
                >
                  <Text className="text-white text-xs">{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FormInput
              label="From Currency (e.g. ngn)"
              value={form.from_curr}
              onChangeText={(value: string) => setForm({ ...form, from_curr: value })}
            />
            <TouchableOpacity
              onPress={() =>
                setForm({
                  ...form,
                  from_curr: form.to_curr,
                  to_curr: form.from_curr,
                })
              }
              className="bg-gray-900 py-2 rounded-full self-start px-4 mb-2"
            >
              <Text className="text-white text-xs">Swap</Text>
            </TouchableOpacity>
            <FormInput
              label="To Currency (e.g. usd)"
              value={form.to_curr}
              onChangeText={(value: string) => setForm({ ...form, to_curr: value })}
            />
            <FormInput
              label="Amount"
              value={form.amount}
              keyboardType="numeric"
              onChangeText={(value: string) => setForm({ ...form, amount: value })}
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
              <Text className="text-white text-center font-medium">Get Rate</Text>
            )}
          </TouchableOpacity>

          {result ? (
            <View className="bg-gray-900 rounded-xl p-4 mt-6">
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
    </View>
  )
}

export default CurrencyConvertScreen
