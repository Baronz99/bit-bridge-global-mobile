import { Linking, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { confirmBillPayment, confirmPayment, getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'
import { images } from '@/constants/images'
import { AntDesign } from '@expo/vector-icons'
import { gifs } from '@/constants/gifs'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import Summary from '@/components/cards/Summary'
import TransactionButtons from '@/components/transactionButtons/TransactionButtons'

const CableetailConfirm = () => {
  const { orderId } = useLocalSearchParams()
  const [loader, setLoader] = useState(false)
  const [pendingRetry, setPendingRetry] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastPaymentMethod, setLastPaymentMethod] = useState<string | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { loadProfile } = useAuth()
  const { notification, setNotification } = useNotification()

  const fetchOrder = useCallback(() => getPurchaseOrder(orderId as string), [orderId])
  const { data } = useFetch(fetchOrder)

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }

  const resetPending = useCallback(() => {
    clearRetryTimer()
    setPendingRetry(false)
    setRetryCount(0)
  }, [])

  const handleCardConfirmation = useCallback(async (payment_method: string) => {
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
            response?.message || 'Payment pending. Please try again in a moment.',
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

      resetPending()
      loadProfile()
    } catch (error: any) {
      setLoader(false)
      resetPending()
      setNotification({
        error: true,
        message: error.message || 'something went wrong',
        data: null,
      })
    }
  }, [loadProfile, orderId, resetPending, setNotification])

  useEffect(() => {
    if (!pendingRetry || !lastPaymentMethod) return
    if (retryCount >= 3) return
    clearRetryTimer()
    retryTimerRef.current = setTimeout(() => {
      setRetryCount((count) => count + 1)
      handleCardConfirmation(lastPaymentMethod)
    }, 5000)
    return () => {
      clearRetryTimer()
    }
  }, [handleCardConfirmation, lastPaymentMethod, pendingRetry, retryCount])

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
      {pendingRetry ? (
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
          <Text className="text-yellow-200 text-center">
            Payment pending. Please try again in a moment.
          </Text>
          {lastPaymentMethod ? (
            <TouchableOpacity
              onPress={() => {
                setRetryCount(0)
                handleCardConfirmation(lastPaymentMethod)
              }}
              className="border rounded-md mt-3 border-alt py-3"
            >
              <Text className="text-alt text-center">Retry Confirmation</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <TransactionButtons handleConfirmation={handleCardConfirmation} />
      {loader && <Loader open={loader} />}
      <NotificationAlert
        message={notification.message}
        error={notification.error}
        data={notification.data}
      />
    </View>
  )
}

export default CableetailConfirm
