import React from 'react'
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableNativeFeedback, View } from 'react-native'

const KeyboardAvoidWrapper = ({children}) => {
  return (
    <KeyboardAvoidingView 
    style={{flex: 1}} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 bg-gr p-2">
       <ScrollView
       showsVerticalScrollIndicator={false}
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