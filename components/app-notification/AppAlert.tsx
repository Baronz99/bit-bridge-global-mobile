import React from 'react'
import { View } from 'react-native'
import AppModal from '../modal/Modal'
import NotificationAlert from '../notification'

const AppAlert = ({
  message,
  error,
  data,
  onPress,
}: {
  message?: string | null
  error: boolean
  data?: any
  onPress?: () => void
}) => {
  return (
    <AppModal open={!!message} onclose={onPress}>
      <View className="w-full">
        <NotificationAlert message={message} error={error} data={data} onPress={onPress} />
      </View>
    </AppModal>
  )
}

export default AppAlert
