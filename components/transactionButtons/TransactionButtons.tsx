import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
interface TransactionButtonsProp {
  handleConfirmation: (method: string) => void
}

const TransactionButtons = ({ handleConfirmation }: TransactionButtonsProp) => {
  return (
    <View className="flex-row gap-4  bg-gray-900 px-4 rounded-lg py-2 ">
      <TouchableOpacity
        onPress={() => handleConfirmation('wallet')}
        className="border rounded-md flex-1  border-alt py-5 "
      >
        <Text className="text-alt text-center">Pay from Wallet </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleConfirmation('card')}
        className="border rounded-md  flex-1 border-green-400 py-5 "
      >
        <Text className="text-green-400 text-center">Pay from Bank? </Text>
      </TouchableOpacity>
    </View>
  )
}

export default TransactionButtons
const styles = StyleSheet.create({})
