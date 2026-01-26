import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { Link } from 'expo-router'
import { FEATURE_TRANSACTION_PIN } from '@/constants/featureFlags'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

const PinSettings = () => {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getTransactionPinStatus()
      setStatus(res?.data ?? res)
    } catch (err: any) {
      const message = buildApiErrorMessage({
        status: err?.response?.status,
        data: err?.response?.data,
        fallback: err?.message || 'Unable to load PIN status',
      })
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!FEATURE_TRANSACTION_PIN) return
    void fetchStatus()
  }, [fetchStatus])

  if (!FEATURE_TRANSACTION_PIN) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Transaction PIN</Text>
        <Text className="text-gray-400">PIN management is currently disabled.</Text>
      </View>
    )
  }

  const hasPin =
    status?.has_pin === true ||
    status?.status === 'set' ||
    status?.pin_set === true

  return (
    <View className="flex-1 bg-primary px-5 py-8">
      <Text className="text-white text-2xl font-semibold">Transaction PIN</Text>
      <Text className="text-gray-400 mt-1">
        Manage your PIN for transfers and conversions.
      </Text>

      {loading ? (
        <View className="py-6">
          <ActivityIndicator />
        </View>
      ) : null}

      {error ? (
        <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
          <Text className="text-white font-semibold">Error</Text>
          <Text className="text-white/80">{error}</Text>
          <TouchableOpacity onPress={fetchStatus} className="mt-3 bg-red-600 py-2 rounded-lg">
            <Text className="text-white text-center">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="bg-gray-900 rounded-2xl p-4 mt-6">
        <Text className="text-white font-semibold">PIN status</Text>
        <Text className="text-gray-400 mt-2">
          {hasPin ? 'PIN is set.' : 'No PIN set yet.'}
        </Text>
      </View>

      <View className="mt-6 gap-4">
        <Link href="/settings/pin/set" asChild>
          <TouchableOpacity className="bg-gray-900 py-4 rounded-xl px-4">
            <Text className="text-white font-medium">Set PIN</Text>
            <Text className="text-gray-400 text-xs mt-1">Create a new PIN.</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/settings/pin/change" asChild>
          <TouchableOpacity className="bg-gray-900 py-4 rounded-xl px-4">
            <Text className="text-white font-medium">Change PIN</Text>
            <Text className="text-gray-400 text-xs mt-1">Update your current PIN.</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/settings/pin/reset" asChild>
          <TouchableOpacity className="bg-gray-900 py-4 rounded-xl px-4">
            <Text className="text-white font-medium">Reset PIN</Text>
            <Text className="text-gray-400 text-xs mt-1">Forgot your PIN? Reset with OTP.</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  )
}

export default PinSettings
