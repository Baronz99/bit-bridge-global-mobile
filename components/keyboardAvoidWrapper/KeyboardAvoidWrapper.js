import React from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  View,
} from 'react-native'

const KeyboardAvoidWrapper = ({ children, scrollEnabled = true, dismissOnTap = true }) => {
  const content = dismissOnTap ? (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{children}</TouchableWithoutFeedback>
  ) : (
    children
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <View className="flex-1 p-2">
        {scrollEnabled ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={{ paddingBottom: 80 }}
            className=""
          >
            {content}
          </ScrollView>
        ) : <View className="flex-1">{content}</View>}
      </View>
    </KeyboardAvoidingView>
  )
}

export default KeyboardAvoidWrapper

