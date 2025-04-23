import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Picker } from '@react-native-picker/picker';


const FormSelect = ({
    name,
    label,
    placeHolder,
    selectedValue,
    onValueChange,
    options
}) => {

  return (
    <View className=''>
      <Text className='text-white'>{label}</Text>

      <Picker
      className='bg-yellow-200'
       selectedValue={selectedValue}
       onValueChange={onValueChange}
       >
  {
            options.map((option: any) => (
                <Picker.Item key={option.label} label={option.label}value={option.value}/>


            ))
        }

      </Picker>
      {/* <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
     
      >
      
        
      </Picker> */}
    </View>
  )
}

export default FormSelect

const styles = StyleSheet.create({})