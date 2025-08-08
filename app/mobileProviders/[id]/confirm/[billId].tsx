import { View, Text, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import useNotification from '@/hooks/useNotification'
import { useIsFocused } from '@react-navigation/native'
import useFetch from '@/services/useFetch'
import { useAuth } from '@/services/useAuth'
import { getPurchaseOrder } from '@/api/billOrder'

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
          
     
            
  return (
    <View>
        <TouchableOpacity className='py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg'
            onPress={() => setTextInfo("wallet")}
            >
            
            <Text className=' font-semibold text-base text-gray-100'>Button for bill {textInfo}</Text>
            
        </TouchableOpacity>    
    </View>
  )
}

export default confirm