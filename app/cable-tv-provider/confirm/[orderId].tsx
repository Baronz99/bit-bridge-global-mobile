import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import Summary from '@/components/cards/Summary'
import AppModal from '@/components/modal/Modal'
import TransactionButtons from '@/components/transactionButtons/TransactionButtons'
import resolveBillOrderId from '@/utils/resolveBillOrderId'
import moneyFormat from '@/utils/moneyFormat'
import useBillPaymentIntentFlow from '@/hooks/useBillPaymentIntentFlow'
import useServiceAvailability from '@/hooks/useServiceAvailability'
import ServiceStatusPill from '@/components/service-availability/ServiceStatusPill'

const CableTvConfirmScreen = () => {
  const { orderId, id, resume, intentId: routeIntentId } = useLocalSearchParams()
  const routeOrderId = String(orderId || '').trim()
  const resumeFlag = String(resume || '') === '1'
  const [resolvedBillOrderId, setResolvedBillOrderId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [fundPrompt, setFundPrompt] = useState<{ open: boolean; shortfall: number }>({ open: false, shortfall: 0 })
  const { loadProfile, userProfileData } = useAuth()
  const walletBalanceValue = Number(userProfileData?.wallet?.balance ?? 0)
  const { notification, setNotification } = useNotification()
  const router = useRouter()
  const { getStatus } = useServiceAvailability()

  const { data } = useFetch<any>(
    useCallback(() => {
      if (!routeOrderId) return Promise.resolve(null)
      return getPurchaseOrder(routeOrderId)
    }, [routeOrderId])
  )
  const billTotal = useMemo(() => Number(data?.total_amount ?? data?.amount ?? 0), [data?.amount, data?.total_amount])

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
      router.push({
        pathname: '/transaction/confirm',
        params: { orderId: String(completedOrderId || resolvedBillOrderId || routeOrderId) },
      })
      loadProfile({ force: true })
    },
  })

  const selectedServiceStatus = useMemo(
    () => getStatus({ provider: data?.biller, serviceType: data?.service_type }),
    [data?.biller, data?.service_type, getStatus]
  )
  const canViewReceipt = flow.uiState === 'completed'

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

      const result = await flow.execute({ billTotal, walletBalance: walletBalanceValue })
      if (result.kind === 'awaiting_funds') {
        setFundPrompt({ open: true, shortfall: result.shortfall })
        return
      }
      if (result.warningCode === 'SERVICE_UNSTABLE') {
        setNotification({ error: false, message: result.warningMessage || 'Service is unstable. Transaction may be delayed.', data: null })
      }
      if (result.kind === 'failed') {
        setNotification({ error: true, message: result.message || 'Bill payment failed.', data: null })
      }
    },
    [billTotal, flow, resolveError, resolvedBillOrderId, setNotification, walletBalanceValue]
  )

  return (
    <View className="flex-1 px-4 bg-primary w-full">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View className="mb-6">
        <Text className="text-2xl font-bold text-white text-center">Confirm Payment</Text>
        <Text className="text-sm text-white text-center mt-1">Review the details before you pay.</Text>
      </View>

      <View className="mb-2 flex-row items-center justify-between rounded-xl border border-gray-800 bg-gray-900/70 px-3 py-2">
        <Text className="text-gray-300 text-xs">Service availability</Text>
        <ServiceStatusPill state={selectedServiceStatus.state} />
      </View>

      <View className="bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">Payment Summary</Text>
        <Summary data={data} applyCommission={false} />
      </View>

      {flow.uiState === 'processing' || flow.uiState === 'timed_out' ? (
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
          <Text className="text-yellow-200 text-center">
            {flow.uiState === 'timed_out'
              ? 'Payment is still processing. Check status to continue.'
              : flow.message || 'Payment pending. We are checking status.'}
          </Text>
          {flow.uiState === 'timed_out' ? (
            <>
              <TouchableOpacity onPress={() => flow.pollStatus()} className="border rounded-md mt-3 border-alt py-3">
                <Text className="text-alt text-center">Check status</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/utility/cable')} className="border rounded-md mt-3 border-gray-600 py-3">
                <Text className="text-gray-300 text-center">Back to bills</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}

      {flow.uiState === 'failed' ? (
        <View className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
          <Text className="text-red-200 text-center">{flow.message || 'Bill payment failed.'}</Text>
          <TouchableOpacity onPress={() => handleConfirmation('wallet')} className="border rounded-md mt-3 border-red-400 py-3">
            <Text className="text-red-200 text-center">Retry payment</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TransactionButtons handleConfirmation={handleConfirmation} walletOnly disabled={flow.isActionDisabled} />

      {canViewReceipt ? (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/transaction/confirm', params: { orderId: String(orderId) } })}
          className="border rounded-md mt-4 border-gray-700 py-4"
        >
          <Text className="text-gray-300 text-center">View Receipt</Text>
        </TouchableOpacity>
      ) : null}
      </ScrollView>

      {flow.isBusy && <Loader open={flow.isBusy} />}

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
                  returnTo: '/cable-tv-provider/confirm/[orderId]',
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

      <NotificationAlert message={notification.message} error={notification.error} data={notification.data} />
    </View>
  )
}

export default CableTvConfirmScreen
