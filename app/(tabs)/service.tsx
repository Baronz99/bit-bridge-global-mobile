import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { icons } from '@/constants/icons'
import { useRouter } from 'expo-router'
import ViewBox from '@/components/view-box/ViewBoxIcon'

const Utilities = () => {
  const router = useRouter()
  const items = useMemo(
    () => {
      return [
        {
          id: 0,
          label: 'Airtime',
          btn: 'Select Provider',
          link: '/airtime-top-up',
          image: icons.phone,
        },
        {
          id: 1,
          label: 'Electricity',
          btn: 'Select Provider',
          link: '/powerProviders',
          image: icons.electricity,
        },
        {
          id: 2,
          label: 'Data',
          btn: 'Select Provider',
          link: '/data-subscription',
          image: icons.wifi,
        },
        {
          id: 3,
          label: 'Cable Tv',
          btn: 'Select TV',
          link: '/cableProviders',
          image: icons.television,
        },
        {
          id: 4,
          label: 'Bank List',
          btn: 'Select Bank',
          link: '/bank-list',
          image: icons.transfer,
        },
        {
          id: 5,
          label: 'Beneficiaries',
          btn: 'View',
          link: '/beneficiaries',
          image: icons.transfer,
        },
        {
          id: 6,
          label: 'Add Beneficiary',
          btn: 'Add',
          link: '/add-beneficiary',
          image: icons.transfer,
        },
        {
          id: 7,
          label: 'Bank Transfer',
          btn: 'Send',
          link: '/bank-transfer',
          image: icons.transfer,
        },
        {
          id: 8,
          label: 'Tunnel Activation',
          btn: 'Activate',
          link: '/tunnel-activation',
          image: icons.transfer,
        },
        {
          id: 9,
          label: 'Convert NGN to USD',
          btn: 'Convert',
          link: '/convert-ngn-to-usd',
          image: icons.transfer,
        },
        {
          id: 10,
          label: 'Convert USD to NGN',
          btn: 'Convert',
          link: '/convert-usd-to-ngn',
          image: icons.transfer,
        },
      ] as const
    },
    []
  )

  return (
    <View className="flex-1 px-4 bg-primary">
      <ScrollView>
        <View className="bg-gray-900/60 p-4 rounded-xl">
          <Text className="text-white">Bill Payment</Text>

          <View className="py-4 flex-wrap gap-y-4 flex-row">
            {items.map((item) => (
              <View key={item.id} className="w-1/4 items-center mb-4">
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push(item.link as any)}
                >
                  <ViewBox icon={item.image} label={item.label} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>
    </View>
  )
}

export default Utilities

const styles = StyleSheet.create({})
