import React from 'react'
import { View } from 'react-native'

type Props = {
  children: React.ReactNode
}

const WalletActions = ({ children }: Props) => {
  return <View className="mt-6 rounded-[28px] bg-[#121418] px-5 py-5 border border-white/6">{children}</View>
}

export default WalletActions
