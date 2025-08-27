import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'

const UtilityCard = ({ item }: any) => {
  return (
    <Link href={item.link} asChild>
      <TouchableOpacity className="w-[45%]  bg--300">
        <Image source={item.image} className="w-full h-32" resizeMode="contain" />
        <Text className="text-center text-white my-2"> {item.label}</Text>
        <Text className="text-center text-white my-2"> {item.link}</Text>
        <TouchableOpacity className="py-2 px-4 bg-alt rounded-xl my-2 ">
          <Text className="text-center text-dark-200 font-medium ">{item.btn}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Link>
  )
}

export default UtilityCard

const styles = StyleSheet.create({})
