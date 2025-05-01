import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link, useLocalSearchParams } from 'expo-router'
import { icons } from '@/constants/icons'
import { images } from '@/constants/images'

const confirm = () => {
    const {reference} = useLocalSearchParams()
  return (
    <View className='flex-1 px-4 bg-primary'>
      <Text className='text-green-600  font-semibold text-xl mt-10 text-center'>
        Transaction completed
      </Text>
      <View className='m-auto w-full px bg-r'>
      <Image source={images.success} className='w-40 m-auto h-40' />
      <Link href={"/"} asChild>
      <TouchableOpacity className='bg-alt rounded w-full py-3 mt-10'>
      <Text className=' border-primary rounded-lg py-2 font-semibold text-xl text-center'>confirm</Text>

      </TouchableOpacity>
      </Link>
     


      </View>

     
    </View>
  )
}

export default confirm

const styles = StyleSheet.create({})