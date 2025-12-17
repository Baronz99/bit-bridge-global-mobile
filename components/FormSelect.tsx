import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Picker } from '@react-native-picker/picker'

const FormSelect = ({ label, selectedValue, onValueChange, options, placeholder }: any) => {
  return (
    <View className="">
      <Text className="text-white mb-4">{label}</Text>

      <View
        style={{
          borderRadius: 4,
          // borderColor: '#ffcc00', // <-- ORANGE border color
          overflow: 'hidden',
        }}
      >
        <Picker
          placeholder={placeholder}
          selectedValue={selectedValue}
          onValueChange={onValueChange}
          style={{ color: 'white', backgroundColor: '#ffcc0018' }}
        >
          {options.map((option: any) => (
            <Picker.Item key={option.label} label={option?.label} value={option?.value} />
          ))}
        </Picker>
      </View>
    </View>
  )
}

export default FormSelect

const styles = StyleSheet.create({})
