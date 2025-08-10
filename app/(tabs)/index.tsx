import { getProducts } from "@/api/products";
import { icons } from "@/constants/icons";
import { images } from "@/constants/images";

import { useAuth } from "@/services/useAuth";
import useFetch from "@/services/useFetch";
import moneyFormat from "@/utils/moneyFormat";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import {splitString} from "@/utils/index"
import React, { useEffect, useState } from "react";
import powerDistribution from "../../data/powerDistributions.json"
import PowerProviderCard from "@/components/ProviderCard";
import ProviderCard from "@/components/Card";
import AppModal from "@/components/modal/Modal";
import Loader from "@/components/Loader";
import { getRescentPurchaseOrder, repurchaseOrder } from "@/api/billOrder";
import NotificationAlert from "@/components/notification";
import useNotification from "@/hooks/useNotification";
import { AntDesign, Feather } from "@expo/vector-icons";
import ViewBox from "@/components/view-box/ViewBoxIcon";
import FormInput from "@/components/FormInput";
import { createBankAccount } from "@/api/account";
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export default function Index() {
  const router = useRouter()
  const {authState: {token}, userProfileData, loadProfile} = useAuth()
  const [selectedService, setSelectedService] = useState<string>("Top Up")
  const [bvnNumber, setBvnNumber] = useState<string>("")
  const [billOrder, setBillOrder] = useState<any | null>(null)
  const [openModal, setOpenModal] = useState(false)
  const {notification, setNotification} = useNotification()
  const [toggleAlert, setToggleAlert] = useState(false)
  const [toggleBvn, setToggleBvn] = useState(false)
  const {data, loading, error } = useFetch(() => getProducts({
    token,
  }))

  const [getstarted, setOpenStarted] = useState(false)

console.log("Runtime Version:", Constants.manifest2?.runtimeVersion);

  const {data: recentTransaction } = useFetch(() => getRescentPurchaseOrder({token}))
  
  const items = [
       {
      id: 0,
      label: "Airtime",
      btn: "Select Provider",
      link: "/airtime-top-up",
      image: icons.call
    }, 
    {
      id: 2,
      label: "Data",
      btn: "Select Provider",
      link: "/data-subscription",
      image: icons.data
    },{
      id: 1,
      label: "Electricity",
      btn: "Select Probider",
      link: "/electricity-provider",
      image: icons.power
    },
   
    {
      id: 3,
      label: "Cable Tv",
      btn: "Select TV",
      link: "/cable-tv-provider",
      image: icons.tv
    }]

    useEffect(() => {
      setToggleBvn(!userProfileData?.account)
    },[userProfileData])

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

  const [loader, setLoader] = useState(false)

  
  const handleRepurchase = async(id: string) => {

    try{
    const response =  await repurchaseOrder({
        id,
        token
      })

      setOpenModal(false)
      setToggleAlert(true)
      setNotification({
        error: false,
        message: response.message,
        data: response.data
      })
    }catch(error: any){
      error?.message
      setLoader(false)
      setOpenModal(false)

      setToggleAlert(true)
      setNotification({
        error: true,
        message: error.message,
        data: null
   
      })


    }
   

}
  const pickedService = services.find(item => item.name === selectedService)

  useEffect(()=> {
    loadProfile(token)
  },[])

  return (
    <>
    <View
    className="flex-1 bg-primary" 
    >
      <Image  source={images.bg} className="absolute top-0 w-full z-0" />
      <ScrollView className="flex-1 px-5"
      contentContainerStyle={{
        minHeight: "100%",
        paddingBottom: 100
      }}
      showsVerticalScrollIndicator={false}
      >
        {/* <Image source={icons.logo} className="w-12 h-10 mt-20 mb-5 mx-auto"/> */}
      <View className="flex-1">
        <View className="bg-purple-700 my-6 flex-row justify-between rounded-2xl h-28  px-6">
            {loading ? <ActivityIndicator/> : 
            <>
            <View>
                 <Text className="text-white text-base text-left font-bold mt-2">Wallet Balance</Text>
                <Text className="text-white text-left text-lg  font-bold">{moneyFormat(userProfileData?.wallet?.balance)}</Text>
             
              
             <View className="flex-row my-1 items-center gap-2">
              <Image source={icons.trophy} className="w-5 h-5" />
                <Text className="text-white">0.00</Text>
              </View>  

            </View>
         

             <View className="flex-col my-2 items-center gap-2">

                <TouchableOpacity 
                onPress={() => router.push("/history") }
                className="gap-3 font-semibold items-center rounded-2xl flex-row py-1 px-4">
                  <Text className="text-white">
                    History
                  </Text>
                  <Feather name="arrow-right" size={14} color="white" />
                </TouchableOpacity>             
                <TouchableOpacity 
                 onPress={() => router.push("/fundWallet") }

                className="bg-purple-900 font-semibold rounded-2xl py-2 px-4">
                  <Text className="text-white">
                    Fund Wallet
                  </Text>
                </TouchableOpacity>

              </View>
           
            </>}
              
             

        </View>

        {/* <TouchableOpacity onPress={() => {
          setOpenStarted(true)
          console.log("first")}} className='border rounded-md mt-4 border-green-400 py-5 '>
                                  <Text className='text-green-400 text-center'>Pay from Bank </Text>
                  </TouchableOpacity> */}

        {userProfileData?.account && (

           <TouchableOpacity
           onPress={() => router.push("/accountDetails")} className="my-4 bg-gray-900   py-2 w-48 flex flex-row gap-4 items-center rounded-2xl px-4">
                 <Text className="text-white -900 text-lg text-left font-bold ">Moniepoint</Text>
                 <AntDesign name="caretdown" size={14} color="gray" />

            </TouchableOpacity>
        )}

        {/* <Text className="text-white">{Constants.manifest2?.runtimeVersion}</Text> */}
  {/* <View style={{ padding: 20 }}>
      <Text className="text-white">Runtime: {Constants.manifest2?.runtimeVersion}</Text>
      <Text className="text-white">Update ID: {Updates.updateId ?? 'No update applied'}</Text>
      <Text className="text-white">Is Embedded:: {Updates.isEmbeddedUpdate ? 'Yes' : 'No'}</Text>
    </View> */}

        <View className='bg-gray-900/60 p-4 rounded-xl'>
          {/* <Text className='text-white'>Bill Payment</Text> */}
          <View className='py-4 flex-wrap gap-y-4 flex-row'>
            {items.map(item => (
            <ViewBox link={item.link} icon={item.image} label={item.label}/>

            ))}
          
          </View>
        </View>
        <View className='w-14 h-14 bg-white/20 rounded-full justify-center items-center'>
            <Image source={icons.tv} className='w-6 h-6 rounded-full p-4'  />
            </View>
            


        <View className="my-10"
        >
          <FlatList
          data={prevsummary}
          renderItem={({item}) => (
            
            <TouchableOpacity className="bg-gray-800/50 p-4 min-w-40 rounded-lg flex-row items-center gap-3 mb-3">
              <Image source={item.icon} className="w-6 h-6" />
              <View>
                <Text className="text-base text-white/70 font-bold">{item.label}</Text>
                <Text className="text-sm text-gray-500">{moneyFormat(item.amount)}</Text>
              </View>
            </TouchableOpacity>
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
            <TouchableOpacity
            onPress={()  => {
              setOpenModal(true)
              setBillOrder(item)}}
               className="bg-alt/80 border rounded-lg text-sm h-16 w-40 shadow-sm flex flex-col justify-center items-center">
              <Text className="font-semibold">{item.biller}</Text>
              <Text className="text-primary font-medium text-xl"> {moneyFormat(item.amount)}</Text>

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

     <AppModal onclose={()=> setOpenModal(false)} open={openModal}>
      <View className="f bg-black/70 justify-center items-center px-6">
          <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
            <Text className="text-white text-xl font-semibold text-center mb-4">
              Confirm Transaction
            </Text>
            <Text className="text-gray-300 text-center mb-6">
              Are you sure you want to proceed with this transaction?
            </Text>

            <View className="">
            <Text className={`${billOrder?.biller === "MTN" ? "text-alt" : billOrder?.biller === "GLO" ? "text-green-500" : "text-white"}  font-semibold text-center text-lg`}>{billOrder?.biller}</Text>

            <LabelText label={"Description"} value={`subscription ${billOrder?.service_type} `}/>
            <LabelText label={"Recipient"} value={billOrder?.meter_number}/>
                <Text className="text-3xl text-white text-center my-2">{moneyFormat(billOrder?.amount ?? 0)}</Text>
      
            </View>

            <View className="flex-row gap-4 justify-between space-x-4">
              <TouchableOpacity
                onPress={() => setOpenModal(false)}
                className="flex-1 bg-gray-700 py-3 rounded-xl items-center"
              >
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={()=> {handleRepurchase(billOrder?.id)}}
                className="flex-1 bg-green-600 py-3 rounded-xl items-center"
              >
                <Text className="text-white font-medium">Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
     </AppModal>
     <AppModal open={toggleAlert} onclose={()=> setToggleAlert(false)}>
      <NotificationAlert onPress={()=> setToggleAlert(false)} message={notification?.message} error={notification.error} data={notification.data}/>

     </AppModal>

     <AppModal open={toggleBvn} onclose={()=> {setToggleBvn(false)}}>
      <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
        <Text className="text-white text-xl font-semibold text-center mb-2">
          BVN Verification
        </Text>
        <Text className="text-gray-300 text-center mb-6">
          Please enter your BVN number to continue
        </Text>

        <View className="mb-4">
          <Text className="text-white mb-0">BVN Number</Text>

          <FormInput required={true} placeHolder="Enter BVN Number"  onChangeText={(value: string)=> setBvnNumber(value)} className="border border-gray-600 text-white rounded-lg mt-4 py-2 px-3" name="bvn" type='text'/>
                 {notification?.error && 
                 <Text className="text-red-600 mb-2">{notification?.message}</Text>

                 }   
            <TouchableOpacity
              onPress={() => {
                if(bvnNumber.length === 11){
                  setLoader(true)
                  createBankAccount({
                    account: {
                      bvn: bvnNumber,
                       currency: "ngn",
                       vendor: "moniepoint",
                    },
                    
                  }, token).then((response: any) => {
                    setLoader(false)
                    setToggleBvn(false)
                    setNotification({
                      error: false,
                      message: response.message,
                      data: response.data
                    })
                    loadProfile(token)
                  }).catch((error: any) => {
                    setLoader(false)
                    setNotification({
                      error: true,
                      message: error?.message || "Failed  to verify BVN",
                      data: null
                    })
                  })


                }else{
                  setToggleBvn(true)
                  setNotification({
                    error: true,
                    message: "BVN number must be 11 digits",
                    data: null
                  })
                }
              }}
              className="bg-app-primary py-3 rounded-xl items-center">
              <Text className="text-white font-medium">Verify BVN</Text>
              </TouchableOpacity>
          
           </View>
     </View>

     </AppModal>

      <AppModal open={getstarted} onclose={()=> setOpenStarted(false)}>
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
          <Text className="text-white text-xl font-semibold text-center mb-4">
            Welcome to BitBridge
          </Text>
          <Text className="text-gray-300 text-center mb-6">
            Explore our services and enjoy seamless transactions.
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/airtime-top-up")}
            className="bg-app-primary py-3 rounded-xl items-center"
          >
            <Text className="text-white font-medium">Get Started</Text>
          </TouchableOpacity>
        </View>
      </AppModal>

     <Loader open={loader} />


    </View>


    </>
  );
}

const LabelText = ({label, value}: any) => (
  <View className="justify-between flex-row "> 
  <Text className="text-white">{label}</Text> 
  <Text className="text-white bg-red text-center text-lg">{value}  </Text>

</View>
)

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
            <Text className="text-lg text-white font-bold mb-3">Data Top Up </Text>

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
