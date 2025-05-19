import { ActivityIndicator, FlatList, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { Link, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'

import { getTransactions } from '@/api/transactions'
import { useAuth } from '@/services/useAuth'

import { getUserOrders } from '@/api/billOrder'
import { AntDesign, Feather, FontAwesome, Ionicons } from '@expo/vector-icons'
import AppModal from '@/components/modal/Modal'
import { userProfileDel } from '@/api/auth'

const index = () => {

    const {userProfileData, authState: {token}, loadProfile, onLogout} = useAuth()
  
    const [loading, setLoading] = useState(false)


    const handlePrivacy= async () => {
      setLoading(true)
      Linking.openURL("https://www.bitbridgeglobal.com/privacy-policy")

    }


  return (
    <>
    <View className='flex-1 bg-primary'>
      
      <ScrollView
      
      contentContainerStyle={{
        paddingBottom: 50
      }}>
     
 

        
        
       <View className="flex-1 border-b mx-4  border-gray-600 pb-2 mb-2 overflow-hidden ">
          
          <View className='bg-gray-900 my-4 gap-6 py-4 px-4 rounded-xl'>
            
            
            <TouchableOpacity
            onPress={handlePrivacy}
            
            className='flex-row gap-4 items-center '>
              <AntDesign name="delete" size={20} color="white" />   
              <Text className='text-white flex-1 '>           Privacy Policy</Text>
              <Feather name="arrow-right" size={20} color="white" />

            </TouchableOpacity>


            {/* <LinkView  icon={icons.legal} link={"/"} label={"Legal"}/>
            <LinkView  icon={icons.bin} link={"/"} label={"Deactivate"}/>
            <LinkView  icon={icons.login} link={"/"} label={"Log Out"} style={"danger"}/> */}
          </View>
        
        </View>
      </ScrollView>
    </View>

     
            </>
  )
}

export default index

