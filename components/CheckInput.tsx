import React from 'react'
import { Text, Pressable, View } from 'react-native'

type ConsentCheckboxProps = {
  checked: boolean
  setChecked: (next: boolean) => void
}

export default function ConsentCheckbox({ checked, setChecked }: ConsentCheckboxProps) {
  return (
    <Pressable
      className={`border-2 items-center justify-center border-gray-600 w-6 h-6 mr-4 ${checked && 'bg-[#2563e'}`}
      // style={[styles.checkbox, checked && styles.checkedBox]}
      onPress={() => setChecked(!checked)}
    >
      {checked && (
        <View className="bg-alt w-full h-full items-center justify-center">
          <Text className='text-gray-800'>✓</Text>

        </View>
      )}
    </Pressable>
  )
}
