import React from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'

export type AnchorAccountViewProps = {
  statusLabel?: string
  displayAccountNumber?: string | null
  rawAccountNumber?: string | null
  accountName?: string | null
  bankName?: string | null
}

const AnchorAccountView = ({
  statusLabel = 'Deposit account ready',
  displayAccountNumber,
  rawAccountNumber,
  accountName,
  bankName,
}: AnchorAccountViewProps) => {
  return (
    <View className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mt-6">
      <Text className="text-emerald-300 text-xs uppercase tracking-widest">{statusLabel}</Text>

      <View className="mt-4">
        <Text className="text-gray-400 text-xs">Account number</Text>
        <Text className="text-white text-3xl font-semibold mt-2">
          {displayAccountNumber || '----'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={async () => {
          if (!rawAccountNumber) {
            Alert.alert('Account number hidden', 'Open the account details to copy the full number.')
            return
          }
          try {
            const Clipboard = await import('expo-clipboard')
            await Clipboard.setStringAsync(String(rawAccountNumber))
            Alert.alert('Copied', 'Account number copied.')
          } catch {
            Alert.alert('Account number', String(rawAccountNumber))
          }
        }}
        className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full mt-4 self-start"
      >
        <Text className="text-white text-xs">Copy</Text>
      </TouchableOpacity>

      <View className="mt-4">
        {accountName ? <Text className="text-gray-300 text-sm">{accountName}</Text> : null}
        {bankName ? <Text className="text-gray-500 text-xs mt-1">{bankName}</Text> : null}
      </View>
    </View>
  )
}

export default AnchorAccountView
