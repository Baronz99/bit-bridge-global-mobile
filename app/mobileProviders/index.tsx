import { View, Text } from 'react-native'
import React, { useCallback } from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'

import MobileProviderView from '@/components/mobileProviderView/mobileProviderView'

const index = () => {
  const fetchProducts = useCallback(() => {
    return getProducts({
      category: 'mobile provider',
    })
  }, [])
  const { data } = useFetch(fetchProducts)

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Mobile</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Mobile Providers</Text>
        <Text className="text-gray-400 mt-2 text-sm">
          Pick a provider to top up airtime or data.
        </Text>
      </View>

      <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
        <MobileProviderView data={data} />
      </View>
    </View>
  )
}

export default index
