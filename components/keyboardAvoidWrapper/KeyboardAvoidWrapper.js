import React from 'react'
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TouchableNativeFeedback, View } from 'react-native'

const KeyboardAvoidWrapper = ({children}) => {
  return (
    <KeyboardAvoidingView style={{flex: 1}} 
    behavior={Platform.OS === "ios" ? "padding" : undefined}
    className=' flex-1 p-4'>
      <View className="flex-1  p-2">

        <ScrollView
        className=''>
            <TouchableNativeFeedback onPress={Keyboard.dismiss}>
                {children}
            </TouchableNativeFeedback>
        </ScrollView>
        </View>

    </KeyboardAvoidingView>
  )
}

export default KeyboardAvoidWrapper