import React from 'react'
import { Text, View } from 'react-native'

type MemberAvatarsProps = {
  initials: string[]
  size?: number
  max?: number
}

const MemberAvatars = ({ initials, size = 32, max = 3 }: MemberAvatarsProps) => {
  const list = initials.slice(0, max)
  if (list.length === 0) return null

  return (
    <View className="flex-row items-center">
      {list.map((value, index) => (
        <View
          key={`${value}-${index}`}
          className="rounded-full bg-gray-800 border border-gray-700 items-center justify-center"
          style={{
            height: size,
            width: size,
            marginLeft: index === 0 ? 0 : -(size * 0.3),
          }}
        >
          <Text className="text-white text-[10px] font-semibold">{value}</Text>
        </View>
      ))}
    </View>
  )
}

export default MemberAvatars
