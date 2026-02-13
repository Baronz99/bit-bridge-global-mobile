import { Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import Summary from '@/components/cards/Summary'
import TransactionButtons from '@/components/transactionButtons/TransactionButtons'
import AppModal from '@/components/modal/Modal'
import moneyFormat from '@/utils/moneyFormat'
import useBillPaymentIntentFlow from '@/hooks/useBillPaymentIntentFlow'

const CableConfirmScreen = () => {
  const { orderId, id, resume, intentId: routeIntentId } = useLocalSearchParams()
  const routeOrderId = String(orderId || '').trim()
  const resumeFlag = String(resume || '') === '1'
  const [fundPrompt, setFundPrompt] = useState<{ open: boolean; shortfall: number }>({ open: false, shortfall: 0 })
  const { loadProfile, userProfileData } = useAuth()
  const walletBalanceValue = Number(userProfileData?.wallet?.balance ?? 0)
  const { notification, setNotification } = useNotification()
  const router = useRouter()

  const { data } = useFetch<any>(useCallback(() => getPurchaseOrder(routeOrderId), [routeOrderId]))
  const billTotal = useMemo(() => Number(data?.total_amount ?? data?.amount ?? 0), [data?.amount, data?.total_amount])

  const flow = useBillPaymentIntentFlow({
    billOrderId: routeOrderId,
    initialIntentId: String(routeIntentId || '').trim(),
    resumeFlag,
    onCompleted: (completedOrderId) => {
      router.push({
        pathname: '/transaction/confirm',
        params: { orderId: String(completedOrderId || routeOrderId) },
      })
      loadProfile({ force: true })
    },
  })
  const canViewReceipt = flow.uiState === 'completed'

  const handleConfirmation = useCallback(async (paymentMethod: string) => {
    if (paymentMethod !== 'wallet') {
      setNotification({ error: true, message: 'Bills can only be paid from wallet.', data: null })
      return
    }

    const result = await flow.execute({ billTotal, walletBalance: walletBalanceValue })
    if (result.kind === 'awaiting_funds') {
      setFundPrompt({ open: true, shortfall: result.shortfall })
      return
    }
    if (result.kind === 'failed') {
      setNotification({ error: true, message: result.message || 'Bill payment failed.', data: null })
    }
  }, [billTotal, flow, setNotification, walletBalanceValue])

  return (
    <View className="flex-1 px-4 bg-primary w-full">
      <View className="mb-6">
        <Text className="text-2xl font-bold text-white text-center">Confirm Payment</Text>
        <Text className="text-sm text-white text-center mt-1">Review the details before you pay.</Text>
      </View>

      <View className="bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">Payment Summary</Text>
        <Summary data={data} applyCommission={false} />
      </View>

      {flow.uiState === 'processing' || flow.uiState === 'timed_out' ? (
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
          <Text className="text-yellow-200 text-center">
            {flow.uiState === 'timed_out' ? 'Payment is still processing. Check status to continue.' : flow.message || 'Payment pending. We are checking status.'}
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
      ) : null}

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
                  returnTo: '/cableProviders/[id]/confirm/[orderId]',
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

export default CableConfirmScreen
