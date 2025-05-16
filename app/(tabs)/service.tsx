import { FlatList, Image, ImageProps, ScrollView, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { images } from '@/constants/images'
import UtilityCard from '@/components/cards/Utility'
import { icons } from '@/constants/icons'
import { Link, RelativePathString } from 'expo-router'
import ViewBox from '@/components/view-box/ViewBoxIcon'

const Utilities = () => {
  const items = [
     {
    id: 0,
    label: "Airtime",
    btn: "Select Provider",
    link: "Airtime",
    image: icons.phone
  },{
    id: 1,
    label: "Electricity",
    btn: "Select Probider",
    link: "powerProviders",
    image: icons.electricity
  },
  {
    id: 2,
    label: "Data",
    btn: "Select Provider",
    link: "Airtime",
    image: icons.wifi
  },
  {
    id: 3,
    label: "Cable Tv",
    btn: "Select TV",
    link: "cableProviders",
    image: icons.television
  }]
  return (
    <View className='flex-1 px-4 bg-primary'>
      <ScrollView>

        <View className='bg-gray-900/60 p-4 rounded-xl'>
          <Text className='text-white'>Bill Payment</Text>
          <View className='py-4 flex-wrap gap-y-4 flex-row'>
            {items.map(item => (
            <ViewBox link={item.link} icon={item.image} label={item.label}/>

            ))}
          
          </View>
        </View>
        {/* <View className='mt-10'>
          <FlatList
          data={items}
          numColumns={2}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) =>  item.id?.toString()}
          contentContainerStyle={{
            paddingBottom: 40,
            gap: 40
          }}
          columnWrapperStyle={{
            gap: 90,
            paddingRight: 0
          

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
        </View> */}


      </ScrollView>
    </View>
  )


}



export default Utilities

const styles = StyleSheet.create({})