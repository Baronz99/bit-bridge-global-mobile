import React, { useEffect, useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import AppModal from '@/components/modal/Modal'

type TransactionPinModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (pin: string) => void | Promise<void>
  loading?: boolean
  title?: string
  errorMessage?: string | null
  helperActionLabel?: string
  onHelperAction?: () => void
}

const TransactionPinModal = ({
  open,
  onClose,
  onSubmit,
  loading = false,
  title,
  errorMessage,
  helperActionLabel,
  onHelperAction,
}: TransactionPinModalProps) => {
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (!open) setPin('')
  }, [open])

  const canSubmit = pin.length === 4 && !loading

  return (
    <AppModal open={open} onclose={onClose}>
      <View className="bg-gray-900 w-full rounded-xl px-4 py-6">
        <Text className="text-white text-center text-xl mb-4">
          {title || 'Enter Transaction PIN'}
        </Text>
        <TextInput
          value={pin}
          onChangeText={(text) => setPin(text.replace(/[^0-9]/g, ''))}
          placeholder="••••"
          placeholderTextColor="gray"
          keyboardType="numeric"
          maxLength={4}
          secureTextEntry
          className="border border-alt rounded px-4 py-3 text-white text-center text-lg tracking-widest"
        />
        {!!errorMessage && (
          <Text className="text-red-400 text-center mt-3">{errorMessage}</Text>
        )}
        {!!helperActionLabel && typeof onHelperAction === 'function' ? (
          <TouchableOpacity onPress={onHelperAction} className="mt-3">
            <Text className="text-gray-300 text-center text-xs underline">{helperActionLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <View className="flex-row gap-4 mt-6">
          <TouchableOpacity onPress={onClose} className="bg-black py-3 flex-1 rounded-xl">
            <Text className="text-white text-center">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onSubmit(pin)}
            disabled={!canSubmit}
            className={`${canSubmit ? 'bg-orange-700' : 'bg-gray-700'} py-3 flex-1 rounded-xl`}
          >
            <Text className="text-white text-center">{loading ? "Confirming..." : "Confirm"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppModal>
  )
}

export default TransactionPinModal
