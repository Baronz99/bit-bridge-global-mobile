import { getProducts } from "@/api/products";
import { icons } from "@/constants/icons";
import { images } from "@/constants/images";

import { useAuth } from "@/services/useAuth";
import useFetch from "@/services/useFetch";
import moneyFormat from "@/utils/moneyFormat";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import {splitString} from "@/utils/index"
import React, { useState } from "react";
import powerDistribution from "../../data/powerDistributions.json"
import PowerProviderCard from "@/components/ProviderCard";
import ProviderCard from "@/components/Card";
export default function Index() {
  const router = useRouter()
  const {authState: {token}, userProfileData} = useAuth()
  const [selectedService, setSelectedService] = useState<string>("Top Up")



  const {data, loading, error } = useFetch(() => getProducts({
    token,
    // params: {
    //   category: "mobile provider"
    // }
  }))
  


  const datalist = data?.flatMap((item: any) => {
    return item.provisions.flatMap((provision : any) =>  {
      if(provision.service_type === "DATA"){
        return provision
      }else{
       return  []
      }
    })})

      const VTUList = data?.flatMap((item: any) => {
        return item.provisions.flatMap((provision : any) =>  {
          if(provision.service_type === "VTU"){
            return provision
          }else{
            return []
          }})})


          const cableList = data?.flatMap((item: any) => {
            if(item.category === "utility"){
              return item.provisions.flatMap((provision: any) => (provision))
            }else{
            return []

            }
          })

   

  const prevsummary = [
 
    {
      id: 2,
      label: "Bought",
      amount: userProfileData?.wallet?.total_bills,
      icon: icons.walletColor
    },
    {
      id: 3,
      label: "Withdrawals",
      amount:  userProfileData?.wallet?.withdrawn,
      icon: icons.withdraw
    },
    {
      id: 4,
      label: "Sold",
      amount: 0,
      icon: icons.tag
    }
  ]

  const recentTransaction = [
    {
      id: 1,
      biller: "MTN",
      amount: "5000"
    },
    {
      id: 2,
      biller: "AIRTEL",
      amount: "5000"
    }
    ,
    {
      id: 3,
      biller: "GLO",
      amount: "5000"
    }
  ]



  const services = [
    {
      id: 1, 
      render:   <MobileService VTUList={VTUList} loading={loading} error={error} datalist={datalist} />
     , label: "Mobile Top Up",
      name: "Top Up",
      btn: "Mobile Top Up"
    },
    {
      id:2,
      render:   <CableService cableList={cableList}  />
    ,  label: "Subscribe Cable Tv",
      name: "TV Subscription",
      btn: "Tv Subscription"
    }
    ,
    {
      id:3,
      label: "Pay Electric Bills",
      name: "Electric Bills",
      btn: "Electric Bills",

      render:   <PowerService  powerList={powerDistribution} />

 
  }
  ]

  const pickedService = services.find(item => item.name === selectedService)



  return (
    <View
    className="flex-1 bg-primary" 
    >
      <Image  source={images.bg} className="absolute top-0 w-full z-0" />
      <ScrollView className="flex-1 px-5"
      contentContainerStyle={{
        minHeight: "100%",
        // backgroundColor: "red",
        paddingBottom: 100
      }}
      showsVerticalScrollIndicator={false}
      >
        {/* <Image source={icons.logo} className="w-12 h-10 mt-20 mb-5 mx-auto"/> */}
      <View className="flex-1">
        <View className="bg-gray-900/70  my-6 rounded-3xl min-h-40 py-7 px-6">
          <Text className="text-white text-left text-xl font-bold my-4">Wallet Balance</Text>
          <Text className="text-white text-left text-3xl font-bold">{moneyFormat(userProfileData?.wallet?.balance)}</Text>

          <View className="flex-row my-4 items-center gap-5">
            <Image source={icons.trophy} className="w-5 h-5" />
            <Text className="text-white">0.00</Text>

          </View>

        </View>
       


        <View className="my-10">

          <FlatList
          data={prevsummary}
          renderItem={({item}) => (
            <View className="bg-gray-800/50 p-4 rounded-lg flex-row items-center gap-3 mb-3">
              <Image source={item.icon} className="w-6 h-6" />
              <View>
                <Text className="text-base text-white/70 font-bold">{item.label}</Text>
                <Text className="text-sm text-gray-500">{moneyFormat(item.amount)}</Text>
              </View>
            </View>
          )}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={() => <View className="w-4"/>}
          />

          
        </View>

        <View className="">
          <FlatList
          data={recentTransaction}
          renderItem={({item}) => (
            <TouchableOpacity className="bg-alt/80 border rounded-lg text-sm h-16 w-20 shadow-sm flex flex-col justify-center items-center">
              <Text>{item.biller}</Text>
              <Text> {item.amount}</Text>

            </TouchableOpacity>
            )}

          keyExtractor={(item) => item.id.toString()}
          horizontal
          shouldRasterizeIOS={false}
          ItemSeparatorComponent={() => <View className="w-4"/>}
          
          />


        </View>
      </View>


      <View className="mb-6 p-4 ">
        <Text className="text-white">{pickedService?.label}</Text>
      </View>


      <ScrollView 
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 10
      }}

      className=" w-full">


      <View className="flex flex-row gap-3 w-full overflow-x-scroll">
        {services.map(item => (
          <TouchableOpacity
          key={item.id} onPress={() => setSelectedService(item.name)} ><Text className="text-white  font-semibold w-max bg-app-primary py-2.5 px-4 rounded-md">{item.label}</Text></TouchableOpacity>
        ))}
      </View>

      </ScrollView> 

      {
        loading ? <ActivityIndicator
        size={"large"} 
        color={"#000ff"}  
        className="mt-10 self-center"
        />
        : error ?  <Text className="text-white text-center">Error: {error?.message || "Something went wrong"}</Text>
        : services.map((item: any) => {
          if(item.name === selectedService ){
            return (item.render)
          }
         
        })
      }
      
     </ScrollView>
    </View>
  );
}

const MobileService = ({
 datalist, VTUList
}: any) => {
  return (

    <View>
        <View className="flex-1 mt-5">
    

        {datalist && (<>
          <View className="mt-10">
            <Text className="text-lg text-white font-bold mb-3">VTU Top Up </Text>

            <FlatList
            horizontal
            data={VTUList}

            showsHorizontalScrollIndicator={false}
            
            ItemSeparatorComponent={() => <View className="w-4 -red-50"/>}
            renderItem={({item}: any) => (
              <React.Fragment key={item?.id}>
              <Link href={`/mobileProviders/${item.id}`} asChild>
              
                <TouchableOpacity 
                 className="bg-gray-800/50 overflow-hidden rounded-lg w-40 h-40 flex-row items-center gap-3 mb-3">
                  <Image source={images[`${splitString(item.name)}`]} className="w-full h-full" />
                 
                </TouchableOpacity>
              
                </Link>
                </React.Fragment>

            )}
            keyExtractor={(item) => item?.id?.toString()}
            className="mb-4 mt-3"
            
            />


          </View>


            <View className="mt-10">
            <Text className="text-lg text-white font-bold mb-3">Mobile Data Top Up Movies </Text>

            <FlatList
            horizontal
            data={datalist}

            showsHorizontalScrollIndicator={false}
            
            ItemSeparatorComponent={() => <View className="w-4 -red-50"/>}
            renderItem={({item}: any) => (
              <React.Fragment >
              <Link href={`/mobileProviders/${item.id}`} asChild>
                <TouchableOpacity key={item?.id} className="bg-gray-800/50 overflow-hidden rounded-lg w-40 h-40 flex-row items-center gap-3 mb-3">
                  <Image source={images[`${splitString(item.name)}`]} className="w-full h-full" />
                 
                </TouchableOpacity>

                </Link>
               </React.Fragment>
              

            )}
            keyExtractor={(item) => item?.id?.toString()}
            className="mb-4 mt-3"
            
            />


            </View>

            </>

        )}
      
      </View>
  </View>

  )
}


const CableService = ({
 cableList
}: any) => {
  return (

    <View className="flex-1 mt-5">
      

      {cableList && (<>
        <View className="mt-10">
          <Text className="text-lg text-white font-bold mb-3">TV Subscription </Text>

          <FlatList
          horizontal
          data={cableList}

          showsHorizontalScrollIndicator={false}
          
          ItemSeparatorComponent={() => <View className="w-4 -red-50"/>}
          renderItem={({item}: any) => (
            <ProviderCard link={`/cableProviders/${item.id}`} item={item} />
            
            

          )}
          keyExtractor={(item) => item?.id?.toString()}
          className="mb-4 mt-3"
          
          />


      </View>


        

     </>

   )}
      
  </View>

  )
}

export const PowerService = ({
  powerList
 }: any) => {
  console.log("first: ===>", powerList)
   return (
 
     <View>
         <View className="flex-1 mt-5">
     
 
         {powerList && (
          <>
           <View className="mt-10">

             <Text className="text-lg my-10 text-white font-bold mb-3">Discos </Text>
 
             <FlatList
             numColumns={3}
             data={powerList}
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
 
 
            
 
             </>
 
         )}
       
       </View>
   </View>
 
   )
 }
