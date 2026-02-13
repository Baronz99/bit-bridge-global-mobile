import { View, Text, Switch, TouchableOpacity, Alert } from 'react-native'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useNotification from '@/hooks/useNotification'
import useFetch from '@/services/useFetch'
import { useAuth } from '@/services/useAuth'
import { createBillPaymentIntent, executeBillPaymentIntent, getBillPaymentIntent, getPurchaseOrder } from '@/api/billOrder'
import Summary from '@/components/cards/Summary'
import Loader from '@/components/Loader'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'
import TransactionButtons from '@/components/transactionButtons/TransactionButtons'
import moneyFormat from '@/utils/moneyFormat'
import resolveBillOrderId from '@/utils/resolveBillOrderId'

const ConfirmDetails = () => {
  const { orderId, id, resume, intentId: routeIntentId } = useLocalSearchParams()
  const routeOrderId = String(orderId || '').trim()
  const [loader, setLoader] = useState(false)
  const [pendingRetry, setPendingRetry] = useState(false)
  const [pollingIntent, setPollingIntent] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartedAtRef = useRef<number | null>(null)
  const [applyCommission, setApplyCommission] = useState(false)
  const [resolvedBillOrderId, setResolvedBillOrderId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [intentId, setIntentId] = useState('')
  const [intentReady, setIntentReady] = useState(false)
  const [resumePolling, setResumePolling] = useState(false)
  const [resumeTimedOut, setResumeTimedOut] = useState(false)
  const [fundPrompt, setFundPrompt] = useState<{ open: boolean; shortfall: number }>({ open: false, shortfall: 0 })
  const resumePollCountRef = useRef(0)
  const { notification, setNotification } = useNotification()
  const router = useRouter()

  const { userProfileData, loadProfile } = useAuth()
  const walletBalanceValue = Number(userProfileData?.wallet?.balance ?? 0)

  const fetchOrder = useCallback(() => {
    if (!routeOrderId) return Promise.resolve(null)
    return getPurchaseOrder(routeOrderId)
  }, [routeOrderId])
  const { data } = useFetch<any>(fetchOrder)

  const statusRaw = String(data?.status || '').toLowerCase()
  const isElectricityVerificationPending =
    String(data?.service_type || '').toUpperCase() === 'ELECTRICITY' &&
    statusRaw === 'pending' &&
    !String(data?.name || '').trim()

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setResolveError(null)
      try {
        const resolvedId = await resolveBillOrderId({ routeOrderId, data })
        if (!cancelled) setResolvedBillOrderId(resolvedId)
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
    let cancelled = false
    const bootstrapIntent = async () => {
      if (!resolvedBillOrderId) return
      try {
        const routeIntent = String(routeIntentId || '').trim()
        if (routeIntent) {
          setIntentId(routeIntent)
          setIntentReady(true)
          return
        }
        const created = await createBillPaymentIntent(String(resolvedBillOrderId))
        const createdId = String(created?.id || '').trim()
        if (!cancelled && createdId) {
          setIntentId(createdId)
          setIntentReady(true)
        }
      } catch (e: any) {
        if (!cancelled) {
          setIntentReady(false)
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
  }, [resolvedBillOrderId, routeIntentId, setNotification])

  const clearPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollStartedAtRef.current = null
    setPollingIntent(false)
  }

  const resetPending = useCallback(() => {
    clearPolling()
    setPendingRetry(false)
    setPollTimedOut(false)
  }, [])

  const startIntentPolling = useCallback((intent: string, fallbackOrderId: string) => {
    clearPolling()
    setPollingIntent(true)
    setPollTimedOut(false)
    pollStartedAtRef.current = Date.now()
    pollTimerRef.current = setInterval(async () => {
      try {
        const latest = await getBillPaymentIntent(intent)
        const status = String(latest?.status || '').toLowerCase()
        if (status === 'completed') {
          clearPolling()
          router.push({
            pathname: '/transaction/confirm',
            params: { orderId: String(latest?.bill_order_id || fallbackOrderId) },
          })
          loadProfile({ force: true })
          return
        }
        if (status === 'failed' || status === 'refunded' || status === 'expired') {
          clearPolling()
          setNotification({
            error: true,
            message: `Bill payment ${status}.`,
            data: null,
          })
          return
        }
        if (pollStartedAtRef.current && Date.now() - pollStartedAtRef.current >= 45_000) {
          clearPolling()
          setPendingRetry(true)
          setPollTimedOut(true)
        }
      } catch {
        // keep polling until timeout
      }
    }, 2000)
  }, [loadProfile, router, setNotification])

  const handleConfirmation = useCallback(
    async (payment_method: string) => {
      const billTotal = Number(data?.total_amount ?? data?.amount ?? 0)
      const shortfall = Math.max(0, billTotal - walletBalanceValue)
      if (payment_method !== 'wallet') {
        setNotification({
          error: true,
          message: 'Bills can only be paid from wallet.',
          data: null,
        })
        return
      }
      if (!resolvedBillOrderId) {
        setNotification({
          error: true,
          message: resolveError || 'Missing bill order id',
          data: null,
        })
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
      if (!intentReady || !intentId) {
        setNotification({
          error: true,
          message: 'Bill payment is not ready yet. Please wait.',
          data: null,
        })
        return
      }
      if (shortfall > 0) {
        setFundPrompt({ open: true, shortfall })
        return
      }

      setLoader(true)

      try {
        const response = await executeBillPaymentIntent(String(intentId))

        if (response?.pending || response?.status === 'pending' || response?.http_status === 202) {
          setPendingRetry(true)
          startIntentPolling(String(intentId), String(resolvedBillOrderId))
          setNotification({
            error: true,
            message: response?.message || 'Payment pending. We are checking status...',
            data: null,
          })
          return
        }

        const nextOrderId = response?.ui?.order_id ?? response?.data?.id ?? response?.id ?? resolvedBillOrderId
        router.push({
          pathname: '/transaction/confirm',
          params: { orderId: String(nextOrderId) },
        })
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
        const message =
          error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Something went wrong'
        Alert.alert('Payment failed', message)
        resetPending()
        setNotification({ error: true, message, data: null })
      } finally {
        setLoader(false)
      }
    },
    [
      data?.amount,
      data?.total_amount,
      intentId,
      intentReady,
      isElectricityVerificationPending,
      loadProfile,
      resetPending,
      resolveError,
      resolvedBillOrderId,
      router,
      setNotification,
      walletBalanceValue
    ]
  )

  useEffect(() => {
    if (String(resume || '') !== '1') return
    if (!intentReady || !intentId) return
    startIntentPolling(String(intentId), String(resolvedBillOrderId || routeOrderId))
    setResumePolling(true)
    setResumeTimedOut(false)
    resumePollCountRef.current = 0
  }, [intentId, intentReady, resolvedBillOrderId, resume, routeOrderId, startIntentPolling])

  useEffect(() => {
    if (!resumePolling) return
    const billTotal = Number(data?.total_amount ?? data?.amount ?? 0)
    if (billTotal > 0 && walletBalanceValue >= billTotal) {
      setResumePolling(false)
      handleConfirmation('wallet')
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
  }, [resumePolling, walletBalanceValue, data?.total_amount, data?.amount, loadProfile, handleConfirmation])

  useEffect(() => () => clearPolling(), [])

  return (
    <View className="flex-1 p-4 bg-primary">
      <View className="mb-6">
        <Text className="text-2xl font-bold text-white text-center">Confirm Payment</Text>
        <Text className="text-sm text-white text-center mt-1">Review the details before you pay.</Text>
      </View>

      <View className="bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">Payment Summary</Text>
        <Summary data={data} applyCommission={applyCommission} />
      </View>

      <View className="flex-row justify-between items-center mb-3">
        <View>
          <Text className="text-sm text-gray-200">Balance</Text>
          <Text className="text-2xl font-bold mt-1 text-white">{moneyFormat(userProfileData?.wallet?.balance)}</Text>
        </View>
        <View className="flex-row items-center bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
          <Text className="text-xs text-amber-600 font-semibold mr-2">Bonus</Text>
          <Text className="text-sm font-medium text-amber-800">{moneyFormat(userProfileData?.wallet?.commission ?? 0)}</Text>
        </View>
      </View>

      {(data?.service_type === 'VTU' || data?.service_type === 'DATA') && (
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xs text-gray-200">Use Commission?</Text>
            <Text className="text-sm font-medium text-alt -800">{moneyFormat(data?.bill_commission)} Amount to pay</Text>
          </View>
          <Switch
            value={applyCommission}
            onValueChange={() => setApplyCommission((v) => !v)}
            trackColor={{ false: '#767577', true: '#34d399' }}
            thumbColor={applyCommission ? '#fff' : '#f4f3f4'}
          />
        </View>
      )}

      {isElectricityVerificationPending ? (
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3">
          <Text className="text-blue-200 text-center">Verifying meter details with provider. Please wait...</Text>
        </View>
      ) : null}

      {pendingRetry ? (
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
          <Text className="text-yellow-200 text-center">Payment pending. We are checking status.</Text>
          {pollingIntent ? (
            <Text className="text-yellow-100 text-center mt-2">Checking every 2s (up to 45s)...</Text>
          ) : null}
          {pollTimedOut ? (
            <TouchableOpacity
              onPress={() => {
                startIntentPolling(String(intentId), String(resolvedBillOrderId || routeOrderId))
              }}
              className="border rounded-md mt-3 border-alt py-3"
            >
              <Text className="text-alt text-center">Check status</Text>
            </TouchableOpacity>
          ) : null}
          {pollTimedOut ? (
            <TouchableOpacity onPress={() => router.push('/utility/power')} className="border rounded-md mt-3 border-gray-600 py-3">
              <Text className="text-gray-300 text-center">Back to bills</Text>
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

      <TransactionButtons
        handleConfirmation={handleConfirmation}
        walletOnly
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
                  returnTo: '/transaction/details',
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

      <AppModal open={!!notification?.message} onclose={() => setNotification({ message: null, error: false, data: null })}>
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

export default ConfirmDetails
