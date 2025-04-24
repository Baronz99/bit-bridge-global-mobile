import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { images } from '@/constants/images'
import MovieCard from '@/components/movieCard'
import { useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { fetchMovies } from '@/services/api'
import { icons } from '@/constants/icons'
import SearchBar from '@/components/SearchBar'
import { updateSearchCount } from '@/services/app-write'

const Transactions = () => {

    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")

   
    const {data: movies, reset, refetch: loadMovies, loading: moviesLoading, error: movieError } = useFetch(() => fetchMovies({
      query: searchQuery
    }), false)

    useEffect(()=> {
      const timeoutId = setTimeout(async() =>{
  
      if(searchQuery.trim()){ 
        await loadMovies()
      
      }
      else{
        reset()
      }

    }, 500)


    return () => clearTimeout(timeoutId)

    },[searchQuery])

    useEffect(() => {
      if(movies?.length > 0 && movies?.[0]){
        updateSearchCount(searchQuery, movies[0])      

       }
    }, [movies])
  
  
  return (
    <View className='flex-1 bg-primary'>
      <Image source={images.bg} resizeMode='cover' className='absolute w-full z-0'/>
      <FlatList
      className='px-5'
      numColumns={3}
      contentContainerStyle={{
        paddingBottom: 100
      }}
       keyExtractor={(item) => item.id.toString()}
      renderItem={({item}) => <MovieCard {...item}/>}
      columnWrapperStyle={{
        justifyContent: "center",
        gap: 16,
        marginVertical: 16
      }}
      ListHeaderComponent={
        <>
        <View className='w-full flex-row justify-center mt-20 items-center'>
            <Image source={icons.logo} className='w-12 h-10 '/>
        </View>
        <View className='my-5'>
          <SearchBar value={searchQuery}
           onChangeText={(text: string)=> setSearchQuery(text)}
            onPress={()=> {}} placeHolder='Search Movies' />

        </View>
        {moviesLoading && (
          <ActivityIndicator size={"large"} color={"#000ff"} className='my-3'/>
        )}
        {movieError && (
          <Text className='text-red-500 px-5 my-3'>
            Error: {movieError.message}

          </Text>
        )}

{/* {! &&   ? length > 0 &&  } */}


        {!moviesLoading && !movieError  && searchQuery.trim() && movies?.length > 0 && (
          <Text className='text-lg'>
            Search for {" "}

            <Text className='text-accent'> {searchQuery}</Text>

          </Text>
        )

        }
      
        </>
      }
      ListEmptyComponent={
        !moviesLoading && !movieError ? (
          <View className='mt-10 px-5 '>
            <Text className='text-center text-gray-500'>
              {searchQuery.trim() ? "No movie found" : "Search for a movie"}

            </Text>


            </View>
        ) : null
      }
      data={movies}/>
    </View>
  )
}

export default Transactions

const styles = StyleSheet.create({})