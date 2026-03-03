import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { BANK_TRANSFER_TIER_REQUIREMENT_COPY } from '@/utils/bankTransfer'

type TierGateCardProps = {
  onUpgrade: () => void
}

const TierGateCard = ({ onUpgrade }: TierGateCardProps) => (
  <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-2">
    <Text className="text-white text-lg font-semibold">Bank transfer access restricted</Text>
    <Text className="text-gray-300 mt-2 text-sm">{BANK_TRANSFER_TIER_REQUIREMENT_COPY}</Text>
    <Text className="text-gray-200 mt-2">{'\u2022'} Complete KYC to at least Tier 2</Text>
    <Text className="text-gray-200 mt-1">{'\u2022'} Tier 2 limit: 500,000 per calendar day</Text>
    <Text className="text-gray-200 mt-1">{'\u2022'} Tier 3 and Tier 4 limit: 3,000,000 per calendar day</Text>
    <TouchableOpacity onPress={onUpgrade} className="bg-theme-primary py-4 mt-5 rounded-xl">
      <Text className="text-alt text-center font-semibold">Upgrade to Tier 2</Text>
    </TouchableOpacity>
  </View>
)

export default TierGateCard
