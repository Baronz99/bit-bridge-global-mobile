import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { images } from '@/constants/images'
import { useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'

import { getTransactions } from '@/api/transactions'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { dateFormat } from '@/utils/dateFormat'

const Transactions = () => {

    const router = useRouter()
    const {userProfileData, authState: {token}} = useAuth()
  
    const {data, loading} = useFetch(() => getTransactions({
      token
    }))
    // console.log(userProfileData?.wallet, data?.data)

    
  
  
  return (
    <View className='flex-1 bg-primary'>
      <Image source={images.bg} resizeMode='cover' className='absolute top-0 left-0 w-full z-0'/>
      <ScrollView className='g-red-100'>
     
        <View className='min-h-40 mt-5 mx-4 bg-gray-900 rounded-xl items- justify-center px-4'>
        {
          loading ? <ActivityIndicator/> :
          <Text className='text-white font-medium text-3xl text-center'>

          {moneyFormat(userProfileData?.wallet.balance)}

        </Text>

        }
          <View className='mt-10 flex-row justify-between text-center'>
            <View className='text-center'>
              <Text className='font-medium text-xl text-alt'>Withdrawal</Text>
              <Text className='text-2xl text-white text-center font-semibold'> {moneyFormat(0)}</Text>
            </View>
            <View>
              <Text className='text-green-700 font-medium text-xl'> Deposit</Text>
              <Text className='text-2xl font-semibold text-white text-center'> {moneyFormat(0)}</Text>
            </View>
          
          </View>
        </View>
        <View className='my-4 mx-4'>
          <Text className='text-white text-base'>Recent Transactions</Text>

        </View>
       
       <View className="flex-row border-b border-gray-600 pb-2 mb-2 overflow-hidden ">
          <View className="flex-row bg-gray-800 px-4 py-3">
            <Text className="flex-1 text-gray-300 font-semibold">Status</Text>
            <Text className="flex-1 text-gray-300 font-semibold">Amount (₦)</Text>

            <Text className="flex-1 text-gray-300 font-semibold">Time </Text>
          </View>



          <ScrollView 
          showsVerticalScrollIndicator={false} 
          className="h-full flex-1 bg-red-">

            {loading ? <ActivityIndicator
            size={"large"}
            color={"#000ff"}
            className='mt-10 self-center'
            />
            
            : data && data?.data.map((item, index) => (
              <View key={index} className="flex-row border-t border-gray-200 px-4 py-2">
                <Text className="flex-1 text-gray-200">{item.status}</Text>
                <Text className="flex-1 text-center text-white">{moneyFormat(item.amount)}</Text>
                <Text className="flex-1  text-right text-white">{dateFormat(item.created_at)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  )
}

export default Transactions

