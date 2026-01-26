// app/(tabs)/_layout.tsx
import React, { useState } from 'react'
import { Tabs, Redirect } from 'expo-router'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Image, Platform, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { icons } from '@/constants/icons'
import { FEATURE_TIMELINE } from '@/constants/featureFlags'
import { useAuth } from '@/services/useAuth'
import LoaderScreen from '../LoaderScreen'
import AppModal from '@/components/modal/Modal'

const TabIcon = ({ focused, icon }: any) => (
  <View className="items-center justify-center" style={{ height: 32 }}>
    <View
      className={`h-8 w-8 items-center justify-center rounded-2xl border ${
        focused ? 'bg-app-primary/20 border-app-primary/40' : 'bg-gray-900/60 border-gray-800'
      }`}
    >
      <Image
        source={icon}
        tintColor={focused ? '#f4b000' : '#94a3b8'}
        className="w-[18px] h-[18px]"
        resizeMode="contain"
      />
    </View>
  </View>
)

const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const barWidth = Math.min(width * 0.9, 420)
  const barHeight = Platform.OS === 'ios' ? 58 : 60
  const verticalPadding = Platform.OS === 'ios' ? 6 : 8
  const bottomOffset = Math.max(insets.bottom, 8)

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: barWidth,
          height: barHeight,
          marginBottom: bottomOffset,
          paddingHorizontal: 8,
          paddingVertical: verticalPadding,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(17, 19, 24, 0.88)',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(47, 52, 63, 0.8)',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index
          const { options } = descriptors[route.key]
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name
          const labelText =
            typeof label === 'function'
              ? String(options.title ?? route.name)
              : typeof label === 'string' || typeof label === 'number'
                ? String(label)
                : String(options.title ?? route.name)

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            })
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={(options as any)?.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.8}
              style={{
                flex: 1,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 16,
                  backgroundColor: isFocused ? 'rgba(244, 176, 0, 0.14)' : 'transparent',
                }}
              >
                {options.tabBarIcon?.({ focused: isFocused, color: '', size: 0 })}
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: '500',
                    color: isFocused ? '#e2e8f0' : '#8b98a7',
                  }}
                >
                  {labelText}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

export default function TabsLayout() {
  const { loading, authState, userProfileData, onLogout } = useAuth()
  const [toggleModal, setToggleModal] = useState(false)
  const insets = useSafeAreaInsets()

  if (loading) return <LoaderScreen />

  // ✅ Proper protection: redirect out of tabs
  if (!authState?.authenticated) {
    return <Redirect href={"/login" as any} />
  }

  return (
    <>
      <SafeAreaView edges={['left', 'right']} className="flex-1 bg-primary">
        <Tabs
          screenOptions={{
            headerTitleStyle: { color: 'white', fontSize: 14 },
            tabBarShowLabel: false,
            headerStyle: { backgroundColor: '#0b1120' },
          }}
          tabBar={(props) => <CustomTabBar {...props} />}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              headerShown: true,
              header: () => (
                <View className="bg-primary" style={{ paddingTop: insets.top }}>
                  <View className="px-4 pb-3 flex-row justify-between items-center">
                    <View>
                      <Text className="text-slate-400 text-xs uppercase tracking-[0.2em]">Welcome</Text>
                      <Text className="text-white font-semibold text-base">
                        Hello, {userProfileData?.user_profile?.first_name ?? userProfileData?.email}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setToggleModal(true)}>
                      <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900/70">
                        <Image source={icons.logout} tintColor={'#f4b000'} className="w-5 h-5" />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ),
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.home} />,
            }}
          />

          <Tabs.Screen
            name="wallet"
            options={{
              title: 'Wallet',
              headerShown: true,
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.wallet} />,
            }}
          />

          <Tabs.Screen
            name="service"
            options={{
              title: 'All Services',
              headerTintColor: 'white',
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.utility} />,
            }}
          />

          <Tabs.Screen
            name="timeline"
            options={{
              title: 'Timeline',
              headerShown: true,
              href: FEATURE_TIMELINE ? undefined : null,
              tabBarButton: FEATURE_TIMELINE ? undefined : () => null,
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.transaction} />,
            }}
          />

          <Tabs.Screen
            name="profile"
            options={{
              title: 'Settings',
              headerShown: true,
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.person} />,
            }}
          />
        </Tabs>
      </SafeAreaView>

      <AppModal open={toggleModal} onclose={() => setToggleModal(false)}>
        <View className="bg-[#0f172a] w-full rounded-2xl px-4">
          <Text className="text-white text-center text-2xl my-2">Log Out</Text>
          <Text className="my-4 text-center text-white">Are you sure you want to Log Out</Text>

          <View className="flex-row gap-4 my-6 justify-between">
            <TouchableOpacity
              onPress={() => setToggleModal(false)}
              className="bg-gray-900 py-3 flex-1 rounded-xl"
            >
              <Text className="text-white text-center">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onLogout}
              className="bg-app-primary flex-1 py-3 rounded-xl"
            >
              <Text className="text-white text-center">Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppModal>
    </>
  )
}
