import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { icons } from '@/constants/icons'
import { Link } from 'expo-router'
import ViewBox from '@/components/view-box/ViewBoxIcon'

const Utilities = () => {
  const items = useMemo(
    () =>
      [
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
      ] as const,
    []
  )

  return (
    <View className="flex-1 px-4 bg-primary">
      <ScrollView>
        <View className="bg-gray-900/60 p-4 rounded-xl">
          <Text className="text-white">Bill Payment</Text>

          <View className="py-4 flex-wrap gap-y-4 flex-row">
            {items.map((item) => (
              <Link key={item.id} href={item.link as any} asChild>
                <TouchableOpacity activeOpacity={0.9}>
                  <ViewBox icon={item.image} label={item.label} />
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default Utilities

const styles = StyleSheet.create({})
