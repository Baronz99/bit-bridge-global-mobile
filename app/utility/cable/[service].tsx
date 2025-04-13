import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { useLocalSearchParams } from 'expo-router'

const CabledDetails = () => {
  const {service} = useLocalSearchParams()
  return (
    <View>
      <Text>Cabled: {service}</Text>
    </View>
  )
}

export default CabledDetails

const styles = StyleSheet.create({})