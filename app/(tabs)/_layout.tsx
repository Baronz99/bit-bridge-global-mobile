// app/(tabs)/_layout.tsx
import React, { useState } from 'react'
import { Tabs, Redirect } from 'expo-router'
import { Image, SafeAreaView, Text, TouchableOpacity, View } from 'react-native'
import { icons } from '@/constants/icons'
import { useAuth } from '@/services/useAuth'
import LoaderScreen from '../LoaderScreen'
import AppModal from '@/components/modal/Modal'

const TabIcon = ({ focused, icon, title }: any) => (
  <View className="w-full flex-1 min-w-[112px] min-h-14 mt-4 justify-center rounded-full overflow-hidden items-center">
    <Image source={icon} tintColor={focused ? '#ffcc00' : '#a8b5db'} className="size-5" />
    <Text className={focused ? 'text-alt text-base font-semibold' : 'text-[#a8b5db] text-base font-normal'}>
      {title}
    </Text>
  </View>
)

export default function TabsLayout() {
  const { loading, authState, userProfileData, onLogout } = useAuth()
  const [toggleModal, setToggleModal] = useState(false)

  if (loading) return <LoaderScreen />

  // ✅ Proper protection: redirect out of tabs
  if (!authState?.authenticated) {
    return <Redirect href={"/login" as any} />
  }

  return (
    <>
      <SafeAreaView className="flex-1 bg-primary">
        <Tabs
          screenOptions={{
            headerTitleStyle: { color: 'white', fontSize: 14 },
            tabBarShowLabel: false,
            headerStyle: { backgroundColor: '#030014' },
            tabBarItemStyle: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
            tabBarStyle: {
              backgroundColor: '#0f0D23',
              marginHorizontal: 0,
              marginBottom: 0,
              height: 62,
              position: 'absolute',
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#0f0D23',
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              headerShown: true,
              header: () => (
                <View>
                  <View className="h-20 px-4 flex-row justify-between items-center bg-primary">
                    <Text className="text-white font-medium">
                      Hello, {userProfileData?.user_profile?.first_name ?? userProfileData?.email}
                    </Text>
                    <TouchableOpacity onPress={() => setToggleModal(true)}>
                      <Image source={icons.logout} tintColor={'#ffcc00'} className="w-7 h-7" />
                    </TouchableOpacity>
                  </View>
                </View>
              ),
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.home} title="Home" />,
            }}
          />

          <Tabs.Screen
            name="wallet"
            options={{
              title: 'Wallet',
              headerShown: true,
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.wallet} title="Wallet" />,
            }}
          />

          <Tabs.Screen
            name="service"
            options={{
              title: 'All Services',
              headerTintColor: 'white',
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.utility} title="Service" />,
            }}
          />

          <Tabs.Screen
            name="profile"
            options={{
              title: 'Settings',
              headerShown: true,
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.person} title="Profile" />,
            }}
          />
        </Tabs>
      </SafeAreaView>

      <AppModal open={toggleModal} onclose={() => setToggleModal(false)}>
        <View className="bg-gray-900 w-full rounded-xl px-4">
          <Text className="text-white text-center text-2xl my-2">Log Out</Text>
          <Text className="my-4 text-center text-white">Are you sure you want to Log Out</Text>

          <View className="flex-row gap-4 my-6 justify-between">
            <TouchableOpacity
              onPress={() => setToggleModal(false)}
              className="bg-black py-3 flex-1 rounded-xl"
            >
              <Text className="text-white text-center">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onLogout}
              className="bg-orange-700 flex-1 py-3 rounded-xl"
            >
              <Text className="text-white text-center">Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppModal>
    </>
  )
}
