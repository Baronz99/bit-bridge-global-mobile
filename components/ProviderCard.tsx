import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'
import { splitString } from '@/utils'
import { images } from '@/constants/images'

const PowerProviderCard = ({
    item
}: any) => {
    console.log(item)
  return (
    <Link href={`/powerProviders/${item.id}`} asChild>
               
    <TouchableOpacity 
     key={item?.id} className="bg-gray-800/50 w-[30%] h-20 overflow-hidden rounded-lg flex-row items-center gap-3 mb-3">
      <Image source={images[`${item.image}`]} className="w-full h-full" />
     <Text className="text-white">Hey</Text>
    </TouchableOpacity>
  
    </Link>
  )
}

export default PowerProviderCard

const styles = StyleSheet.create({})