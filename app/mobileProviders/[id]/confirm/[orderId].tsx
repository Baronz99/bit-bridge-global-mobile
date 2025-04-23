import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { confirmPayment, getPurchaseOrder } from '@/api/billOrder'
import { useAuth } from '@/services/useAuth'

const MobileDetailConfirm = () => {
      const {orderId} = useLocalSearchParams()
          const {authState: {token}, } = useAuth()


          const {data, refetch, loading, error, reset} = useFetch(()=> getPurchaseOrder({
            id: orderId,
            token
          }))
     
          

          
          const handleConfirmation = (payment_method: string) => {

            try {

             const response =  confirmPayment({queryId: orderId, payment_method, token})
            //  console.log(response)
             
        
              
            } catch (error) {
              console.log(error)
              
            }
        
 
    }
      

    //   const {data} = useFetch(()=> getProvision({
    //     id: id as string,
    //     token: token  }
    //   )
    // )

    console.log("fetched purchase:",data)

  return (
    <View className='flex-1 p-4 bg-primary'>

      <View className='bg-alt/60 mb-10 justify-center items-center py-10 rounded-lg mt-4'>
          <Text className='text-lg font-medium text-black'> Confirm Number</Text>
          <Text> {data?.service_type}</Text>
          <Text className='text-2xl font-medium'> {data?.meter_number}</Text>
          <Text className='text-2xl font-medium'> {data?.description}</Text>


      </View>

         <TouchableOpacity onPress={() => handleConfirmation("wallet")} className='border rounded-md mt-4 border-alt py-5 '>
                          <Text className='text-alt text-center'>Confirm </Text>
          </TouchableOpacity>

    </View>
  )
}

export default MobileDetailConfirm

const styles = StyleSheet.create({})