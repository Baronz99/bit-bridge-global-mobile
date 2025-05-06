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
 
  
  return (
    <View className='flex-1 bg-primary'>
      <Image source={images.bg} resizeMode='cover' className='absolute top-0 left-0 w-full z-0'/>
      <ScrollView className='g-red-100'>
     
        <View className='min-h-40 mt-5 mx-4 bg-gray-900 rounded-xl items- justify-center px-4'>
     
          <View className=''>
         
            <View className="bg-gray-900 p-5 rounded-2xl shadow-lg">
              <Text className="text-white text-lg font-semibold mb-2">Wallet Balance</Text>
              <Text className="text-3xl font-bold text-green-400 mb-4">{moneyFormat(userProfileData?.wallet.balance)}</Text>

              <View className="flex-row justify-between mt-2">
                <View className="flex-1 mr-2">
                  <Text className="text-gray-400 text-sm">Deposits</Text>
                  <Text className="text-green-300 font-medium">{moneyFormat(userProfileData?.wallet?.total_deposit ?? 0)}</Text>
                </View>

                <View className="flex-1 ml-2">
                  <Text className="text-gray-400 text-sm">Withdrawals</Text>
                  <Text className="text-red-400 font-medium">{moneyFormat(userProfileData?.wallet?.withdrawn ?? 0)}</Text>
                </View>
              </View>
            </View>
          
          </View>





       



        </View>
        <View className='my-4 mx-4'>
          <Text className='text-white text-base'>Recent Transactions</Text>

        </View>
       
       <View className="flex-r border-b mx-4  border-gray-600 pb-2 mb-2 overflow-hidden ">
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

