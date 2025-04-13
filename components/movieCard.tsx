import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'
import { icons } from '@/constants/icons'

const MovieCard = ({
    release_date,
    id, 
    poster_path, 
    title, 
    vote_average
} : Movie) => {
  return (
    <Link href={`/movies/${id}`} asChild>
      <TouchableOpacity className='w-[30%]'
      >
        <Image
        source={{
            uri: poster_path ?
            `https://image.tmdb.org/t/p/w500${poster_path}` :
            `https://placeholder.co/600x400/1a1a1a/ffffff.png`

        }}
        className='w-full h-52 rounded'
        resizeMode='cover'
        />
          <Text numberOfLines={1} className='text-sm font-bold text-white mt-2'>{title}</Text>
          <View className='flex-row items-center justify-start gap-x-1'>
            <Image source={icons.star} className='size-4' />
            <Text className='text-white font-bold text-xs '>{Math.round(vote_average /2) }</Text>

          </View>
          <View className='flex-row items-center justify-between'>
          <Text className='text-sm text-ligth-300 font-medium mt-1'>
                {release_date?.split("_")[0]}
            </Text> 
               <Text className='text-sm  text-ligth-300 font-medium mt-1'>
                {/* {release_date?.split("_")[0]}  */}
                Movie
            </Text>

          </View>
      </TouchableOpacity>
    </Link>
  )
}

export default MovieCard

const styles = StyleSheet.create({})