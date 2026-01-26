import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'
import { images } from '@/constants/images'
import powerDistribution from '../../data/powerDistributions.json'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

const Index = () => {
  return (
    <View className="flex-1 px-4 bg-primary">
      <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Utilities</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Electricity Bills</Text>
        <Text className="text-gray-400 mt-2 text-sm">
          Select your disco to buy power in seconds.
        </Text>
      </View>

      <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
        <Text className="text-white text-sm font-semibold">Choose Disco</Text>
        <FlatList
          numColumns={3}
          data={powerDistribution}
          contentContainerStyle={{
            paddingBottom: 10,
            marginTop: 12,
          }}
          showsHorizontalScrollIndicator={false}
          columnWrapperStyle={{
            justifyContent: 'flex-start',
            gap: 10,
            marginBottom: 10,
          }}
          renderItem={({ item }: any) => (
            <Link
              href={{
                pathname: '/electricity-provider/[id]',
                params: { id: String(item.id) },
              }}
              asChild
            >
              <TouchableOpacity
                key={item?.id}
                className="bg-gray-900 border border-gray-800 w-[30%] h-36 overflow-hidden rounded-2xl flex-row items-center"
              >
                <Image source={getImageByKey(String(item.image))} className="w-full h-full" />
              </TouchableOpacity>
            </Link>
          )}
          keyExtractor={(item) => item?.id?.toString()}
          className="px-5"
        />
      </View>
    </View>
  )
}

export default Index
