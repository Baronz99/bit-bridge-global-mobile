import { View, Text, Linking, TouchableOpacity, Animated } from 'react-native'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
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
  const [lastPaymentMethod, setLastPaymentMethod] = useState<string | null>(null)
  const { notification, setNotification } = useNotification()
  const [applyCommission, setApplyCommission] = useState(false)
  const translateX = useRef(new Animated.Value(0)).current

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
  // const [getstarted, setOpenStarted] = useState(false)

  const handleConfirmation = async (payment_method: string) => {
    // setTextInfo("Please wait while we process your payment")
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
            response?.message ||
            'Payment confirmation is still processing. Please retry shortly.',
          data: null,
        })
        return
      }

      if (payment_method === 'card') {
        Linking.openURL(response.responseBody.checkoutUrl)
      }

      setNotification({
        error: false,
        message: response?.message || 'Recharge Successful',
        data: null,
      })

      loadProfile()
    } catch (error: any) {
      setLoader(false)
      setPendingRetry(false)
      setNotification({
        error: true,
        message: error.message || 'something went wrong',
        data: null,
      })
    }
  }

  const commissionValue = useMemo(
    () => Number((data?.amount * data?.commissionRate).toFixed(2)),
    [data]
  )

  const handlePress = async () => {
    if (loading) return
    // try {
    //   setLoader(true);
    //   // pass a small object in case parent needs more info
    //   await onTrigger({ amount, commissionRate, commissionValue });
    // } catch (e) {
    //   console.error("Commission trigger failed", e);
    // } finally {
    //   setLoading(false);
    // }
  }

  return (
    <View className="flex-1 p-4 bg-primary">
      <View className="mb-6">
        <Text className="text-2xl font-bold text-white text-center">Confirm Recharge</Text>
        <Text className="text-sm text-white text-center mt-1">
          Please verify the transaction details below.
        </Text>
      </View>

      <View className="bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
        <Text className="text-lg font-semibold text-center text-gray-200 mb-4">
          Recharge Details
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

      {data?.service_type === 'VTU' ||
        (data?.service_type === 'DATA' && (
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-xs text-gray-200">Use Commission?</Text>
              <Text className="text-sm font-medium text-alt -800">
                {moneyFormat(data?.bill_commission)} Amount to pay
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityLabel="Trigger commission"
              accessibilityRole="button"
              disabled={loading}
              onPress={toggleSwitch}
              className=" relative border"
              style={{
                height: 30,
                width: 100,
                borderRadius: 25,
                backgroundColor: applyCommission ? 'green' : 'gray',
                justifyContent: 'center',
                padding: 5,
              }}
            >
              <Animated.View
                className="h-6 w-10  rounded-full bg-blue-500 top-0 relative translate-x-0"
                style={{ transform: [{ translateX }] }}
              />
            </TouchableOpacity>
          </View>
        ))}
      <Text className="text-white text-center">{textInfo}</Text>

      <TransactionButtons handleConfirmation={handleConfirmation} />

      <Loader open={loader} />

      <AppModal
        open={!!notification?.message}
        onclose={() => {
          setPendingRetry(false)
          setNotification({ message: null, error: false, data: null })
        }}
      >
        <NotificationAlert
          onPress={() => {
            setPendingRetry(false)
            setNotification({ message: null, error: false, data: null })
          }}
          message={notification?.message}
          error={notification.error}
          data={notification.data}
        />
        {pendingRetry && lastPaymentMethod ? (
          <TouchableOpacity
            onPress={() => handleConfirmation(lastPaymentMethod)}
            className="border rounded-md mt-4 border-alt py-4"
          >
            <Text className="text-alt text-center">Retry Confirmation</Text>
          </TouchableOpacity>
        ) : null}
      </AppModal>
    </View>
  )
}

export default confirm
