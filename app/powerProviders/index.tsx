import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'
import { useAuth } from '@/services/useAuth'
import { Link } from 'expo-router'
import { images } from '@/constants/images'
import { splitString } from '@/utils'
import powerDistribution from "../../data/powerDistributions.json"
import { PowerService } from '../(tabs)'
import PowerProviderCard from '@/components/ProviderCard'


const Index = () => {
    const {authState: {token}} = useAuth()
    
  return (
    <View className='flex-1 bg-primary'>
        <View className="mt-10">


            <Text className="text-lg text-white font-bold mb-3">Discos </Text>

            <FlatList
            numColumns={3}
            data={powerDistribution}
            contentContainerStyle={{
            paddingBottom: 10           
            }}
            showsHorizontalScrollIndicator={false}
            columnWrapperStyle={{
            justifyContent: "flex-start",
            
            gap: 10,
            paddingRight: 5,
            marginBottom: 10,
            // backgroundColor: "red"
            }}
            //  ItemSeparatorComponent={() => <View className="w-4 -red-50"/>}
            renderItem={({item}: any) => (
            <PowerProviderCard item={item} />

            )}
            keyExtractor={(item) => item?.id?.toString()}
            className="px-5"
            
            />

        
        </View>
        

    </View>
  )
}

export default Index
