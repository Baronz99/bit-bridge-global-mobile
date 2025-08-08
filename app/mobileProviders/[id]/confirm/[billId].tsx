import { View, Text, TouchableOpacity, Linking } from 'react-native'
import React, { useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import useNotification from '@/hooks/useNotification'
import { useIsFocused } from '@react-navigation/native'
import useFetch from '@/services/useFetch'
import { useAuth } from '@/services/useAuth'
import { confirmBillPayment, getPurchaseOrder } from '@/api/billOrder'

const confirm = () => {
   const {billId} = useLocalSearchParams()
          const [loader, setLoader] = useState(false)
          const {notification, setNotification} = useNotification()
      
          const {authState: {token},loadProfile } = useAuth()
          const [textInfo, setTextInfo] = useState("")

          const {data, refetch, loading, error, reset} = useFetch(()=> getPurchaseOrder({
            id: billId,
            token
          }))
          const isFocused = useIsFocused()
            const [getstarted, setOpenStarted] = useState(false)


            
                const handleConfirmation = async (payment_method: string) => {
                  // setTextInfo("Please wait while we process your payment")
                  setLoader(true)
                  // setNotification({
                  //   error: false,
                  //   message: "Recharge Successful",
                  //   data: null
                  // })
            
                  try {
            
                   const response = await  confirmBillPayment({queryId: billId, payment_method, token})
                   setLoader(false)
            
                   if(payment_method === "card"){
                    Linking.openURL(response.responseBody.checkoutUrl)
            
                   }
            
                   setNotification({
                    error: false,
                    message: response?.message || "Recharge Successful",
                    data: null
                  })
            
                  loadProfile(token)
                   
              
                    
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
        <TouchableOpacity className='py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg'
            onPress={() => setTextInfo("wallet")}
            >
            
            <Text className=' font-semibold text-base text-gray-100'>Button for bill pay for dark mode {textInfo}</Text>
            
        </TouchableOpacity>    
    </View>
  )
}

export default confirm