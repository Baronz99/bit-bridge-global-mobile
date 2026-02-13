import { Alert, Switch, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
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

const ConfirmDetails = () => {
  const { orderId, id, resume, intentId: routeIntentId } = useLocalSearchParams()
  const routeOrderId = String(orderId || '').trim()
  const resumeFlag = String(resume || '') === '1'
  const [resolvedBillOrderId, setResolvedBillOrderId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [applyCommission, setApplyCommission] = useState(false)
  const [fundPrompt, setFundPrompt] = useState<{ open: boolean; shortfall: number }>({ open: false, shortfall: 0 })
  const { notification, setNotification } = useNotification()
  const router = useRouter()
  const { userProfileData, loadProfile } = useAuth()
  const walletBalanceValue = Number(userProfileData?.wallet?.balance ?? 0)

  const { data } = useFetch<any>(useCallback(() => {
    if (!routeOrderId) return Promise.resolve(null)
    return getPurchaseOrder(routeOrderId)
  }, [routeOrderId]))
  const billTotal = useMemo(() => Number(data?.total_amount ?? data?.amount ?? 0), [data?.amount, data?.total_amount])

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

  const handleConfirmation = useCallback(async (paymentMethod: string) => {
    if (paymentMethod !== 'wallet') {
      setNotification({ error: true, message: 'Bills can only be paid from wallet.', data: null })
      return
    }
    if (!resolvedBillOrderId) {
      setNotification({ error: true, message: resolveError || 'Missing bill order id.', data: null })
      return
    }
    if (isElectricityVerificationPending) {
      setNotification({ error: true, message: 'Meter verification is still in progress. Please wait.', data: null })
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
      setNotification({ error: true, message: result.message || 'Bill payment failed.', data: null })
    }
  }, [applyCommission, billTotal, flow, isElectricityVerificationPending, resolveError, resolvedBillOrderId, setNotification, walletBalanceValue])
  const canViewReceipt = flow.uiState === 'completed' || String(data?.status || '').toLowerCase() === 'completed'

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
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3 mt-2">
          <Text className="text-blue-200 text-center">Verifying meter details with provider. Please wait...</Text>
        </View>
      ) : null}

      {flow.uiState === 'processing' || flow.uiState === 'timed_out' ? (
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3 mt-2">
          <Text className="text-yellow-200 text-center">
            {flow.uiState === 'timed_out' ? 'Payment is still processing. Check status to continue.' : flow.message || 'Payment pending. We are checking status.'}
          </Text>
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
        <View className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3 mt-2">
          <Text className="text-red-200 text-center">{flow.message || 'Bill payment failed.'}</Text>
          <TouchableOpacity onPress={() => handleConfirmation('wallet')} className="border rounded-md mt-3 border-red-400 py-3">
            <Text className="text-red-200 text-center">Retry payment</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TransactionButtons
        handleConfirmation={handleConfirmation}
        walletOnly
        disabled={flow.isActionDisabled || isElectricityVerificationPending}
      />

      {canViewReceipt ? (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/transaction/confirm', params: { orderId: String(orderId) } })}
          className="border rounded-md mt-4 border-gray-700 py-4"
        >
          <Text className="text-gray-300 text-center">View Receipt</Text>
        </TouchableOpacity>
      ) : null}

      <Loader open={flow.isBusy} />

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

export default ConfirmDetails
