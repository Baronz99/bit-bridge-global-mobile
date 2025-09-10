import { ActivityIndicator, View } from 'react-native'
import React from 'react'

const LoadingIndicator = () => {
  return (
    <View>
      <ActivityIndicator color={'#000ff'} size={'large'} />
    </View>
  )
}

export default LoadingIndicator
