import React, { useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { activateTunnel } from '@/api/wallet'
import { useAuth } from '@/services/useAuth'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { apiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = {
  message: string | null
  error: boolean
  data: any | null
}

const TunnelActivationScreen = () => {
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  const handleError = async (error: any) => {
    const status = error?.response?.status
    if (status === 401) {
      await onLogout().catch(() => {})
      return
    }

    const data = error?.response?.data
    const message = apiErrorMessage({
      status,
      data,
      fallback: error?.message || 'Something went wrong',
    })
    setNotice({ message, error: true, data: null })
  }

  const handleActivate = async () => {
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await activateTunnel()
      setNotice({
        message: response?.message || 'Tunnel activated successfully.',
        error: false,
        data: response?.data || null,
      })
    } catch (error: any) {
      await handleError(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pt-10">
          <Text className="text-white text-2xl mb-2">Tunnel Activation</Text>
          <Text className="text-gray-300 mb-6">
            Activate Tunnel FX to convert between NGN and USD.
          </Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <TouchableOpacity
            onPress={handleActivate}
            className="bg-theme-primary py-6 mt-6 rounded-xl"
          >
            <Text className="text-alt font-medium text-center">Activate Tunnel FX</Text>
          </TouchableOpacity>

          <View className="mt-6">
            <TouchableOpacity
              onPress={() => router.push('/convert-ngn-to-usd')}
              className="bg-gray-900 py-5 mb-3 rounded-xl"
            >
              <Text className="text-white text-center">Convert NGN to USD</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/convert-usd-to-ngn')}
              className="bg-gray-900 py-5 rounded-xl"
            >
              <Text className="text-white text-center">Convert USD to NGN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <Loader open={loading} />
    </View>
  )
}

export default TunnelActivationScreen



