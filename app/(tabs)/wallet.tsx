import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { icons } from '@/constants/icons'
import useFetch from '@/services/useFetch'
import { getTransactions } from '@/api/transactions'
import { dateFormat } from '@/utils/dateFormat'
import { useRouter } from 'expo-router'

const wallet = () => {
  const {userProfileData, authState: {token}} = useAuth()
  const router  = useRouter()
  
  const {data, loading} = useFetch(() => getTransactions({
    token, 
    params: {
      transaction_type: "deposit"

    }
  }))


  return (
    <View className='flex-1 bg-primary px-4'>
      <ScrollView>
        
        <View className='min-h-40 pt-20 bg-gray-900 rounded-3xl items- justify-center px-4'>
        <Text className='text-center text-white my-4'>Your Wallet Ballance</Text>
          <Text className='text-white text-4xl font-medium  text-center '>
            {moneyFormat(userProfileData?.wallet.balance)}
 
          </Text>
        <View className='py-10 flex-row justify-center '>
          <TouchableOpacity onPress={() => router.push('/fundWallet') } className='bg-g justify-center items-center flex-1'>
            <Image tintColor={"#ffcc00"} source={icons.wallet} className='w-10 h-10' />
            <Text className='text-alt mt-4'>Fund Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/withdrawFund')} className='bg-g justify-center items-center flex-1'>
            <Image tintColor={"#ffcc00"} source={icons.withdrawal} className='w-10 h-10' />
            <Text className='text-alt mt-4'>Withdraw Fund</Text>
          </TouchableOpacity>
          <TouchableOpacity 
          onPress={() => router.push("/transaction/confirm")} 
          className='bg-g justify-center items-center flex-1'>
            <Image tintColor={"#ffcc00"} source={icons.transfer} className='w-10 h-10' />
            <Text className='text-alt mt-4'>Fund Transafer</Text>
          </TouchableOpacity>
          
          
        
        </View>
        </View>

        <View className="mt-7 border border-gray-600 bg-primary rounded-lg overflow-hidden h-96">
          <View className="flex-row bg-gray- px-4 py-3">
            <Text className="flex-1 font-semibold text-gray-300">Status</Text>
            <Text className="flex-1 font-semibold text-gray-300 text-center">Amount (₦)</Text>

            <Text className="flex-1 font-semibold text-gray-300 text-right">Time </Text>
          </View>



      <ScrollView className="h-full">

        {loading ? <ActivityIndicator className='mt-10' size={"large"}/> :  data && data?.data.map((item, index) => (
          <View key={index} className="flex-row border-t border-gray-600 px-4 py-2">
            <Text className={`${item.status === "approved" ? "text-green-500" : item.status === "initialized" ? "text-gray-200" : "text-red-600"} flex-1 `}>{item.status}</Text>
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

export default wallet

const styles = StyleSheet.create({})