import React from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableNativeFeedback,
  View,
} from 'react-native'

const KeyboardAvoidWrapper = ({ children, scrollEnabled = true }) => {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 p-2">
        {scrollEnabled ? (
          <ScrollView showsVerticalScrollIndicator={false} className="">
            <TouchableNativeFeedback onPress={Keyboard.dismiss}>{children}</TouchableNativeFeedback>
          </ScrollView>
        ) : (
          <TouchableNativeFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1">{children}</View>
          </TouchableNativeFeedback>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

export default KeyboardAvoidWrapper
