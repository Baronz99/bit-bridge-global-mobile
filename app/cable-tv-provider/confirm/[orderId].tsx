import { Linking, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { confirmBillPayment, getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'

import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import Summary from '@/components/cards/Summary'
import AppModal from '@/components/modal/Modal'
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
  const router = useRouter()

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

  const handleCardConfirmation = useCallback(
    async (payment_method: string) => {
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

        if (response?.data?.id || orderId) {
          router.push({
            pathname: '/transaction/confirm',
            params: { orderId: String(response?.data?.id || orderId) },
          })
        }

        setNotification({
          error: false,
          message: response?.message || 'Recharge Successful',
          data: null,
        })

        resetPending()
        loadProfile({ force: true })
      } catch (error: any) {
        setLoader(false)
        resetPending()
        setNotification({
          error: true,
          message: error.message || 'something went wrong',
          data: null,
        })
      }
    },
    [loadProfile, orderId, resetPending, setNotification]
  )

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
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Utilities</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Confirm Payment</Text>
        <Text className="text-gray-400 text-sm mt-2">
          Review the details before you pay.
        </Text>
      </View>

      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-6">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">
          Payment Summary
        </Text>
        <Summary data={data} applyCommission={false} />
      </View>

      {pendingRetry ? (
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-4">
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

      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/transaction/confirm',
            params: { orderId: String(orderId) },
          })
        }
        className="border rounded-md mt-4 border-gray-700 py-4"
      >
        <Text className="text-gray-300 text-center">View Receipt</Text>
      </TouchableOpacity>
      <Loader open={loader} />

      <AppModal
        open={!!notification.message}
        onclose={() => {
          resetPending()
          setNotification({ message: null, error: false, data: null })
        }}
      >
        <NotificationAlert
          onPress={() => {
            resetPending()
            setNotification({ message: null, error: false, data: null })
          }}
          message={notification.message}
          error={notification.error}
          data={notification.data}
        />
      </AppModal>
    </View>
  )
}

export default CableetailConfirm
