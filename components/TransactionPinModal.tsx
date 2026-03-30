import React, { useEffect, useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import AppModal from '@/components/modal/Modal'

type TransactionPinModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (pin: string) => void | Promise<void>
  onBiometricSubmit?: () => void | Promise<void>
  loading?: boolean
  biometricLoading?: boolean
  biometricAvailable?: boolean
  biometricEnabled?: boolean
  title?: string
  errorMessage?: string | null
  helperActionLabel?: string
  onHelperAction?: () => void
}

const TransactionPinModal = ({
  open,
  onClose,
  onSubmit,
  onBiometricSubmit,
  loading = false,
  biometricLoading = false,
  biometricAvailable = false,
  biometricEnabled = false,
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
  const canUseBiometric = biometricAvailable && biometricEnabled && !loading && !biometricLoading

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
        {biometricAvailable ? (
          <View className="mt-4 rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-3">
            <Text className="text-gray-200 text-center text-sm font-medium">
              {biometricEnabled
                ? 'Use Face ID / Fingerprint instead of typing your PIN.'
                : 'Your first successful PIN confirmation on this device will enable Face ID / Fingerprint for next time.'}
            </Text>
            {biometricEnabled && typeof onBiometricSubmit === 'function' ? (
              <TouchableOpacity
                onPress={onBiometricSubmit}
                disabled={!canUseBiometric}
                className={`${canUseBiometric ? 'bg-gray-800' : 'bg-gray-900'} mt-3 py-3 rounded-xl`}
              >
                <Text className="text-white text-center">
                  {biometricLoading ? 'Checking biometric...' : 'Use Face ID / Fingerprint'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
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
