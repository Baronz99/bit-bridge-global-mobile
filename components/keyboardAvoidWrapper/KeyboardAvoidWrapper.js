import React from 'react'
import { Keyboard, KeyboardAvoidingView, ScrollView, TouchableNativeFeedback } from 'react-native'

const KeyboardAvoidWrapper = ({children}) => {
  return (
    <KeyboardAvoidingView style={{flex: 1}}>
        <ScrollView>
            <TouchableNativeFeedback onPress={Keyboard.dismiss}>
                {children}
            </TouchableNativeFeedback>
        </ScrollView>
    </KeyboardAvoidingView>
  )
}

export default KeyboardAvoidWrapper