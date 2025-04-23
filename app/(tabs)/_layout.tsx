import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Tabs } from 'expo-router'
import { images } from '@/constants/images'
import { icons } from '@/constants/icons'
import { useAuth } from '@/services/useAuth'
import Login from '../login'



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
  const {authState, onLogout,userProfileData } = useAuth()
 
  return (
    <>
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
            headerShown: false,
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
        name='profile'
        options={{
            title: "Profile",
            headerShown: false,
            tabBarIcon: ({ focused}) => (
              <>
              <TabIcon  focused={focused}
              icon={icons.person}
              title="Profile"
              />


              </>
            )

        }}
        
        
        />

<Tabs.Screen
        name='search'
        options={{
            title: "search",
            headerShown: false,
            tabBarIcon: ({ focused}) => (
              <>
              <TabIcon  focused={focused}
              icon={icons.search}
              title="search"
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
   
        </>
  )
}

export default _layout

const styles = StyleSheet.create({})