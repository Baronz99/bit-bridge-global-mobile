import { Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { confirmBillPayment, confirmPayment, getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'
import Loader from '@/components/Loader'
import moneyFormat from '@/utils/moneyFormat'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import Summary from '@/components/cards/Summary'
import AppModal from '@/components/modal/Modal'

const MobileDetailConfirm = () => {
      const {orderId} = useLocalSearchParams()
          const [loader, setLoader] = useState(false)
          const {notification, setNotification} = useNotification()
      
          const {authState: {token},loadProfile } = useAuth()
          const [textInfo, setTextInfo] = useState("")

          const {data, refetch, loading, error, reset} = useFetch(()=> getPurchaseOrder({
            id: orderId,
            token
          }))
     
          

          
          const handleConfirmation = async (payment_method: string) => {
            setLoader(true)

            try {

             const response = await  confirmPayment({queryId: orderId, payment_method, token})
             setLoader(false)
             setNotification({
              error: false,
              message: response?.message || "Data Purchased",
              data: null
            })
             
        
              
            } catch (error: any) {
              setLoader(false)
              setNotification({
                error: true,
                message: error.message || "something went wrong",
                data: null
              })
              
            }
        
 
    }

    const handleCardConfirmation = async (payment_method: string) => {
      setTextInfo("Please wait while we process your payment")
      setLoader(true)
      setNotification({
        error: false,
        message: "Recharge Successful",
        data: null
      })

      // try {

      //  const response = await  confirmBillPayment({queryId: orderId, payment_method, token})
      //  setLoader(false)

      //  if(payment_method === "card"){
      //   Linking.openURL(response.responseBody.checkoutUrl)

      //  }

      //  setNotification({
      //   error: false,
      //   message: response?.message || "Recharge Successful",
      //   data: null
      // })

      // loadProfile(token)
       
  
        
      // } catch (error: any) {
      //   setLoader(false)
      //   setNotification({
      //     error: true,
      //     message: error.message || "something went wrong",
      //     data: null
      //   })
        
      // }
  

}
      
  return (
    <View className='flex-1 p-4 bg-primary'>
      
      
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

       <Summary data={data} />
      </View>
      <Text className='text-white text-center'>{textInfo}</Text>

      <View className="flex-row gap-4  bg-gray-600 px-4 rounded-lg py-2 ">
        <TouchableOpacity onPress={() => handleCardConfirmation("wallet")} className='border rounded-md flex-1  border-alt py-5 '>
              <Text className='text-alt text-center'>Pay from Wallet </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleCardConfirmation("card")} className='border rounded-md  flex-1 border-green-400 py-5 '>
                          <Text className='text-green-400 text-center'>Pay from Bank </Text>
          </TouchableOpacity>
      </View>

   

    
        <Loader open={loading}/>

          <AppModal open={!!notification?.message} onclose={()=> setNotification({message: null, error: false, data: null})}>
      <NotificationAlert onPress={()=> setNotification({message: null, error: false, data: null})} message={notification?.message} error={notification.error} data={notification.data}/>

     </AppModal>

    </View>
  )
}

export default MobileDetailConfirm

