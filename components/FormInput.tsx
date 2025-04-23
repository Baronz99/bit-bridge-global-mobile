import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Fontisto, Ionicons, Octicons } from '@expo/vector-icons';
interface InputProps {
    
}
const FormInput = ({ label, icon, placeHolder, isPassword, hidePassword, setHidePassword, ...props }: any) => {
  return (
    <View style={{ marginBottom: 20 }}>
    <View className='absolute left-4'>
      <Octicons name={icon} size={30} color={"gray"} />
    </View>
    <Text className='text-white my-3'>{label}</Text>
    <TextInput
    placeholderTextColor={"gray"} placeholder={placeHolder} className='p-4 pr-20 border-alt border text-white rounded'{...props} 
    
    />
    {isPassword && (
      <TouchableOpacity
        onPress={() => setHidePassword(!hidePassword)}
        className='absolute right-3.5 top-7 z-10'
      >
        <Ionicons name={hidePassword ? 'eye-off' : 'eye'} size={30} color={"#9ca3af"} />
      </TouchableOpacity>
    )}
  </View>
  )
}

export default FormInput

const styles = StyleSheet.create({})