import { View, Text, Linking, TouchableOpacity, Animated } from 'react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useNotification from '@/hooks/useNotification'
import useFetch from '@/services/useFetch'
import { useAuth } from '@/services/useAuth'
import { confirmBillPayment, getPurchaseOrder } from '@/api/billOrder'
import Summary from '@/components/cards/Summary'
import Loader from '@/components/Loader'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'
import TransactionButtons from '@/components/transactionButtons/TransactionButtons'
import moneyFormat from '@/utils/moneyFormat'

const confirm = () => {
  const { orderId } = useLocalSearchParams()
  const [loader, setLoader] = useState(false)
  const [pendingRetry, setPendingRetry] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastPaymentMethod, setLastPaymentMethod] = useState<string | null>(null)
  const { notification, setNotification } = useNotification()
  const [applyCommission, setApplyCommission] = useState(false)
  const translateX = useRef(new Animated.Value(0)).current
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const toggleSwitch = () => {
    Animated.timing(translateX, {
      toValue: applyCommission ? 50 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start()
    setApplyCommission(!applyCommission)
  }

  const { userProfileData, loadProfile } = useAuth()
  const [textInfo, setTextInfo] = useState('')

  const fetchOrder = useCallback(() => getPurchaseOrder(orderId as string), [orderId])
  const { data, loading } = useFetch(fetchOrder)

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

  const handleConfirmation = useCallback(
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
      handleConfirmation(lastPaymentMethod)
    }, 5000)
    return () => {
      clearRetryTimer()
    }
  }, [handleConfirmation, lastPaymentMethod, pendingRetry, retryCount])

  const commissionValue = useMemo(
    () => Number((data?.amount * data?.commissionRate).toFixed(2)),
    [data]
  )

  const handlePress = async () => {
    if (loading) return
  }

  return (
    <View className="flex-1 p-4 bg-primary">
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Mobile</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Confirm Payment</Text>
        <Text className="text-gray-400 text-sm mt-2">Review the details before you pay.</Text>
      </View>

      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-6">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">
          Payment Summary
        </Text>

        <Summary data={data} applyCommission={applyCommission} />
      </View>

      <View className="flex-row justify-between items-center mt-4">
        <View>
          <Text className="text-xs text-gray-400">Balance</Text>
          <Text className="text-xl font-semibold mt-1 text-white">
            {moneyFormat(userProfileData?.wallet?.balance)}
          </Text>
        </View>

        <View className="flex-row items-center bg-gray-900 border border-gray-800 px-3 py-1 rounded-full">
          <Text className="text-xs text-gray-300 font-semibold mr-2">Bonus</Text>
          <Text className="text-sm font-medium text-white">
            {moneyFormat(userProfileData?.wallet?.commission ?? 0)}
          </Text>
        </View>
      </View>

      {data?.service_type === 'VTU' ||
        (data?.service_type === 'DATA' && (
          <View className="flex-row items-center justify-between mt-4">
            <View className="flex-1">
              <Text className="text-xs text-gray-300">Use Commission?</Text>
              <Text className="text-sm font-medium text-alt">
                {moneyFormat(data?.bill_commission)} Amount to pay
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityLabel="Trigger commission"
              accessibilityRole="button"
              disabled={loading}
              onPress={toggleSwitch}
              className="relative border border-gray-800 bg-gray-900"
              style={{
                height: 30,
                width: 100,
                borderRadius: 25,
                justifyContent: 'center',
                padding: 5,
              }}
            >
              <Animated.View
                className="h-6 w-10 rounded-full bg-app-primary top-0 relative translate-x-0"
                style={{ transform: [{ translateX }] }}
              />
            </TouchableOpacity>
          </View>
        ))}
      <Text className="text-white text-center">{textInfo}</Text>

      {pendingRetry ? (
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
          <Text className="text-yellow-200 text-center">
            Payment pending. Please try again in a moment.
          </Text>
          {lastPaymentMethod ? (
            <TouchableOpacity
              onPress={() => {
                setRetryCount(0)
                handleConfirmation(lastPaymentMethod)
              }}
              className="border rounded-md mt-3 border-alt py-3"
            >
              <Text className="text-alt text-center">Retry Confirmation</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <TransactionButtons handleConfirmation={handleConfirmation} />

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
        open={!!notification?.message}
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
          message={notification?.message}
          error={notification.error}
          data={notification.data}
        />
      </AppModal>
    </View>
  )
}

export default confirm
