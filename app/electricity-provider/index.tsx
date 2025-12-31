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
      <View className="mt-10">
        <Text className="text-lg ml-4 text-white font-bold mb-3">Discos </Text>

        <FlatList
          numColumns={3}
          data={powerDistribution}
          contentContainerStyle={{
            paddingBottom: 10,
          }}
          showsHorizontalScrollIndicator={false}
          columnWrapperStyle={{
            justifyContent: 'flex-start',

            gap: 10,
            // paddingRight: 5,
            marginBottom: 10,
            // backgroundColor: "red"
          }}
          //  ItemSeparatorComponent={() => <View className="w-4 -red-50"/>}
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
                className="bg-gray-800/50 w-[30%] h-40 overflow-hidden rounded-lg flex-row items-center mb-3"
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
