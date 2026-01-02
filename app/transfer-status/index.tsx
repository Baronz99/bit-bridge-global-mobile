import React, { useEffect, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { verifyTransfer } from '@/api/account'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const TransferStatusScreen = () => {
  const router = useRouter()
  const { transfer_id } = useLocalSearchParams<{ transfer_id?: string }>()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  const handleVerify = async () => {
    if (!transfer_id) {
      setNotice({ message: 'Missing transfer ID.', error: true, data: null })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await verifyTransfer(String(transfer_id))
      setResult(response?.data || response)
      setNotice({
        message: response?.message || 'Transfer verified.',
        error: false,
        data: response?.data || null,
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
        fallback: error?.message || 'Something went wrong',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (transfer_id) {
      handleVerify()
    }
  }, [transfer_id])

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="pt-10">
        <Text className="text-white text-2xl mb-2">Transfer Status</Text>
        <Text className="text-gray-300 mb-6">Verify the status of your transfer.</Text>

        <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

        {result && (
          <View className="bg-gray-900 rounded-xl p-4 mt-4">
            <Text className="text-white mb-1">Result</Text>
            <Text className="text-gray-300">Status: {result?.status || 'N/A'}</Text>
            {result?.amount !== undefined && (
              <Text className="text-gray-300">Amount: {result.amount}</Text>
            )}
            {result?.reference && (
              <Text className="text-gray-400">Reference: {result.reference}</Text>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={handleVerify}
          className={`${transfer_id ? 'bg-gray-900' : 'bg-gray-700'} py-6 mt-6 rounded-xl`}
          disabled={!transfer_id}
        >
          <Text className="text-white font-medium text-center">Refresh Status</Text>
        </TouchableOpacity>
      </View>
      <Loader open={loading} />
    </View>
  )
}

export default TransferStatusScreen
