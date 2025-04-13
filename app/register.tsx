import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import React from 'react'

const Register = () => {
  return (
    <View className='flex-1 items-center'>

<TextInput placeholder='Email' className='border-gray-500 text-base font-semibold px-10 '/>
<TextInput placeholder='Password' className='border-gray-500 text-base font-semibold px-10 '/>
<TouchableOpacity>
<Text>login</Text>

</TouchableOpacity>
    </View>
  )
}

export default Register

const styles = StyleSheet.create({})