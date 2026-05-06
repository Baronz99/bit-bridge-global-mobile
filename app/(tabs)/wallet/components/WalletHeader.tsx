import React from 'react'
import { ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { View } from 'react-native'

type Props = {
  isTunnelMode: boolean
  hasLinearGradient: boolean
  cardClassName: string
  cardStyle: ViewStyle
  children: React.ReactNode
}

const WalletHeader = ({ isTunnelMode, hasLinearGradient, cardClassName, cardStyle, children }: Props) => {
  if (isTunnelMode && hasLinearGradient) {
    return (
      <LinearGradient
        colors={['rgba(255, 140, 0, 0.4)', 'rgba(11, 17, 32, 0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className={cardClassName}
        style={cardStyle}
      >
        {children}
      </LinearGradient>
    )
  }

  return (
    <View className={cardClassName} style={cardStyle}>
      {children}
    </View>
  )
}

export default WalletHeader
