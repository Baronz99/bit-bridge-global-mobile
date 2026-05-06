import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native'
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
  const processingNotice = useMemo(() => {
    if (biometricLoading) {
      return {
        title: 'Confirming with Face ID / Fingerprint',
        message: 'Approve the secure prompt on your device to continue.',
      }
    }
    if (loading) {
      return {
        title: 'Authorizing transfer',
        message: 'Your confirmation was received. Submitting the transfer securely now.',
      }
    }
    return null
  }, [biometricLoading, loading])

  return (
    <AppModal open={open} onclose={onClose}>
      <View className="bg-gray-900 w-full rounded-xl px-4 py-6">
        <Text className="text-white text-center text-xl mb-4">
          {title || 'Enter Transaction PIN'}
        </Text>
        {processingNotice ? (
          <View className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
            <View className="flex-row items-center justify-center gap-2">
              <ActivityIndicator size="small" color="#f59e0b" />
              <Text className="text-amber-200 text-center text-sm font-semibold">
                {processingNotice.title}
              </Text>
            </View>
            <Text className="text-amber-100/80 text-center text-xs mt-2">
              {processingNotice.message}
            </Text>
          </View>
        ) : null}
        {biometricEnabled && typeof onBiometricSubmit === 'function' ? (
          <View className="mb-4 rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-3">
            <Text className="text-gray-200 text-center text-sm font-medium">
              Use Face ID / Fingerprint for faster confirmation.
            </Text>
            <TouchableOpacity
              onPress={onBiometricSubmit}
              disabled={!canUseBiometric}
              className={`${canUseBiometric ? 'bg-gray-800' : 'bg-gray-900'} mt-3 py-3 rounded-xl`}
            >
              <Text className="text-white text-center">
                {biometricLoading ? 'Checking biometric...' : 'Use Face ID / Fingerprint'}
              </Text>
            </TouchableOpacity>
            <Text className="text-gray-400 text-center text-xs mt-3">Or enter your transaction PIN below.</Text>
          </View>
        ) : null}
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
        {biometricAvailable && !biometricEnabled ? (
          <View className="mt-4 rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-3">
            <Text className="text-gray-200 text-center text-sm font-medium">
              Your first successful PIN-confirmed bank transfer can enable Face ID / Fingerprint for future transfers.
            </Text>
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
            <Text className="text-white text-center">{loading ? "Submitting..." : "Confirm"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppModal>
  )
}

export default TransactionPinModal
