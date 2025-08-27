import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import React from 'react'

const LoaderScreen = () => {
  return (
    <View className="bg-primary flex-1 justify-center items-center">
      <ActivityIndicator />
    </View>
  )
}

export default LoaderScreen

const styles = StyleSheet.create({})
