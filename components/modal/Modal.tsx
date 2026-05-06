import {
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native'
import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const AppModal = ({ open, onclose, children }: any) => {
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={open} transparent={true} animationType="fade" onRequestClose={onclose}>
      <Pressable
        onPress={onclose}
        className="flex-1 bg-primary/50 justify-center items-center"
        style={{ paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          className="w-full px-4"
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            >
              <View style={{ width: '100%' }}>{children}</View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default AppModal
