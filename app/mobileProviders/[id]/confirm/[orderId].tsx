import { View, Text, Linking, TouchableOpacity, Animated, Alert } from 'react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import resolveBillOrderId from '@/utils/resolveBillOrderId'
import { log } from '@/utils/log'

const ConfirmScreen = () => {
  const { orderId } = useLocalSearchParams()
  const routeOrderId = String(orderId || '').trim()

  if (__DEV__) {
    log('[CONFIRM_SCREEN] params', { orderId })
  }

  const [loader, setLoader] = useState(false)
  const [pendingRetry, setPendingRetry] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastPaymentMethod, setLastPaymentMethod] = useState<string | null>(null)
  const { notification, setNotification } = useNotification()
  const confirmingRef = useRef(false)
  const [resolvedBillOrderId, setResolvedBillOrderId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [applyCommission, setApplyCommission] = useState(false)
  const translateX = useRef(new Animated.Value(0)).current
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)
  const router = useRouter()

  const { userProfileData, loadProfile } = useAuth()
  const [textInfo] = useState('')

  const fetchOrder = useCallback(() => {
    if (!routeOrderId) return Promise.resolve(null)
    return getPurchaseOrder(routeOrderId)
  }, [routeOrderId])
  const { data, loading } = useFetch<any>(fetchOrder)

  const toggleSwitch = () => {
    Animated.timing(translateX, {
      toValue: applyCommission ? 50 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start()
    setApplyCommission((prev) => {
      const next = !prev
      if (__DEV__) {
        log('[BONUS] mobile toggle', { next })
      }
      return next
    })
  }

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

  const generateIdempotencyKey = () => {
    try {
      if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
    } catch {
      // ignored
    }
    return `${Date.now()}-${Math.random()}`
  }

  const getStableIdempotencyKey = useCallback(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey()
    }
    return idempotencyKeyRef.current
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setResolveError(null)
      try {
        const id = await resolveBillOrderId({ routeOrderId, data })
        if (__DEV__) {
          log('[CONFIRM] resolve bill_order_id', { routeOrderId, billOrderId: id })
        }
        if (!cancelled) setResolvedBillOrderId(id)
      } catch (e: any) {
        if (!cancelled) {
          setResolvedBillOrderId(null)
          setResolveError(e?.message || 'Missing bill_order_id for confirm')
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [data, routeOrderId])

  useEffect(() => {
    idempotencyKeyRef.current = null
  }, [resolvedBillOrderId])

  const handleConfirmation = useCallback(
    async (payment_method: string) => {
      if (confirmingRef.current) return
      if (!resolvedBillOrderId) {
        setNotification({
          error: true,
          message: resolveError || 'Missing bill order id. Please try again shortly.',
          data: null,
        })
        return
      }
      confirmingRef.current = true
      const idempotencyKey = getStableIdempotencyKey()
      setLastPaymentMethod(payment_method)
      setLoader(true)

      try {
        if (payment_method === 'card') {
          const initResponse = await initializeBillOrderPayment({
            queryId: String(resolvedBillOrderId),
            payment_method: 'card',
            redirect_url: `bitbridge://transaction/confirm?orderId=${resolvedBillOrderId}`,
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

        if (__DEV__) {
          log('[UI] idempotencyKey', idempotencyKey)
          log('[UI] applyCommission', applyCommission)
          log('[BONUS] mobile confirm', { payment_method, use_commission: applyCommission })
          log('[UI] confirm endpoint', {
            routeOrderId,
            billOrderId: resolvedBillOrderId,
            endpoint: `/bill_orders/${resolvedBillOrderId}/confirm_bill_payment`,
          })
        }
        const response = await confirmBillPayment({
          queryId: String(resolvedBillOrderId),
          payment_method,
          use_commission: applyCommission,
          idempotencyKey,
        })

        if (response?.pending || response?.status === 'pending' || response?.http_status === 202) {
          const nextOrderId = response?.ui?.order_id ?? response?.data?.id ?? response?.id ?? resolvedBillOrderId
          if (nextOrderId) {
            router.replace({
              pathname: '/transaction/confirm',
              params: { orderId: String(nextOrderId) },
            })
            resetPending()
            return
          }

          setPendingRetry(true)
          setNotification({
            error: true,
            message: response?.message || 'Payment pending. Please try again in a moment.',
            data: null,
          })
          return
        }

        if (payment_method === 'card' && response?.responseBody?.checkoutUrl) {
          Linking.openURL(response.responseBody.checkoutUrl)
        }

        const nextOrderId = response?.ui?.order_id ?? response?.data?.id ?? response?.id ?? resolvedBillOrderId
        if (nextOrderId) {
          router.replace({
            pathname: '/transaction/confirm',
            params: { orderId: String(nextOrderId) },
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
        const message =
          error?.response?.data?.message || error?.response?.data?.error || error?.message || 'something went wrong'
        if (__DEV__) {
          log('[UI] confirm bill error', error?.response?.data || error?.message)
        }
        Alert.alert('Payment failed', message)
        resetPending()
        setNotification({
          error: true,
          message,
          data: null,
        })
      } finally {
        setLoader(false)
        confirmingRef.current = false
      }
    },
    [loadProfile, resetPending, setNotification, applyCommission, resolvedBillOrderId, resolveError, routeOrderId, getStableIdempotencyKey]
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

  return (
    <View className="flex-1 p-4 bg-primary">
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Mobile</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Confirm Payment</Text>
        <Text className="text-gray-400 text-sm mt-2">Review the details before you pay.</Text>
      </View>

      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-6">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">Payment Summary</Text>

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
          <Text className="text-yellow-200 text-center">Payment pending. Please try again in a moment.</Text>
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
            params: { orderId: String(routeOrderId) },
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

export default ConfirmScreen
