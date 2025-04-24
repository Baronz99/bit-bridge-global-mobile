import { Image, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { gifs } from '@/constants/gifs'

const Loader = () => {
  return (
    <View
    style={{ top: '50%', left: '50%', transform: [{ translateX: "-50%" }, { translateY: "-50%" }] }}
   className='bg-app-primary/80 rounded absolute  w-40 py-10'>
     <Image source={gifs.loader} className='w-20 h-20 m-auto' />
   </View>
  )
}

export default Loader

const styles = StyleSheet.create({})