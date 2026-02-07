import { View, Text, Linking, Switch, TouchableOpacity, Alert } from 'react-native'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useNotification from '@/hooks/useNotification'
import useFetch from '@/services/useFetch'
import { useAuth } from '@/services/useAuth'
import { confirmBillPayment, getPurchaseOrder, initializeBillOrderPayment } from '@/api/billOrder'
import Summary from '@/components/cards/Summary'
import Loader from '@/components/Loader'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'
import TransactionButtons from '@/components/transactionButtons/TransactionButtons'
import moneyFormat from '@/utils/moneyFormat'
import { log } from '@/utils/log'
const confirmDetails = () => {
  const { orderId } = useLocalSearchParams()
  const [loader, setLoader] = useState(false)
  const [pendingRetry, setPendingRetry] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastPaymentMethod, setLastPaymentMethod] = useState<string | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)
  const { notification, setNotification } = useNotification()
  const [applyCommission, setApplyCommission] = useState(false)
  const router = useRouter()
  const toggleSwitch = () => {
    // Animated.timing(translateX, {
    //   toValue: applyCommission ? 60 : 0,
    //   duration: 300,
    //   useNativeDriver: true
    // }).start();
    setApplyCommission((prev) => {
      const next = !prev
      if (__DEV__) {
        log('[BONUS] toggle', { next })
      }
      return next
    })
  }

  const { userProfileData, loadProfile } = useAuth()
  const [textInfo, setTextInfo] = useState('')
  const confirmingRef = useRef(false)

  const generateIdempotencyKey = () => {
    try {
      if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
    } catch {
      // ignore
    }
    return `${Date.now()}-${Math.random()}`
  }

  const getStableIdempotencyKey = useCallback(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey()
    }
    return idempotencyKeyRef.current
  }, [])

  const fetchOrder = useCallback(() => getPurchaseOrder(orderId as string), [orderId])
  const { data, refetch } = useFetch(fetchOrder)
  // const [getstarted, setOpenStarted] = useState(false)

  useEffect(() => {
    idempotencyKeyRef.current = null
  }, [orderId])

  const statusRaw = String(data?.status || '').toLowerCase()
  const isElectricityVerificationPending =
    String(data?.service_type || '').toUpperCase() === 'ELECTRICITY' &&
    statusRaw === 'pending' &&
    !String(data?.name || '').trim()

  useEffect(() => {
    if (!isElectricityVerificationPending) return
    const timer = setInterval(() => {
      refetch?.()
    }, 4000)
    return () => clearInterval(timer)
  }, [isElectricityVerificationPending, refetch])

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
      if (confirmingRef.current) return
      const queryId = String(orderId || '').trim()
      if (!queryId) {
        setNotification({ error: true, message: 'Missing order id', data: null })
        return
      }
      if (isElectricityVerificationPending) {
        setNotification({
          error: true,
          message: 'Meter verification still in progress. Please wait a few seconds.',
          data: null,
        })
        return
      }

      confirmingRef.current = true
      setLoader(true)
      setLastPaymentMethod(payment_method)

      try {
        if (payment_method === 'card') {
          const initResponse = await initializeBillOrderPayment({
            queryId,
            payment_method: 'card',
            redirect_url: `bitbridge://transaction/confirm?orderId=${queryId}`,
            use_commission: applyCommission,
          })
          const checkoutUrl = initResponse?.responseBody?.checkoutUrl
          if (!checkoutUrl) {
            throw new Error(initResponse?.message || 'Unable to initialize card payment')
          }
          await Linking.openURL(checkoutUrl)
          setNotification({
            error: false,
            message: 'Card payment initialized. Complete payment in checkout.',
            data: null,
          })
          resetPending()
          return
        }

        const idempotencyKey = getStableIdempotencyKey()
        const response = await confirmBillPayment({
          queryId,
          payment_method,
          use_commission: applyCommission,
          idempotencyKey,
        })

        if (response?.pending || response?.status === 'pending' || response?.http_status === 202) {
          const nextOrderId = response?.ui?.order_id ?? response?.data?.id ?? response?.id ?? queryId
          setPendingRetry(true)
          router.push({
            pathname: '/transaction/confirm',
            params: { orderId: String(nextOrderId) },
          })
          return
        }

        const nextOrderId = response?.ui?.order_id ?? response?.data?.id ?? response?.id ?? queryId
        router.push({
          pathname: '/transaction/confirm',
          params: { orderId: String(nextOrderId) },
        })
        setNotification({
          error: false,
          message: response?.message || 'Recharge Successful',
          data: null,
        })
        resetPending()
        loadProfile({ force: true })
      } catch (error: any) {
        const message =
          error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Something went wrong'
        Alert.alert('Payment failed', message)
        resetPending()
        setNotification({ error: true, message, data: null })
      } finally {
        setLoader(false)
        confirmingRef.current = false
      }
    },
    [
      orderId,
      applyCommission,
      loadProfile,
      resetPending,
      router,
      setNotification,
      getStableIdempotencyKey,
      isElectricityVerificationPending,
    ]
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
  log(applyCommission, '[Data info]')
  return (
    <View className="flex-1 p-4 bg-primary">
      <View className="mb-6">
        <Text className="text-2xl font-bold text-white text-center">Confirm Payment</Text>
        <Text className="text-sm text-white text-center mt-1">
          Review the details before you pay.
        </Text>
      </View>

      <View className="bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">
          Payment Summary
        </Text>

        <Summary data={data} applyCommission={applyCommission} />
      </View>

      <View className="flex-row justify-between items-center mb-3">
        <View>
          <Text className="text-sm text-gray-200">Balance</Text>
          <Text className="text-2xl font-bold mt-1 text-white">
            {moneyFormat(userProfileData?.wallet?.balance)}
          </Text>
        </View>

        {/* Commission badge */}
        <View className="flex-row items-center bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
          <Text className="text-xs text-amber-600 font-semibold mr-2">Bonus</Text>
          <Text className="text-sm font-medium text-amber-800">
            {moneyFormat(userProfileData?.wallet?.commission ?? 0)}
          </Text>
        </View>
      </View>

      {/* Action row */}

      {(data?.service_type === 'VTU' || data?.service_type === 'DATA') && (
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xs text-gray-200">Use Commission?</Text>
            <Text className="text-sm font-medium text-alt -800">
              {moneyFormat(data?.bill_commission)} Amount to pay
            </Text>
          </View>

          <Switch
            value={applyCommission}
            onValueChange={toggleSwitch}
            trackColor={{ false: '#767577', true: '#34d399' }} // gray → green
            thumbColor={applyCommission ? '#fff' : '#f4f3f4'}
          />
        </View>
      )}
      <Text className="text-white text-center">{textInfo}</Text>

      {isElectricityVerificationPending ? (
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3">
          <Text className="text-blue-200 text-center">
            Verifying meter details with provider. Please wait...
          </Text>
        </View>
      ) : null}

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

      <TransactionButtons
        handleConfirmation={handleConfirmation}
        disabled={loader || pendingRetry || isElectricityVerificationPending}
      />

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
        onclose={() => setNotification({ message: null, error: false, data: null })}
      >
        <NotificationAlert
          onPress={() => setNotification({ message: null, error: false, data: null })}
          message={notification?.message}
          error={notification.error}
          data={notification.data}
        />
      </AppModal>
    </View>
  )
}

export default confirmDetails
