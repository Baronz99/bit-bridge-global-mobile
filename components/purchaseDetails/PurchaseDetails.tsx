import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import Summary from '../cards/Summary'

const PurchaseDetails = ({ title, data }: any) => {
  return (
    <View className="bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
      <Text className="text-lg font-semibold text-center text-gray-200 mb-4">{title}</Text>

      <Summary data={data} />
    </View>
  )
}

export default PurchaseDetails

const styles = StyleSheet.create({})
