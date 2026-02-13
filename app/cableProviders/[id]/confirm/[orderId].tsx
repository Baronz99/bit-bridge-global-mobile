import { Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { createBillPaymentIntent, executeBillPaymentIntent, getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import Summary from '@/components/cards/Summary'
import TransactionButtons from '@/components/transactionButtons/TransactionButtons'
import AppModal from '@/components/modal/Modal'
import moneyFormat from '@/utils/moneyFormat'

const CableetailConfirm = () => {
  const { orderId, id, resume, intentId: routeIntentId } = useLocalSearchParams()
  const [loader, setLoader] = useState(false)
  const [pendingRetry, setPendingRetry] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastPaymentMethod, setLastPaymentMethod] = useState<string | null>(null)
  const [intentId, setIntentId] = useState('')
  const [intentReady, setIntentReady] = useState(false)
  const [resumePolling, setResumePolling] = useState(false)
  const [resumeTimedOut, setResumeTimedOut] = useState(false)
  const [fundPrompt, setFundPrompt] = useState<{ open: boolean; shortfall: number }>({ open: false, shortfall: 0 })
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resumePollCountRef = useRef(0)
  const { loadProfile, userProfileData } = useAuth()
  const { notification, setNotification } = useNotification()
  const router = useRouter()
  const walletBalanceValue = Number(userProfileData?.wallet?.balance ?? 0)

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

  useEffect(() => {
    let cancelled = false
    const bootstrapIntent = async () => {
      const routeIntent = String(routeIntentId || '').trim()
      if (routeIntent) {
        setIntentId(routeIntent)
        setIntentReady(true)
        return
      }
      try {
        const created = await createBillPaymentIntent(String(orderId || ''))
        const createdId = String(created?.id || '').trim()
        if (!cancelled && createdId) {
          setIntentId(createdId)
          setIntentReady(true)
        }
      } catch (e: any) {
        if (!cancelled) {
          setNotification({
            error: true,
            message: e?.message || 'Unable to initialize bill payment.',
            data: null,
          })
        }
      }
    }
    void bootstrapIntent()
    return () => {
      cancelled = true
    }
  }, [orderId, routeIntentId, setNotification])

  const handleCardConfirmation = useCallback(async (payment_method: string) => {
    setLastPaymentMethod('wallet')
    if (payment_method !== 'wallet') {
      setNotification({
        error: true,
        message: 'Bills can only be paid from wallet.',
        data: null,
      })
      return
    }
    if (!intentReady || !intentId) {
      setNotification({
        error: true,
        message: 'Bill payment is not ready yet. Please wait.',
        data: null,
      })
      return
    }
    const billTotal = Number(data?.total_amount ?? data?.amount ?? 0)
    const shortfall = Math.max(0, billTotal - walletBalanceValue)
    if (shortfall > 0) {
      setFundPrompt({ open: true, shortfall })
      return
    }
    setLoader(true)

    try {
      const response = await executeBillPaymentIntent(intentId)
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

      setResumePolling(false)
      setResumeTimedOut(false)
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
  }, [data?.amount, data?.total_amount, intentId, intentReady, loadProfile, orderId, resetPending, setNotification, walletBalanceValue])

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

  useEffect(() => {
    if (String(resume || '') !== '1') return
    if (!intentReady || !intentId) return
    setResumePolling(true)
    setResumeTimedOut(false)
    resumePollCountRef.current = 0
  }, [resume, intentReady, intentId])

  useEffect(() => {
    if (!resumePolling) return
    const billTotal = Number(data?.total_amount ?? data?.amount ?? 0)
    if (billTotal > 0 && walletBalanceValue >= billTotal) {
      setResumePolling(false)
      handleCardConfirmation('wallet')
      return
    }

    const timer = setInterval(() => {
      resumePollCountRef.current += 1
      loadProfile({ force: true })
      if (resumePollCountRef.current >= 10) {
        clearInterval(timer)
        setResumePolling(false)
        setResumeTimedOut(true)
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [resumePolling, walletBalanceValue, data?.total_amount, data?.amount, loadProfile, handleCardConfirmation])

  return (
    <View className="flex-1 px-4 bg-primary w-full">
      <View className="mb-6">
        <Text className="text-2xl font-bold text-white text-center">Confirm Payment</Text>
        <Text className="text-sm text-white text-center mt-1">
          Review the details before you pay.
        </Text>
      </View>

      <View className="bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">Payment Summary</Text>

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
      {resumePolling ? (
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3">
          <Text className="text-blue-200 text-center">
            Checking wallet funding status. We will resume payment automatically.
          </Text>
        </View>
      ) : null}

      {resumeTimedOut ? (
        <View className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3">
          <Text className="text-gray-200 text-center">
            Wallet balance is still insufficient. Your intent remains awaiting funds.
          </Text>
        </View>
      ) : null}
      <TransactionButtons handleConfirmation={handleCardConfirmation} walletOnly />
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
      {loader && <Loader open={loader} />}
      <AppModal open={fundPrompt.open} onclose={() => setFundPrompt({ open: false, shortfall: 0 })}>
        <View className="bg-primary rounded-xl p-4">
          <Text className="text-white text-lg font-semibold mb-2">Insufficient Wallet Balance</Text>
          <Text className="text-gray-300 mb-4">
            You need {moneyFormat(fundPrompt.shortfall)} more to complete this bill payment.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setFundPrompt({ open: false, shortfall: 0 })
              router.push({
                pathname: '/fundWallet',
                params: {
                  returnTo: '/cableProviders/[id]/confirm/[orderId]',
                  id: String(id || ''),
                  orderId: String(orderId || ''),
                  intentId: String(intentId || '')
                }
              })
            }}
            className="bg-theme-primary rounded-lg py-3"
          >
            <Text className="text-alt text-center font-semibold">Fund Wallet</Text>
          </TouchableOpacity>
        </View>
      </AppModal>
      <NotificationAlert
        message={notification.message}
        error={notification.error}
        data={notification.data}
      />
    </View>
  )
}

export default CableetailConfirm
