import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect } from 'react'
import { Link, useLocalSearchParams } from 'expo-router'
import { icons } from '@/constants/icons'
import { images } from '@/constants/images'
import useFetch from '@/services/useFetch'
import { getTransactionRecord } from '@/api/transactions'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'

const confirm = () => {
  const {authState: {token}, loadProfile} = useAuth()
  
    const {reference} = useLocalSearchParams()
    const {data, loading} = useFetch(()=> getTransactionRecord({
      id: reference as string,
      token: token


    }))

    const receipt_type = reference?.split("-")[0]

    useEffect(()=> {
      loadProfile(token)
    }, [])

    
  return (
    <View className='flex-1 px-4 bg-primary'>

      { (!loading && data ) ? (data?.status === "approved" || data?.status === "completed" ? 
      <Text className='text-green-600  font-semibold text-xl mt-10 text-center'>
        Transaction completed
      </Text> :
      <Text className='text-red-600  font-semibold text-xl mt-10 text-center'>
      Failed  transaction
    </Text>) : <Text className='text-center text-white'> Loading...</Text>
    }

       {(!loading && data ) && (data?.status === "approved" || data?.status === "completed" ? 
       <Image source={images.success} className='w-40 m-auto h-40' />
          :  <Image source={images.fail} className='w-40 m-auto h-40' />)
          }

      {receipt_type === "fbg" ? 
      <View className='m-auto w-full px bg-r'>
        <View className='my-20'> 
          <Text className='text-white text-center my-3 text-3xl'>{moneyFormat(data?.amount)}</Text>
          <Text className='text-alt text-center my-3 text-3xl'>Wallet Funded</Text>
        </View>
       
        </View> :
      
      <View className='m-auto w-full px bg-r'>
        <View className='my-10'> 
          <Text className='text-white text-center my-0 text-3xl'>{moneyFormat(data?.amount)}</Text>
        </View>
          <Text className='text-white text-center my-8 text-2xl'>{(data?.description ?? "Mobile Top Up")}</Text>
          <Text className='text-white text-center my-4 text-3xl'>{(data?.meter_number)}</Text>

          {data?.token && 
          <View>
            <Text className='text-xl text-center text-alt my-4'>Token </Text>
            <Text className='text-white text-3xl font-medium text-center'>{data?.token ?? "ttrr657687879999977878"} </Text>
          </View>
        }
      </View>}


      <Link href={"/"} asChild>
        <TouchableOpacity className='bg-alt rounded w-full py-3 mt-5'>
          <Text className=' border-primary rounded-lg py-2 font-semibold text-xl text-center'>confirm</Text>
        </TouchableOpacity>  
                
        </Link>

      

     
    </View>
  )
}

export default confirm

