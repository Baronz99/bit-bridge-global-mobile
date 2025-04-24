import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { confirmPayment, getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'
import { images } from '@/constants/images'
import { AntDesign } from '@expo/vector-icons'
import { gifs } from '@/constants/gifs'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'

const CableetailConfirm = () => {
      const {orderId} = useLocalSearchParams()
      const [loader, setLoader] = useState(false)
          const {authState: {token}, } = useAuth()
          const [notification, setNotification] = useState({
            error: true,
            message: null,
            data: null
          })


          const {data, refetch, loading, error, reset} = useFetch(()=> getPurchaseOrder({
            id: orderId,
            token
          }))
     
          

          
          const handleConfirmation = async (payment_method: string) => {
            setLoader(true)
            try {

             const response = await confirmPayment({queryId: orderId, payment_method, token})
            setNotification({
              error: false,
              message: response?.message || "Payment Successful",
              data: response.data
            })     
            
            setLoader(false)
        
              
            } catch (error: any) {

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

    console.log("fetched purchase:", data)

  return (
    <View className='flex-1 px-4 bg-primary w-full'>

      <View className='bg-light-100 mb-10 mx-4 text-dstv-blue justify-center items-center py-10 rounded-lg mt-4'>
          <Text className='text-2xl font-semibold text-dstv-blue'> Confirm Number</Text>
          <Text> {data?.service_type}</Text>
          <Text className='text-2xl font-medium text-dstv-blue'> {data?.meter_number}</Text>
          <Text className='text-2xl font-medium text-dstv-blue text-center'> {data?.description}</Text>


      </View>

      <TouchableOpacity onPress={() => handleConfirmation("wallet")} className='border rounded-md mt-4 border-alt py-5 '>
        <Text className='text-alt text-center'>Confirm </Text>
      </TouchableOpacity>




    
    <NotificationAlert message={notification.message} error={notification.error} data={data} />

 


   { loader && <Loader/>}
     

    </View>
  )
}

export default CableetailConfirm