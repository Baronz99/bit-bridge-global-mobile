import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { images } from '@/constants/images'
import UtilityCard from '@/components/cards/Utility'

const Utilities = () => {
  const items = [{
    id: 1,
    label: "Electric Bills",
    btn: "Select Probider",
    link: "powerProviders",
    image: images.electricity
  },
  {
    id: 2,
    label: "Mobile Top Up",
    btn: "Select Provider",
    link: "mobileProviders",
    image: images.mobile
  },
  {
    id: 3,
    label: "Cable Tv",
    btn: "Select TV",
    link: "cableProviders",
    image: images.cable
  }]
  return (
    <View className='flex-1 px-4 bg-primary'>
      <ScrollView>
        <View className='mt-10'>
          <FlatList
          data={items}
          numColumns={2}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) =>  item.id?.toString()}
          contentContainerStyle={{
            paddingBottom: 10,
            gap: 40
          }}
          columnWrapperStyle={{
            gap: 20,
            paddingRight: 0,

          }}
          ListHeaderComponent={
            <View className='py-10 rounded-3xl bg-gray-900/60'>
              <Text className='text-white text-xl text-center'> Utilities</Text>

              </View>
          }
          renderItem={({item}: any) => (
            <UtilityCard item={item}/>
          )}
          
          />
        </View>


      </ScrollView>
    </View>
  )
}

export default Utilities

const styles = StyleSheet.create({})