import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'
import { useAuth } from '@/services/useAuth'
import { Link } from 'expo-router'
import { images } from '@/constants/images'
import { splitString } from '@/utils'
import MobileProviderView from '@/components/mobileProviderView/mobileProviderView'

const index = () => {
    const {authState: {token}} = useAuth()
    const {data} = useFetch(() => getProducts({
        token,
        params: {
            category: "mobile provider"
        }

    }))



  return (
    <View className='flex-1 bg-primary px-4'>
      <MobileProviderView data={data} />
    </View>
  )
}

export default index
