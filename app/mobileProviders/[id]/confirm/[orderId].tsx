import { Alert, Animated, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useNotification from '@/hooks/useNotification'
import useFetch from '@/services/useFetch'
import { useAuth } from '@/services/useAuth'
import { getPurchaseOrder } from '@/api/billOrder'
import Summary from '@/components/cards/Summary'
import Loader from '@/components/Loader'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'
import TransactionButtons from '@/components/transactionButtons/TransactionButtons'
import moneyFormat from '@/utils/moneyFormat'
import resolveBillOrderId from '@/utils/resolveBillOrderId'
import useBillPaymentIntentFlow from '@/hooks/useBillPaymentIntentFlow'
import useServiceAvailability from '@/hooks/useServiceAvailability'
import ServiceStatusPill from '@/components/service-availability/ServiceStatusPill'

const ConfirmScreen = () => {
  const { orderId, id, resume, intentId: routeIntentId } = useLocalSearchParams()
  const routeOrderId = String(orderId || '').trim()
  const resumeFlag = String(resume || '') === '1'
  const router = useRouter()
  const { notification, setNotification } = useNotification()
  const { userProfileData, loadProfile } = useAuth()
  const walletBalanceValue = Number(userProfileData?.wallet?.balance ?? 0)
  const [resolvedBillOrderId, setResolvedBillOrderId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [fundPrompt, setFundPrompt] = useState<{ open: boolean; shortfall: number }>({ open: false, shortfall: 0 })
  const [applyCommission, setApplyCommission] = useState(false)
  const translateX = useRef(new Animated.Value(0)).current
  const { getStatus } = useServiceAvailability()

  const { data, loading } = useFetch<any>(
    useCallback(() => {
      if (!routeOrderId) return Promise.resolve(null)
      return getPurchaseOrder(routeOrderId)
    }, [routeOrderId])
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setResolveError(null)
      try {
        const idValue = await resolveBillOrderId({ routeOrderId, data })
        if (!cancelled) setResolvedBillOrderId(idValue)
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

  const flow = useBillPaymentIntentFlow({
    billOrderId: resolvedBillOrderId,
    initialIntentId: String(routeIntentId || '').trim(),
    resumeFlag,
    onCompleted: (completedOrderId) => {
      router.replace({
        pathname: '/transaction/confirm',
        params: { orderId: String(completedOrderId || resolvedBillOrderId || routeOrderId) },
      })
      loadProfile({ force: true })
    },
  })

  const billTotal = useMemo(() => Number(data?.total_amount ?? data?.amount ?? 0), [data?.amount, data?.total_amount])

  const toggleSwitch = () => {
    Animated.timing(translateX, {
      toValue: applyCommission ? 50 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start()
    setApplyCommission((prev) => !prev)
  }

  const handleConfirmation = useCallback(
    async (paymentMethod: string) => {
      if (paymentMethod !== 'wallet') {
        setNotification({ error: true, message: 'Bills can only be paid from wallet.', data: null })
        return
      }
      if (!resolvedBillOrderId) {
        setNotification({ error: true, message: resolveError || 'Missing bill order id. Please try again.', data: null })
        return
      }

      const result = await flow.execute({
        billTotal,
        walletBalance: walletBalanceValue,
        useCommission: applyCommission,
      })
      if (result.kind === 'awaiting_funds') {
        setFundPrompt({ open: true, shortfall: result.shortfall })
        return
      }
      if (result.kind === 'failed') {
        Alert.alert('Payment failed', result.message || 'Bill payment failed')
        setNotification({ error: true, message: result.message || 'Bill payment failed', data: null })
      }
    },
    [applyCommission, billTotal, flow, resolveError, resolvedBillOrderId, setNotification, walletBalanceValue]
  )

  const selectedServiceStatus = useMemo(
    () => getStatus({ provider: data?.biller, serviceType: data?.service_type }),
    [data?.biller, data?.service_type, getStatus]
  )

  const pendingMessage =
    flow.uiState === 'timed_out'
      ? 'Payment is still processing. Check status or return to bills.'
      : flow.uiState === 'processing'
        ? flow.message || 'Payment pending. We are checking status.'
        : ''
  const canViewReceipt = flow.uiState === 'completed'

  return (
    <View className="flex-1 p-4 bg-primary">
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Mobile</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Confirm Payment</Text>
        <Text className="text-gray-400 text-sm mt-2">Review the details before you pay.</Text>
      </View>

      <View className="mt-3 mb-2 flex-row items-center justify-between rounded-xl border border-gray-800 bg-gray-900/70 px-3 py-2">
        <Text className="text-gray-300 text-xs">Service availability</Text>
        <ServiceStatusPill state={selectedServiceStatus.state} />
      </View>

      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-2">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">Payment Summary</Text>
        <Summary data={data} applyCommission={applyCommission} />
      </View>

      <View className="flex-row justify-between items-center mt-4">
        <View>
          <Text className="text-xs text-gray-400">Balance</Text>
          <Text className="text-xl font-semibold mt-1 text-white">{moneyFormat(userProfileData?.wallet?.balance)}</Text>
        </View>
        <View className="flex-row items-center bg-gray-900 border border-gray-800 px-3 py-1 rounded-full">
          <Text className="text-xs text-gray-300 font-semibold mr-2">Bonus</Text>
          <Text className="text-sm font-medium text-white">{moneyFormat(userProfileData?.wallet?.commission ?? 0)}</Text>
        </View>
      </View>

      {(data?.service_type === 'VTU' || data?.service_type === 'DATA') && (
        <View className="flex-row items-center justify-between mt-4">
          <View className="flex-1">
            <Text className="text-xs text-gray-300">Use Commission?</Text>
            <Text className="text-sm font-medium text-alt">{moneyFormat(data?.bill_commission)} Amount to pay</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityLabel="Trigger commission"
            accessibilityRole="button"
            onPress={toggleSwitch}
            className="relative border border-gray-800 bg-gray-900"
            style={{ height: 30, width: 100, borderRadius: 25, justifyContent: 'center', padding: 5 }}
          >
            <Animated.View className="h-6 w-10 rounded-full bg-app-primary top-0 relative translate-x-0" style={{ transform: [{ translateX }] }} />
          </TouchableOpacity>
        </View>
      )}

      {flow.uiState === 'processing' || flow.uiState === 'timed_out' ? (
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3 mt-3">
          <Text className="text-yellow-200 text-center">{pendingMessage}</Text>
          {flow.uiState === 'timed_out' ? (
            <>
              <TouchableOpacity onPress={() => flow.pollStatus()} className="border rounded-md mt-3 border-alt py-3">
                <Text className="text-alt text-center">Check status</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/utility/power')} className="border rounded-md mt-3 border-gray-600 py-3">
                <Text className="text-gray-300 text-center">Back to bills</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}

      {flow.uiState === 'failed' ? (
        <View className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3 mt-3">
          <Text className="text-red-200 text-center">{flow.message || 'Bill payment failed.'}</Text>
          <TouchableOpacity onPress={() => handleConfirmation('wallet')} className="border rounded-md mt-3 border-red-400 py-3">
            <Text className="text-red-200 text-center">Retry payment</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TransactionButtons handleConfirmation={handleConfirmation} walletOnly disabled={flow.isActionDisabled} />

      {canViewReceipt ? (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/transaction/confirm', params: { orderId: String(routeOrderId) } })}
          className="border rounded-md mt-4 border-gray-700 py-4"
        >
          <Text className="text-gray-300 text-center">View Receipt</Text>
        </TouchableOpacity>
      ) : null}

      <Loader open={flow.isBusy} />

      <AppModal open={fundPrompt.open} onclose={() => setFundPrompt({ open: false, shortfall: 0 })}>
        <View className="bg-primary rounded-xl p-4">
          <Text className="text-white text-lg font-semibold mb-2">Insufficient Wallet Balance</Text>
          <Text className="text-gray-300 mb-4">You need {moneyFormat(fundPrompt.shortfall)} more to complete this bill payment.</Text>
          <TouchableOpacity
            onPress={() => {
              setFundPrompt({ open: false, shortfall: 0 })
              router.push({
                pathname: '/fundWallet',
                params: {
                  returnTo: '/mobileProviders/[id]/confirm/[orderId]',
                  id: String(id || ''),
                  orderId: String(orderId || ''),
                  intentId: String(flow.intentId || ''),
                  resume: '1',
                },
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

export default ConfirmScreen
