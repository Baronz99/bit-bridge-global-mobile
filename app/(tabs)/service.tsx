import React, { useMemo } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { icons } from '@/constants/icons'
import { useRouter } from 'expo-router'
import ViewBox from '@/components/view-box/ViewBoxIcon'
import ScreenContainer from '@/components/ScreenContainer'
import { useAuth } from '@/services/useAuth'
import { getTierFromProfile, isTierEligibleForBankTransfer } from '@/utils/bankTransfer'

const Utilities = () => {
  const router = useRouter()
  const { userProfileData } = useAuth()
  const canUseBankTransfer = isTierEligibleForBankTransfer(getTierFromProfile(userProfileData))
  const sections = useMemo(
    () => [
      {
        title: 'Pay & Top Up',
        description: 'Everyday utility payments in seconds.',
        items: [
          { id: 0, label: 'Airtime', link: '/airtime-top-up', image: icons.phone },
          { id: 2, label: 'Data', link: '/data-subscription', image: icons.wifi },
          { id: 1, label: 'Electricity', link: '/powerProviders', image: icons.electricity },
          { id: 3, label: 'Cable TV', link: '/cableProviders', image: icons.television },
        ],
      },
      {
        title: 'Move Money',
        description: 'Send, transfer, and manage recipients.',
        items: [
          { id: 7, label: 'Send Money', link: '/send-money', image: icons.transfer },
          ...(canUseBankTransfer
            ? [{ id: 8, label: 'Bank Transfer', link: '/bank-transfer', image: icons.transaction }]
            : []),
          { id: 5, label: 'Beneficiaries', link: '/beneficiaries', image: icons.user },
        ],
      },
      {
        title: 'Accounts',
        description: 'View and manage deposit accounts.',
        items: [{ id: 12, label: 'Deposit Accounts', link: '/accounts', image: icons.wallet }],
      },
    ],
    [canUseBankTransfer]
  )

  return (
    <ScreenContainer>
        <View className="rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white text-2xl font-semibold">Services</Text>
          <Text className="text-gray-400 mt-2 text-sm">
            Everything you need to pay bills, move money, and manage your accounts.
          </Text>
          <View className="flex-row gap-2 mt-4">
            <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-300">Fast payments</Text>
            </View>
            <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-300">Secure transfers</Text>
            </View>
          </View>
        </View>

        <View className="mt-6 gap-6">
          {sections.map((section) => (
            <View key={section.title} className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <Text className="text-white text-lg font-semibold">{section.title}</Text>
              <Text className="text-gray-400 text-xs mt-1">{section.description}</Text>

              <View className="flex-row flex-wrap mt-4">
                {section.items.map((item) => (
                  <View key={item.id} className="w-1/2 p-2">
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => router.push(item.link as any)}
                      className="rounded-2xl border border-gray-800 bg-gray-950/70 px-3 py-4 items-center"
                    >
                      <ViewBox icon={item.image} label={item.label} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScreenContainer>
  )
}

export default Utilities
