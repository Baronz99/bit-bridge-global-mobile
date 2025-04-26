import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { icons } from '@/constants/icons'
import useFetch from '@/services/useFetch'
import { getTransactions } from '@/api/transactions'
import { dateFormat } from '@/utils/dateFormat'

const wallet = () => {
  const {userProfileData, authState: {token}} = useAuth()
  
  const {data} = useFetch(() => getTransactions({
    token
  }))
  console.log(userProfileData?.wallet, data?.data)


  return (
    <View className='flex-1 bg-primary'>
      <ScrollView>
         <View className='w-full flex-row justify-center mt-20 items-center -200'>
                    <Image source={icons.logo} className='w-12 h-10 '/>
        </View>
        <View className='min-h-20 mt-10 bg-gray-900 rounded-lg items- justify-center px-4'>
        
          <Text className='text-white text-3xl items-center '>
            {moneyFormat(userProfileData?.wallet.balance)}
 
          </Text>
        </View>
        <View className='py-10 flex-row justify-center '>
          <View className='bg-g justify-center items-center flex-1'>
            <Image tintColor={"#ffcc00"} source={icons.wallet} className='w-10 h-10' />
            <Text className='text-alt mt-4'>Fund Wallet</Text>
          </View>
          <View className='bg-g justify-center items-center flex-1'>
            <Image tintColor={"#ffcc00"} source={icons.wallet} className='w-10 h-10' />
            <Text className='text-alt mt-4'>Fund Wallet</Text>
          </View>
          <View className='bg-g justify-center items-center flex-1'>
            <Image tintColor={"#ffcc00"} source={icons.wallet} className='w-10 h-10' />
            <Text className='text-alt mt-4'>Fund Wallet</Text>
          </View>
          
          
         
          <View>
            <Image />
          </View>
        </View>
        <View className="m-4 border border-gray-300 rounded-lg overflow-hidden h-96">
      <View className="flex-row bg-gray-200 px-4 py-3">
        <Text className="flex-1 font-semibold text-gray-800">Status</Text>
        <Text className="flex-1 font-semibold text-gray-800 text-right">Amount (₦)</Text>

        <Text className="flex-1 font-semibold text-gray-800 text-right">Time </Text>
      </View>



      <ScrollView className="h-full">

        {data && data?.data.map((item, index) => (
          <View key={index} className="flex-row border-t border-gray-200 px-4 py-2">
            <Text className="flex-1 text-gray-200">{item.status}</Text>
            <Text className="flex-1 text-center text-white">{item.amount}</Text>
            <Text className="flex-1  text-right text-white">{dateFormat(item.created_at)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
      </ScrollView>
      <Text className='text-white'>wallet</Text>
    </View>
  )
}

export default wallet

const styles = StyleSheet.create({})