import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { images } from '@/constants/images'
import MovieCard from '@/components/movieCard'
import { useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { fetchMovies } from '@/services/api'
import { icons } from '@/constants/icons'
import SearchBar from '@/components/SearchBar'
import { updateSearchCount } from '@/services/app-write'
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
    <View className='flex-1 bg-primary px-4'>
      <Image source={images.bg} resizeMode='cover' className='absolute w-full z-0'/>
      <ScrollView className='g-red-100'>
     
        <View className='min-h-40 mt-10 bg-gray-900 rounded-3xl items- justify-center px-4'>
        
          <Text className='text-white font-medium text-3xl text-center'>
            {moneyFormat(userProfileData?.wallet.balance)}
 
          </Text>
        </View>
       
       <View className="m-4 border border-gray-300 rounded-lg overflow-hidden ">
          <View className="flex-row bg-gray-800 px-4 py-3">
            <Text className="flex-1 font-semibold text-gray-200">Status</Text>
            <Text className="flex-1 font-semibold text-gray-200 text-right">Amount (₦)</Text>

            <Text className="flex-1 font-semibold text-gray-200 text-right">Time </Text>
          </View>



          <ScrollView className="h-full flex-1 bg-red-">

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

const styles = StyleSheet.create({})