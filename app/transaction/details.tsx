import { View, Text, TouchableOpacity, Linking, Pressable, Animated, ActivityIndicator, Switch } from 'react-native'
import React, { useMemo, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useNotification from '@/hooks/useNotification'
import { useIsFocused } from '@react-navigation/native'
import useFetch from '@/services/useFetch'
import { useAuth } from '@/services/useAuth'
import { confirmBillPayment, confirmOrderPayment, getPurchaseOrder } from '@/api/billOrder'
import Summary from '@/components/cards/Summary'
import Loader from '@/components/Loader'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'
import TransactionButtons from '@/components/transactionButtons/TransactionButtons'
import moneyFormat from '@/utils/moneyFormat'
const confirmDetails = () => {
  const { orderId } = useLocalSearchParams()
  const [loader, setLoader] = useState(false)
  const { notification, setNotification } = useNotification()
    const [applyCommission, setApplyCommission] = useState(false)
  const translateX = useRef(new Animated.Value(0)).current
  const router = useRouter()
  const toggleSwitch = () => {
    // Animated.timing(translateX, {
    //   toValue: applyCommission ? 60 : 0,
    //   duration: 300,
    //   useNativeDriver: true
    // }).start();
    setApplyCommission(prev => !prev)
  }

  const {
        userProfileData,

    authState: { token },
    loadProfile,
  } = useAuth()
  const [textInfo, setTextInfo] = useState('')

  const { data, refetch, loading, error, reset } = useFetch(() =>
    getPurchaseOrder({
      id: orderId,
      token,
    })
  )
  const isFocused = useIsFocused()
  // const [getstarted, setOpenStarted] = useState(false)

  const handleConfirmation = async (payment_method: string) => {
    // setTextInfo("Please wait while we process your payment")
    setLoader(true)

    try {
      const response = await confirmOrderPayment({ queryId: orderId, token, data: {payment_method, use_commission: applyCommission}  })
      setLoader(false)

      if (payment_method === 'card') {
        Linking.openURL(response.responseBody.checkoutUrl)
      }

      if(response){
        router.push({
          pathname: "/transaction/confirm", params: {
          orderId: response.data.id 

          }
        })
      }

      setNotification({
        error: false,
        message: response?.message || 'Recharge Successful',
        data: null,
      })

      loadProfile(token)
    } catch (error: any) {
      setLoader(false)
      setNotification({
        error: true,
        message: error.message || 'something went wrong',
        data: null,
      })
    }
  }
console.log(applyCommission, "[Data info]")
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

        <Summary data={data} applyCommission={applyCommission}/>
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
          <Text className="text-xs text-amber-600 font-semibold mr-2">
            Bonus
          </Text>
          <Text className="text-sm font-medium text-amber-800">
            {moneyFormat(userProfileData?.wallet?.commission ?? 0)}
          </Text>
        </View>
      </View>

  

      {/* Action row */}

      {(data?.service_type === "VTU" || data?.service_type === "DATA") && 
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
        trackColor={{ false: "#767577", true: "#34d399" }} // gray → green
        thumbColor={applyCommission ? "#fff" : "#f4f3f4"}
      />
      </View>
}
      <Text className="text-white text-center">{textInfo}</Text>

      <TransactionButtons handleConfirmation={handleConfirmation} />

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
