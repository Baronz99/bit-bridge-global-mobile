import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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

const MobileDetailConfirm = () => {
      const {orderId} = useLocalSearchParams()
          const [loader, setLoader] = useState(false)
          const {notification, setNotification} = useNotification()
      
          const {authState: {token}, } = useAuth()


          const {data, refetch, loading, error, reset} = useFetch(()=> getPurchaseOrder({
            id: orderId,
            token
          }))
     
          

          
          const handleConfirmation = async (payment_method: string) => {
            setLoader(true)

            try {

             const response = await  confirmPayment({queryId: orderId, payment_method, token})
             setLoader(false)
             console.log("data purchase ==========================>",response)
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
      setLoader(true)

      try {

       const response = await  confirmBillPayment({queryId: orderId, payment_method, token})
       setLoader(false)
       console.log("data purchase ==========================>",response)
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
      
  return (
    <View className='flex-1 p-4 bg-primary'>

      <View className='bg-alt/60 mb-10 justify-center items-center py-10 rounded-lg mt-4'>
          <Text className='text-lg font-medium text-black'> Confirm Number</Text>
          <Text> {data?.service_type}</Text>
          <Text className='text-2xl font-medium'> {data?.meter_number}</Text>
          <Text className='text-2xl font-medium'> {moneyFormat(data?.amount)}</Text>
          <Text className='text-2xl font-medium'> {data?.description}</Text>


      </View>

         <TouchableOpacity onPress={() => handleConfirmation("wallet")} className='border rounded-md mt-4 border-alt py-5 '>
                          <Text className='text-alt text-center'>Pay from Wallet </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleCardConfirmation("card")} className='border rounded-md mt-4 border-green-400 py-5 '>
                          <Text className='text-green-400 text-center'>Pay from Bank </Text>
          </TouchableOpacity>
          { loader && <Loader/>}
          <NotificationAlert message={notification.message} error={notification.error} data={notification.data} />

    </View>
  )
}

export default MobileDetailConfirm

const styles = StyleSheet.create({})