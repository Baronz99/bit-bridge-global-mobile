import { Image, ImageBackground, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { images } from '@/constants/images'
import { icons } from '@/constants/icons'
import { useAuth } from '@/services/useAuth'
import Login from '../login'
import Loader from '@/components/Loader'
import { userProfile } from '@/api/auth'



const TabIcon = ({
  focused, icon, title

}) => {
  if(focused){

    return(
      <ImageBackground
                className='flex flex-row w-full gap-1 flex-1 min-w-[112px] min-h-16 mt-4 justify-center rounded-full overflow-hidden items-center'
                source={images.highlight}>
                  <Image source={icon}
                  
                  tintColor="#151312"
                  className="size-5"
                  />
  
                  <Text
                  className='text-secondary text-base font-semibold'>{title}</Text>
  
  
                  </ImageBackground>
    )
  }else{
    return(
          <View   className=' w-full flex-1 min-w-[112px] min-h-14 mt-4 justify-center rounded-full overflow-hidden items-center'>
      <Image source={icon}
                
                tintColor="#a8b5db"
                className="size-5"
                />
    </View>
    )
  }
}
const _layout = () => {
  const {authState, onLogout,userProfileData, loadProfile} = useAuth()
  // console.log("fetcg profile:" ,userProfileData, authState)


  return (
    <>
    <SafeAreaView className='flex-1 bg-primary'>
      

      {authState?.authenticated ?
      <>
      <Tabs
    screenOptions={{
      tabBarShowLabel: false,
      tabBarItemStyle: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center"

      },
      tabBarStyle: {
        backgroundColor: "#0f0D23",
        borderRadius: 50,
        marginHorizontal: 1,
        marginBottom: 26,
        height: 52,
        position: "absolute",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#0f0D23"
      }
    }}
    >
       <Tabs.Screen
        name='index'
        options={{
            title: "Home",
            headerShown: true,
            header: () => <View>

              <View className='h-20 px-4 flex-row justify-between items-center bg-primary'>
                <Text className='text-white font-medium'>Hello, {userProfileData?.email}</Text>
                <TouchableOpacity className='' onPress={()=> onLogout()}>
                  <Image source={icons.logout} tintColor={"#ffcc00"} className='w-7 h-7'/>

                </TouchableOpacity>
              </View>

            </View>,
            tabBarIcon: ({ focused}) => (
              <>
              <TabIcon  focused={focused}
              icon={icons.home}
              title="Home"
              />
              </>
            )

        }}
        
        />

        <Tabs.Screen
          name='wallet'
          options={{
              title: "wallet",
              headerShown: false,
              tabBarIcon: ({ focused}) => (
                <>
                <TabIcon  focused={focused}
                icon={icons.wallet}
                title="Wallet"
                />
                </>
              )

          }}
                
        
        />  
   
      <Tabs.Screen
        name='utility'
        options={{
          title: "Utilities",
          headerShown: false,
          tabBarIcon: ({ focused}) => (
            <>
            <TabIcon  focused={focused}
            icon={icons.utility}
            title="Utilities"
            />


            </>
          )

      }}
        
        />
       
       

        
        <Tabs.Screen
        name='transactions'
        options={{
            title: "Transactions",
            headerShown: false,
            tabBarIcon: ({ focused}) => (
              <>
              <TabIcon  focused={focused}
              icon={icons.transaction}
              title="Transactions"
              />
              </>
            )

        }}
        
        
        />


        </Tabs>
      </> : 
      <>
        <Login/>
        </>}

        
    </SafeAreaView>
   
   </>
  )
}

export default _layout

const styles = StyleSheet.create({})