import React from 'react'
import { Feather } from '@expo/vector-icons'
import { TextInput, TouchableOpacity, View } from 'react-native'

export default function CommandSearchInput({
  value,
  onChangeText,
  onClose,
}: {
  value: string
  onChangeText: (value: string) => void
  onClose: () => void
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <Feather name="search" size={18} color="#CBD5E1" />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        placeholder="Send money, electricity, cards..."
        placeholderTextColor="#64748B"
        value={value}
        onChangeText={onChangeText}
        className="flex-1 text-[15px] text-white"
      />
      <TouchableOpacity accessibilityRole="button" onPress={onClose}>
        <Feather name="x" size={18} color="#CBD5E1" />
      </TouchableOpacity>
    </View>
  )
}
