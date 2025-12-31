import { View } from 'react-native'
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
      <MobileProviderView data={data} />
    </View>
  )
}

export default index
