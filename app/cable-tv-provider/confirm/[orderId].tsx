import { Linking, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import useFetch from '@/services/useFetch'
import { confirmBillPayment, getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'

import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import Summary from '@/components/cards/Summary'
import AppModal from '@/components/modal/Modal'

const CableetailConfirm = () => {
  const { orderId } = useLocalSearchParams()
  const [loader, setLoader] = useState(false)
  const [pendingRetry, setPendingRetry] = useState(false)
  const [lastPaymentMethod, setLastPaymentMethod] = useState<string | null>(null)
  const { loadProfile } = useAuth()
  const { notification, setNotification } = useNotification()

  const fetchOrder = useCallback(() => getPurchaseOrder(orderId as string), [orderId])
  const { data } = useFetch(fetchOrder)

  const handleCardConfirmation = async (payment_method: string) => {
    setLastPaymentMethod(payment_method)
    setLoader(true)

    try {
      const response = await confirmBillPayment({ queryId: orderId as string, payment_method })
      setLoader(false)

      if (response?.pending || response?.status === 'pending') {
        setPendingRetry(true)
        setNotification({
          error: true,
          message:
            response?.message ||
            'Payment confirmation is still processing. Please retry shortly.',
          data: null,
        })
        return
      }

      if (payment_method === 'card') {
        Linking.openURL(response.responseBody.checkoutUrl)
      }

      setNotification({
        error: false,
        message: response?.message || 'Recharge Successful',
        data: null,
      })

      loadProfile()
    } catch (error: any) {
      setLoader(false)
      setPendingRetry(false)
      setNotification({
        error: true,
        message: error.message || 'something went wrong',
        data: null,
      })
    }
  }

  return (
    <View className="flex-1 px-4 bg-primary w-full">
      <View className="mb-6">
        <Text className="text-2xl font-bold text-white text-center">
          Confirm Cable Subsccription
        </Text>
        <Text className="text-sm text-white text-center mt-1">
          Please verify the transaction details below.
        </Text>
      </View>

      <View className="bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">TV Details</Text>

        <Summary data={data} applyCommission={false} />
      </View>

      <TouchableOpacity
        onPress={() => handleCardConfirmation('wallet')}
        className="border rounded-md mt-4 border-alt py-5 "
      >
        <Text className="text-alt text-center">Pay from Wallet </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleCardConfirmation('card')}
        className="border rounded-md mt-4 border-green-400 py-5 "
      >
        <Text className="text-green-400 text-center">Pay from Bank </Text>
      </TouchableOpacity>
      <Loader open={loader} />

      <AppModal
        open={!!notification.message}
        onclose={() => {
          setPendingRetry(false)
          setNotification({ message: null, error: false, data: null })
        }}
      >
        <NotificationAlert
          onPress={() => {
            setPendingRetry(false)
            setNotification({ message: null, error: false, data: null })
          }}
          message={notification.message}
          error={notification.error}
          data={notification.data}
        />
        {pendingRetry && lastPaymentMethod ? (
          <TouchableOpacity
            onPress={() => handleCardConfirmation(lastPaymentMethod)}
            className="border rounded-md mt-4 border-alt py-4"
          >
            <Text className="text-alt text-center">Retry Confirmation</Text>
          </TouchableOpacity>
        ) : null}
      </AppModal>
    </View>
  )
}

export default CableetailConfirm
