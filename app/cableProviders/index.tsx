import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'
import { useAuth } from '@/services/useAuth'
import { Link } from 'expo-router'
import { images } from '@/constants/images'
import { splitString } from '@/utils'

const index = () => {
  const {
    authState: { token },
  } = useAuth()

  const { data } = useFetch(() =>
    getProducts({
      token,
      params: {
        category: 'utility',
      },
    })
  )

  const cableList: any[] = []
  const vtuList = []

  if (data) {
    for (const item of data) {
      for (const prov of item.provisions) {
        if (prov.service_type === 'TV') {
          cableList.push(prov)
        }
      }
    }
  }
  return (
    <View className="flex-1 bg-primary px-4">
      <View>
        {data && (
          <View>
            <View className="bg-gray-800 px-4 rounded-lg py-6 my-6">
              <Text className="font-medium text-xl text-white">Subscribe Cable TV</Text>
            </View>

            <FlatList
              data={cableList}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }: any) => (
                <Link href={`/cableProviders/${item.id}`} asChild>
                  <TouchableOpacity className="w-40 h-32 bg-gray-200 rounded overflow-hidden">
                    <Image source={images[`${splitString(item.name)}`]} className="w-full h-full" />
                  </TouchableOpacity>
                </Link>
              )}
              ItemSeparatorComponent={() => <View className="w-4" />}
            />
          </View>
        )}
      </View>
    </View>
  )
}

export default index

const styles = StyleSheet.create({})
