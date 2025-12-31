import React from 'react'
import { Image, Text, View } from 'react-native'

type Props = {
  icon: any // (Image source)
  label: string
}

const ICON_CONTAINER_SIZE = 56
const LABEL_WIDTH = 80

const ViewBox = ({ icon, label }: Props) => {
  return (
    <View className="flex-col items-center justify-center w-full h-full">
      <View
        className="bg-white/20 rounded-full items-center justify-center"
        style={{ width: ICON_CONTAINER_SIZE, height: ICON_CONTAINER_SIZE }}
      >
        <Image source={icon} tintColor="#ffcc00" resizeMode="contain" style={{ width: 22, height: 22 }} />
      </View>

      <Text
        className="text-white text-xs mt-2 text-center"
        style={{ width: LABEL_WIDTH }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </View>
  )
}

export default ViewBox
