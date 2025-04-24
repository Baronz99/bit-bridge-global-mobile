import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { confirmPayment, getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'

const MobileDetailConfirm = () => {
      const {orderId} = useLocalSearchParams()
          const {authState: {token}, } = useAuth()
              const [loader, setLoader] = useState(false)
              const {notification, setNotification} = useNotification()
                    // const [notification, setNotification] = useState({
                    //   error: false,
                    //   message: null,
                    //   data: null
                    // })
          


          const {data, refetch, loading, error, reset} = useFetch(()=> getPurchaseOrder({
            id: orderId,
            token
          }))
     
          

          
          const handleConfirmation = async(payment_method: string) => {
            setLoader(true)

            try {

             const response = await confirmPayment({queryId: orderId, payment_method, token})
             console.log("response ======================>",response)
             setNotification({
              error: false,
              message: response?.message || "Payment Successful",
              data: null
            })     
            setLoader(false)

        
              
            } catch (error: any) {

              console.log("error respose", error)
              setLoader(false)
              setNotification({
                error: true,
                message: error.message || "operation failed",
                data: null

              })              
            }
        
 
    }
      

    //   const {data} = useFetch(()=> getProvision({
    //     id: id as string,
    //     token: token  }
    //   )
    // )


  return (
    <View className='flex-1 p-4 bg-primary relative'>

      <View className='bg-light-100 mb-10 justify-center items-center py-10 rounded-lg mt-4'>
          <Text className='text-lg font-medium text-black'> Confirm Meter Number</Text>
          <Text> {data?.service_type}</Text>
          <Text className='text-2xl font-medium'> {data?.meter_number}</Text>
          <Text className='text-2xl font-medium'> {data?.addess}</Text>
          <Text className='text-2xl font-medium'> {data?.name}</Text>
          <Text className='text-2xl font-medium'> {moneyFormat(data?.amount)}</Text>


      </View>

         <TouchableOpacity onPress={() => handleConfirmation("wallet")} className='border rounded-md mt-4 border-alt py-5 '>
              <Text className='text-alt text-center'>Confirm </Text>
          </TouchableOpacity>


          <NotificationAlert message={notification.message} error={notification.error} data={notification.data} />

          { loader && <Loader/>}


    </View>
  )
}

export default MobileDetailConfirm

const styles = StyleSheet.create({})