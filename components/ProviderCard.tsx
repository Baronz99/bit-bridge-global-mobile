import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'
import { splitString } from '@/utils'
import { images } from '@/constants/images'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

const PowerProviderCard = ({ item }: any) => {
  return (
    <Link href={`/powerProviders/${item.id}`} asChild>
      <TouchableOpacity
        key={item?.id}
        className="bg-gray-800/50 w-full overflow-hidden rounded-lg items-center justify-center mb-3"
        style={{ aspectRatio: 1 }}
      >
        <Image source={getImageByKey(String(item.image))} resizeMode="contain" className="w-full h-full" />
      </TouchableOpacity>
    </Link>
  )
}

export default PowerProviderCard

const styles = StyleSheet.create({})
