// app/(tabs)/_layout.tsx
import React, { useCallback, useEffect, useState } from 'react'
import { Redirect, Tabs } from 'expo-router'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { Image, Platform, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { icons } from '@/constants/icons'
import { FEATURE_TIMELINE } from '@/constants/featureFlags'
import { useAuth } from '@/services/useAuth'
import { useAppLock } from '../../services/useAppLock'
import LoaderScreen from '../LoaderScreen'
import AppModal from '@/components/modal/Modal'
import { log } from '@/utils/logger'

const TabIcon = ({ focused, icon, activeTint = '#f4b000', activeBg, activeBorder }: any) => (
  <View className="items-center justify-center" style={{ height: 28 }}>
    <View
      className="h-7 w-7 items-center justify-center rounded-2xl border"
      style={{
        backgroundColor: focused ? activeBg ?? `${activeTint}18` : 'rgba(12, 16, 24, 0.78)',
        borderColor: focused ? activeBorder ?? `${activeTint}45` : 'rgba(31, 41, 55, 0.88)',
      }}
    >
      <Image
        source={icon}
        tintColor={focused ? activeTint : '#94a3b8'}
        className="w-4 h-4"
        resizeMode="contain"
      />
    </View>
  </View>
)

const TabVectorIcon = ({
  focused,
  iconName,
  activeTint = '#f4b000',
  activeBg,
  activeBorder,
}: any) => (
  <View className="items-center justify-center" style={{ height: 28 }}>
    <View
      className="h-7 w-7 items-center justify-center rounded-2xl border"
      style={{
        backgroundColor: focused ? activeBg ?? `${activeTint}18` : 'rgba(12, 16, 24, 0.78)',
        borderColor: focused ? activeBorder ?? `${activeTint}45` : 'rgba(31, 41, 55, 0.88)',
      }}
    >
      <Ionicons name={iconName} size={15} color={focused ? activeTint : '#94a3b8'} />
    </View>
  </View>
)

const getTabAccent = (routeName: string) => {
  if (routeName === 'bridge') {
    return {
      tint: '#2F6BFF',
      bg: 'rgba(47, 107, 255, 0.16)',
      border: 'rgba(47, 107, 255, 0.34)',
    }
  }

  if (routeName === 'tunnel') {
    return {
      tint: '#FF9A1F',
      bg: 'rgba(255, 154, 31, 0.16)',
      border: 'rgba(255, 154, 31, 0.34)',
    }
  }

  return {
    tint: '#f4b000',
    bg: 'rgba(244, 176, 0, 0.14)',
    border: 'rgba(244, 176, 0, 0.28)',
  }
}

const VISIBLE_TAB_ROUTES = new Set(['index', 'bridge', 'tunnel', 'timeline', 'core'])

const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const barWidth = Math.min(width - 12, 420)
  const barHeight = Platform.OS === 'ios' ? 54 : 56
  const verticalPadding = Platform.OS === 'ios' ? 5 : 6
  const bottomOffset = Math.max(insets.bottom, 8)
  const visibleRoutes = state.routes.filter((route) => VISIBLE_TAB_ROUTES.has(route.name))

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
          paddingHorizontal: 6,
          paddingVertical: verticalPadding,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(10, 13, 19, 0.94)',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(36, 42, 54, 0.92)',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        {visibleRoutes.map((route) => {
          const isFocused = state.routes[state.index]?.key === route.key
          const { options } = descriptors[route.key]
          const accent = getTabAccent(route.name)
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
                minHeight: 42,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 2,
                  paddingHorizontal: 2,
                  borderRadius: 16,
                }}
              >
                {options.tabBarIcon?.({ focused: isFocused, color: '', size: 0 })}
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 3,
                    fontSize: 10.5,
                    fontWeight: isFocused ? '600' : '500',
                    color: isFocused ? '#f8fafc' : '#8b98a7',
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
  const { loading, authHydrated, authState, token, profileLoading, profileError, userProfileData, onLogout } = useAuth()
  const { locked } = useAppLock()
  const [toggleModal, setToggleModal] = useState(false)
  const insets = useSafeAreaInsets()
  const hasProfile = !!userProfileData

  const bootTrace = useCallback(
    (event: string, redirect: string | null = null) => {
      log('[BOOT_TRACE][TABS_GUARD]', {
        event,
        hydrated: authHydrated,
        authed: !!authState?.authenticated,
        tokenPresent: !!token,
        profileLoading,
        hasProfile,
        lastProfileError: profileError,
        redirect,
      })
    },
    [authHydrated, authState?.authenticated, token, profileLoading, hasProfile, profileError]
  )

  useEffect(() => {
    bootTrace('state_change')
  }, [bootTrace])

  if (loading || !authHydrated) return <LoaderScreen />
  if (!authState?.authenticated) {
    bootTrace('redirect', '/login')
    return <Redirect href="/login" />
  }
  if (locked) {
    bootTrace('redirect', '/lock')
    return <Redirect href="/lock" />
  }

  return (
    <>
      <SafeAreaView edges={['left', 'right']} className="flex-1 bg-[#05070D]">
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
                <View className="bg-[#05070D]" style={{ paddingTop: insets.top }}>
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
            name="bridge"
            options={{
              title: 'Bridge',
              headerShown: true,
              tabBarIcon: ({ focused }) => (
                <TabVectorIcon
                  focused={focused}
                  iconName="swap-horizontal"
                  activeTint="#2F6BFF"
                  activeBg="rgba(47, 107, 255, 0.16)"
                  activeBorder="rgba(47, 107, 255, 0.34)"
                />
              ),
            }}
          />

          <Tabs.Screen
            name="tunnel"
            options={{
              title: 'Tunnel',
              headerTintColor: 'white',
              tabBarIcon: ({ focused }) => (
                <TabVectorIcon
                  focused={focused}
                  iconName="globe-outline"
                  activeTint="#FF9A1F"
                  activeBg="rgba(255, 154, 31, 0.16)"
                  activeBorder="rgba(255, 154, 31, 0.34)"
                />
              ),
            }}
          />

          <Tabs.Screen
            name="timeline"
            options={{
              title: 'Activity',
              headerShown: true,
              href: FEATURE_TIMELINE ? undefined : null,
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.transaction} />,
            }}
          />

          <Tabs.Screen
            name="core"
            options={{
              title: 'Core',
              headerShown: true,
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.person} />,
            }}
          />

          <Tabs.Screen
            name="wallet"
            options={{
              href: null,
            }}
          />

          <Tabs.Screen
            name="service"
            options={{
              href: null,
            }}
          />

          <Tabs.Screen
            name="profile"
            options={{
              href: null,
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
