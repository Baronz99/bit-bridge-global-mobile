import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'
import { splitString } from '@/utils'
import { images } from '@/constants/images'

const ProviderCard = ({
    item,
    link
}: any) => {
    console.log("item =====>", item.name, splitString(item.name))
  return (
    <Link href={link} asChild>
               
        <TouchableOpacity 
        key={item?.id} className="bg-gray-900 w-40 h-40 overflow-hidden rounded-lg flex-row items-center gap-3 mb-3">
        <Image source={images[`${splitString(item.name)}`]} 
        resizeMode='contain' className="w-full h-full object-contain" />
        {/* <Text className="text-white">Hey</Text> */}
        </TouchableOpacity>
  
    </Link>
  )
}

export default ProviderCard
