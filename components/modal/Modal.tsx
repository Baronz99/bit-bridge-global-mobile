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
      <Pressable onPress={onclose} className="flex-1 bg-primary/50">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: Platform.OS === 'ios' ? 'center' : 'flex-start',
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <Pressable onPress={onclose} className="flex-1 justify-center items-center">
              <Pressable onPress={(event) => event.stopPropagation()} className="w-full px-4">
                <View style={{ width: '100%' }}>{children}</View>
              </Pressable>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

export default AppModal

