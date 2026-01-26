import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import { fundCircle } from '@/api/circles'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const CircleFundScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
  })
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  const handleOpenPin = async () => {
    const amountValue = Number(String(formData.amount).replace(/[^0-9.]/g, ''))
    if (!circleId) {
      setNotice({ message: 'Missing circle ID.', error: true, data: null })
      return
    }
    if (!amountValue || Number.isNaN(amountValue)) {
      setNotice({ message: 'Amount is required.', error: true, data: null })
      return
    }

    try {
      const status = await getTransactionPinStatus()
      const payload = status?.data ?? status
      const hasPin =
        payload?.has_pin === true ||
        payload?.status === 'set' ||
        payload?.pin_set === true
      if (!hasPin) {
        setNotice({
          message: 'Set your transaction PIN to continue.',
          error: true,
          data: null,
        })
        router.push('/settings/pin/set')
        return
      }
    } catch (error: any) {
      const statusCode = error?.response?.status
      if (statusCode === 401) {
        await onLogout()
        router.replace('/login')
        return
      }
    }

    setPinError(null)
    setPinModalOpen(true)
  }

  const handleSubmit = async (transactionPin: string) => {
    const amountValue = Number(String(formData.amount).replace(/[^0-9.]/g, ''))
    if (!circleId || !amountValue || Number.isNaN(amountValue)) {
      setNotice({ message: 'Amount is required.', error: true, data: null })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await fundCircle(circleId, {
        amount_cents: Math.round(amountValue * 100),
        note: formData.description.trim() || undefined,
        transaction_pin: transactionPin,
      })
      setPinModalOpen(false)
      setFormData({ amount: '', description: '' })
      setNotice({
        message: response?.message || 'Circle funded successfully.',
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
      setPinError(message)
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-10">
          <Text className="text-white text-2xl mb-2">Fund Circle</Text>
          <Text className="text-gray-300 mb-6">Add money to this circle.</Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <FormInput
            label="Amount"
            value={formData.amount}
            name="amount"
            keyboardType="numeric"
            onChangeText={(text: string) => setFormData({ ...formData, amount: text })}
          />

          <FormInput
            label="Description (optional)"
            value={formData.description}
            name="description"
            onChangeText={(text: string) => setFormData({ ...formData, description: text })}
          />

          <TouchableOpacity
            onPress={handleOpenPin}
            className="bg-theme-primary py-6 mt-6 rounded-xl"
          >
            <Text className="text-alt font-medium text-center">Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        errorMessage={pinError}
        title="Enter PIN to Fund"
      />

      <Loader open={loading} />
    </View>
  )
}

export default CircleFundScreen
