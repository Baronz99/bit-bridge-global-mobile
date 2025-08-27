import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { useLocalSearchParams } from 'expo-router'

const PowerView = () => {
  const { id } = useLocalSearchParams()
  return (
    <View>
      <Text>PowerView {id}</Text>
    </View>
  )
}

export default PowerView

const styles = StyleSheet.create({})
