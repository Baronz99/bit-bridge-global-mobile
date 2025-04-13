import MovieCard from "@/components/movieCard";
import SearchBar from "@/components/SearchBar";
import TrendingMovieCard from "@/components/trendingCard";
import { icons } from "@/constants/icons";
import { images } from "@/constants/images";
import { fetchMovies } from "@/services/api";
import { getTrendingMovies } from "@/services/app-write";
import useFetch from "@/services/useFetch";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, ScrollView, Text, View } from "react-native";

export default function Index() {
  const router = useRouter()

  const {data: trendingMovies, loading: trendingLoading, error: trendingError 

  } = useFetch(getTrendingMovies)

  const {data: movies, loading: moviesLoading, error: movieError } = useFetch(() => fetchMovies())


  return (
    <View
    className="flex-1 bg-primary"      
    >
      <Image  source={images.bg} className="absolute top-0 w-full z-0" />
      <ScrollView className="flex-1 px-5"
      contentContainerStyle={{
        minHeight: "100%",
        // backgroundColor: "red",
        paddingBottom: 10
      }}
      showsVerticalScrollIndicator={false}
      >
        <Image source={icons.logo} className="w-12 h-10 mt-20 mb-5 mx-auto"/>
        {
          moviesLoading || trendingLoading ?  (
            <ActivityIndicator 
            size={"large"} 
            color={"#000ff"}  
            className="mt-10 self-center"/>
          )
          : movieError || trendingError ? (
            <Text className="text-white text-center">Error: {movieError?.message || trendingError?.message}</Text>
          ): (
            <View className="flex-1 mt-5">
            <SearchBar
             placeHolder={"Search"} 
             onPress={()=> router.push("/search")} 
            />

            {trendingMovies && (
              <View className="mt-10">
                <Text className="text-lg text-white font-bold mb-3">Trending Movies </Text>

                <FlatList
                horizontal
                data={trendingMovies}

                showsHorizontalScrollIndicator={false}
               
                ItemSeparatorComponent={() => <View className="w-4 -red-50"/>}
                renderItem={({item, index}) => (
                 <TrendingMovieCard movie={item} index={index}/>
                )}
                keyExtractor={(item) => item.movie_id.toString()}
                className="mb-4 mt-3"
                
                />


                </View>
            )}
            <>
            
            <Text  className="text-lg text-white mt-5 mb-3">Lastest Movies</Text>
            <FlatList
            data={movies}
            renderItem={({item}) => (
              <MovieCard {...item}/>

              // <Text className="text-white"> {item?.title}</Text>
            )}
            keyExtractor={(item) => item.id.toString() }
            numColumns={3}

            columnWrapperStyle={{
              justifyContent: "flex-start",
              gap: 20,
              paddingRight: 5,
              marginBottom: 10
            }}
            className="mt-2 pb-32"
            scrollEnabled={false}
            />
              </>
          </View>
          )
        }
      
      </ScrollView>
    </View>
  );
}
