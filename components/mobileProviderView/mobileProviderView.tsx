import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'
import { splitString } from '@/utils'
import { images } from '@/constants/images'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

const MobileProviderView = ({ data }: any) => {
  const dataList: any[] = []
  const vtuList = []

  if (data) {
    for (const item of data) {
      for (const prov of item.provisions) {
        if (prov.service_type === 'DATA') {
          dataList.push(prov)
        } else {
          vtuList.push(prov)
        }
      }
    }
  }
  return (
    <View>
      {data && (
        <View>
          <View className="bg-gray-800 px-4 rounded-lg py-6 my-6 overflow-hidden">
            <Text className="font-medium text-xl text-white">Airtime Top up</Text>
          </View>

          <FlatList
            data={vtuList}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Link href={`/mobileProviders/${item.id}`} asChild>
                <TouchableOpacity className="w-40 h-32 bg-gray-900 rounded">
                  <Image source={getImageByKey(String(splitString(item.name)))} className="w-full h-full" />
                </TouchableOpacity>
              </Link>
            )}
            ItemSeparatorComponent={() => <View className="w-4" />}
          />
        </View>
      )}

      {data && (
        <View>
          <View className="bg-gray-800 px-4 rounded-lg py-6 my-6">
            <Text className="font-medium text-xl text-white">Mobile Data</Text>
          </View>

          <FlatList
            data={dataList}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }: any) => (
              <Link href={'/data-subscription'} asChild>
                <TouchableOpacity className="w-40 h-32 bg-gray-200 rounded overflow-hidden">
                  <Image source={getImageByKey(String(splitString(item.name)))} className="w-full h-full" />
                </TouchableOpacity>
              </Link>
            )}
            ItemSeparatorComponent={() => <View className="w-4" />}
          />
        </View>
      )}
    </View>
  )
}

export default MobileProviderView
