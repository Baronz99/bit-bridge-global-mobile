import { Image, ImageBackground, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { images } from '@/constants/images'
import { icons } from '@/constants/icons'
import { useAuth } from '@/services/useAuth'
import Login from '../login'
import Loader from '@/components/Loader'
import { userProfile } from '@/api/auth'
import LoaderScreen from '../LoaderScreen'



const TabIcon = ({
  focused, icon, title

}: any) => {
  if(focused){

    return(
      <View
        className='flex flex-col w-full gap-1 flex-1 min-w-[112px] min-h-16 mt-4 justify-center rounded-full overflow-hidden items-center'
        // source={images.highlight}
        >
          <Image source={icon}
          
          tintColor="#ffcc00"
          className="size-5"
          />

          <Text
          className='text-alt text-base font-semibold'>{title}</Text>


       </View>
    )
  }else{
    return(
          <View   className=' w-full flex-1 min-w-[112px] min-h-14 mt-4 justify-center rounded-full overflow-hidden items-center'>
            
             <Image source={icon} tintColor="#a8b5db" className="size-5"                />
             <Text className='text-[#a8b5db] text-base font-normal'>{title}</Text>
  
  
    </View>
    )
  }
}
const _layout = () => {
  const {authState, onLogout,userProfileData, loading} = useAuth()


  if(loading)  return <LoaderScreen/>

  if(authState?.authenticated){
    return <AppContent userProfileData={userProfileData} onLogout={onLogout} />

  }

  
    return <Login/>
  
  
}


const AppContent = ({
  onLogout,
  userProfileData
}: any) => {
  return (
    <>
    <SafeAreaView className='flex-1 bg-primary'>
      


      <>
      <Tabs
        screenOptions={{
          // headerShown: true,
          headerTitleStyle: {
          color: "white",
          fontSize: 14

        },

          tabBarShowLabel: false,
          headerStyle: {
          backgroundColor: "#030014"
        },
          tabBarItemStyle: {
            width: "100%",
            height: "100%",
            justifyContent: "center",
            alignItems: "center"

          },
          tabBarStyle: {
            backgroundColor: "#0f0D23",
            marginHorizontal: 0,
            marginBottom: 0,
            height: 62,
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
              tabBarIcon: ({ focused} : any) => (
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
        name='service'
        options={{
          title: "All Services",
            headerTintColor: "white",        
          tabBarIcon: ({ focused}) => (
            <>
            <TabIcon  focused={focused}
            icon={icons.utility}
            title="Service"
            />


            </>
          )

      }}
        
        />        
      
         <Tabs.Screen
        name='profile'
        options={{
            title: "Transactions",
            headerShown: true,
            tabBarIcon: ({ focused} :any) => (
              <>
              <TabIcon  focused={focused}
              icon={icons.person}
              title="Profile"
              />
              </>
            )

        }}
        
        
        />


        </Tabs>
      </> 
   

        
    </SafeAreaView>
   
   </>
  )
}

export default _layout

const styles = StyleSheet.create({})