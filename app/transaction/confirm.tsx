import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link, useLocalSearchParams } from 'expo-router'
import { icons } from '@/constants/icons'
import { images } from '@/constants/images'

const confirm = () => {
    const {reference} = useLocalSearchParams()
  return (
    <View>

      <Image source={images.success} className='w-20 m-auto h-20' />
      <Link href={"/"}>
      <TouchableOpacity>
      <Text className='bg-alt border-primary rounded-lg py-2 text-center'>confirm</Text>

      </TouchableOpacity>
      </Link>
     
    </View>
  )
}

export default confirm

const styles = StyleSheet.create({})