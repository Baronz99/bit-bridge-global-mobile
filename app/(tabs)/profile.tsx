import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { images } from '@/constants/images'
import { Link, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'

import { getTransactions } from '@/api/transactions'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { dateFormat } from '@/utils/dateFormat'
import { getUserOrders } from '@/api/billOrder'
import { icons } from '@/constants/icons'
import { AntDesign, Feather, FontAwesome, Ionicons } from '@expo/vector-icons'

const Profile = () => {

    const router = useRouter()
    const {userProfileData, authState: {token}} = useAuth()
  
    const {data, loading} = useFetch(() => getUserOrders({
      token
    }))
 
  console.log(userProfileData)
  return (
    <View className='flex-1 bg-primary'>
      <Image source={images.bg} resizeMode='cover' className='absolute top-0 left-0 w-full z-0'/>
      <ScrollView
      
      contentContainerStyle={{
        paddingBottom: 50
      }}>
     
        <View className="bg-gray-900 my-6 gap-4  flex-row justify-start items-center rounded-2xl h-28  px-6">
           <Image source={images.user} className='w-10 h-10 border-gray-800 bg-gray-600 rounded-full ' />
           <View>              
                 <Text className="text-white text-lg text-left font-bold ">{userProfileData?.user_profile?.first_name || "Unknown"}</Text>
                 <Text className="text-white text-lg text-left font-bold ">{userProfileData?.email}</Text>
            
            
            </View>           
             

        </View>

        
        
       <View className="flex-1 border-b mx-4  border-gray-600 pb-2 mb-2 overflow-hidden ">
          <View className='my-2 mx-4'>
            <Text className='text-white text-lg font-semibold'>Account</Text>

          </View>
       
          <View className='bg-gray-900 my-4 py-4 px-4 rounded-xl'>
            <Link href={"/"}  asChild>   
            <TouchableOpacity className='flex-row gap-4 items-center '>
              <FontAwesome name="user-o" size={20} color="white" />
              <Text className='text-white flex-1  '>My Profile</Text>
              <Feather name="arrow-right" size={20} color="white" />

            </TouchableOpacity>
            </Link>
          </View>
          
           <View className='my-2 mx-4'>
              <Text className='text-white text-lg font-semibold'>Privacy & Security</Text>
          </View>

          <View className='bg-gray-900 my-4 py-4 px-4 rounded-xl'>
            <Link href={"/"}  asChild>   
            <TouchableOpacity className='flex-row gap-4 items-center '>
              <Feather name="shield" size={20} color="white" />
              <Text className='text-white flex-1 '>Change Password</Text>
              <Feather name="arrow-right" size={20} color="white" />

            </TouchableOpacity>
            </Link>
          </View>

          <View className='my-2 mx-4'>
              <Text className='text-white text-lg font-semibold'>More</Text>
          </View>

          <View className='bg-gray-900 my-4 gap-6 py-4 px-4 rounded-xl'>
            <Link href={"/"}  asChild>   
            <TouchableOpacity className='flex-row gap-4 items-center '>
            <Ionicons name="document-text-outline" size={20} color="white" />  
            <Text className='text-white flex-1 '>Legal</Text>
              <Feather name="arrow-right" size={20} color="white" />

            </TouchableOpacity>
            </Link>
            <Link href={"/"}  asChild>   
            <TouchableOpacity className='flex-row gap-4 items-center '>
              <AntDesign name="delete" size={20} color="white" />   
              <Text className='text-white flex-1 '>Deactivate/Delete</Text>
              <Feather name="arrow-right" size={20} color="white" />

            </TouchableOpacity>
            </Link>  <Link href={"/"}  asChild>   
            <TouchableOpacity className='flex-row gap-4 items-center '>
              <AntDesign name="logout" size={20} color="white" /> 
              <Text className='text-red-700 flex-1 '>Log out</Text>
              <Feather name="arrow-right" size={20} color="white" />

            </TouchableOpacity>
            </Link>


            {/* <LinkView  icon={icons.legal} link={"/"} label={"Legal"}/>
            <LinkView  icon={icons.bin} link={"/"} label={"Deactivate"}/>
            <LinkView  icon={icons.login} link={"/"} label={"Log Out"} style={"danger"}/> */}
          </View>
        
        </View>
      </ScrollView>
    </View>
  )
}

const LinkView = ({
  link,
  label,
  icon,
  style
}: any) => {
  return (
    <Link href={link}  asChild>   
            <TouchableOpacity className='flex-row gap-5 items-center '>
              <Image source={icon}  tintColor={"white"} className='w-7 h-7' />
              <Text className={`${style==="danger" ? "text-red-600" : "text-white"} flex-1  '`}>{label}</Text>
              <Feather name="arrow-right" size={20} color="white" />

            </TouchableOpacity>
            </Link>
  )
}

export default Profile

