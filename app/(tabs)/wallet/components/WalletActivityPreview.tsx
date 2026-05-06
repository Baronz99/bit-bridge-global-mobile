import React from 'react'
import { View } from 'react-native'

type Props = {
  children: React.ReactNode
}

const WalletActivityPreview = ({ children }: Props) => {
  return <View className="mt-6">{children}</View>
}

export default WalletActivityPreview
