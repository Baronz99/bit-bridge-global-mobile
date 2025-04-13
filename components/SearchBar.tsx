import { Image, StyleSheet, Text, TextInput, View } from 'react-native'
import React from 'react'
import { icons } from '@/constants/icons'

interface Props {
  placeHolder: string,
  onChangeText?: (text: string) => void,
  value?: string
  onPress?: () => void
}
const SearchBar = ({
  onPress, 
  value,
  onChangeText,
  placeHolder
}: Props) => {
  return (
    <View className='flex-row items-center bg-dark-200 rounded-full px-5 py-4'>
      <Image source={icons.search} className='size-5' resizeMode='contain' tintColor={"#ab8bff"} />
      <TextInput 
       onPress={onPress}
        placeholder={placeHolder} value={value}
         onChangeText={onChangeText}
          className='flex-1 ml-2 text-white ' placeholderTextColor={"#a8b5db"}/>
    </View>
  )
} 

export default SearchBar

const styles = StyleSheet.create({})