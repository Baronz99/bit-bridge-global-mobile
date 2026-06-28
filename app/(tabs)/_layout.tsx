// app/(tabs)/_layout.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Redirect, Tabs, useRouter } from 'expo-router'
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
import { useActiveAccount } from '@/services/useActiveAccount'
import { getBusinessEntities } from '@/api/business'
import { listCircles } from '@/api/circles'
import WorkspaceSwitcherModal, {
  WorkspaceBusiness,
  WorkspaceCircle,
} from '@/components/workspace/WorkspaceSwitcherModal'

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

const formatLabel = (value: string, fallback = 'Member') =>
  String(value || fallback)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

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
  const { loading, authHydrated, authState, token, profileLoading, profileError, userProfileData, onLogout, loadProfile } = useAuth()
  const { locked } = useAppLock()
  const router = useRouter()
  const { activeAccount, hydrated: accountHydrated, selectPersonalAccount, selectBusinessAccount, selectCircleAccount } =
    useActiveAccount()
  const [toggleModal, setToggleModal] = useState(false)
  const [switchAccountOpen, setSwitchAccountOpen] = useState(false)
  const [businessLoading, setBusinessLoading] = useState(false)
  const [circlesLoading, setCirclesLoading] = useState(false)
  const [businessAccounts, setBusinessAccounts] = useState<WorkspaceBusiness[]>([])
  const [circleAccounts, setCircleAccounts] = useState<WorkspaceCircle[]>([])
  const insets = useSafeAreaInsets()
  const hasProfile = !!userProfileData
  const [loadingRecoveryVisible, setLoadingRecoveryVisible] = useState(false)

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

  const loadBusinessAccounts = useCallback(async () => {
    setBusinessLoading(true)
    try {
      const response = await getBusinessEntities()
      const entities = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
          ? response.data
          : []
      setBusinessAccounts(
        entities.map((item: any) => ({
          id: String(item?.id),
          name: String(item?.name || 'Business account'),
          status: String(item?.status || ''),
          current_user_role: String(item?.current_user_role || item?.role || ''),
        }))
      )
    } catch {
      setBusinessAccounts([])
    } finally {
      setBusinessLoading(false)
    }
  }, [])

  const loadCircleAccounts = useCallback(async () => {
    setCirclesLoading(true)
    try {
      const response = await listCircles()
      const payload = response?.data ?? response
      const items = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.circles)
          ? payload.circles
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.results)
              ? payload.results
              : Array.isArray(payload)
                ? payload
                : []
      setCircleAccounts(
        items
          .map((item: any) => ({
            id: String(item?.id || item?.circle_id || item?.uuid || '').trim(),
            name: String(item?.name || item?.title || 'Circle'),
            role: String(item?.current_user_role || item?.role || 'member'),
            circle_type: String(item?.circle_type || 'standard'),
            member_count: Number(item?.member_count ?? item?.members_count ?? 0),
          }))
          .filter((item: WorkspaceCircle) => item.id)
      )
    } catch {
      setCircleAccounts([])
    } finally {
      setCirclesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!accountHydrated) return
    void loadBusinessAccounts()
    void loadCircleAccounts()
  }, [accountHydrated, loadBusinessAccounts, loadCircleAccounts])

  const openSwitchAccountModal = useCallback(() => {
    setSwitchAccountOpen(true)
    void loadBusinessAccounts()
    void loadCircleAccounts()
  }, [loadBusinessAccounts, loadCircleAccounts])

  const selectedBusiness = useMemo(
    () =>
      activeAccount.type === 'business'
        ? businessAccounts.find((item) => String(item.id) === String(activeAccount.businessId)) || null
        : null,
    [activeAccount, businessAccounts]
  )

  const selectedCircle = useMemo(
    () =>
      activeAccount.type === 'circle'
        ? circleAccounts.find((item) => String(item.id) === String(activeAccount.circleId)) || null
        : null,
    [activeAccount, circleAccounts]
  )

  const activeIdentityName =
    activeAccount.type === 'business'
      ? selectedBusiness?.name || 'Business account'
      : activeAccount.type === 'circle'
        ? selectedCircle?.name || 'Circle account'
        : userProfileData?.user_profile?.first_name || userProfileData?.email || 'Personal account'

  const activeIdentityBadge =
    activeAccount.type === 'business'
      ? 'Business'
      : activeAccount.type === 'circle'
        ? 'Circle'
        : 'Personal'

  const activeIdentityMeta =
    activeAccount.type === 'business'
      ? [
          selectedBusiness?.current_user_role
            ? formatLabel(String(selectedBusiness.current_user_role), 'Member')
            : null,
          selectedBusiness?.status
            ? formatLabel(String(selectedBusiness.status), 'Setup')
            : null,
        ]
          .filter(Boolean)
          .join(' / ')
      : activeAccount.type === 'circle'
        ? [
            selectedCircle?.member_count && selectedCircle.member_count > 0
              ? `${selectedCircle.member_count} members`
              : null,
            selectedCircle?.role
              ? formatLabel(String(selectedCircle.role), 'Member')
              : null,
          ]
            .filter(Boolean)
            .join(' / ')
        : 'Your personal wallet and direct activity'

  const personalFirstName =
    userProfileData?.user_profile?.first_name || userProfileData?.first_name || userProfileData?.email || 'there'

  const waitingForTabs = loading || !authHydrated

  useEffect(() => {
    if (!waitingForTabs) {
      setLoadingRecoveryVisible(false)
      return
    }
    const timeout = setTimeout(() => setLoadingRecoveryVisible(true), 5000)
    return () => clearTimeout(timeout)
  }, [waitingForTabs])

  if (waitingForTabs) {
    if (!loadingRecoveryVisible) return <LoaderScreen />
    return (
      <SafeAreaView edges={['left', 'right']} className="flex-1 bg-[#05070D]">
        <View className="flex-1 items-center justify-center px-5">
          <View className="w-full max-w-[420px] rounded-[28px] border border-white/10 bg-[#0F172A] p-6">
            <Text className="text-white text-xl font-semibold">Still opening your account</Text>
            <Text className="mt-3 text-sm leading-6 text-slate-300">
              {profileError || 'This is taking longer than usual. You can retry loading or sign in again.'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setLoadingRecoveryVisible(false)
                void loadProfile({ force: true }).catch(() => {})
              }}
              className="mt-5 rounded-2xl bg-app-primary px-4 py-4"
            >
              <Text className="text-center font-semibold text-white">Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void onLogout()}
              className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
            >
              <Text className="text-center font-semibold text-white">Sign in again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }
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
                  <View className="px-4 pb-1">
                    <View className="flex-row items-center">
                      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-[#111827]/52">
                        <Image
                          source={icons.appLogoClear}
                          className="h-5 w-5"
                          resizeMode="contain"
                        />
                      </View>
                      <TouchableOpacity
                        onPress={openSwitchAccountModal}
                        activeOpacity={0.85}
                        className="max-w-[76%] rounded-full border border-white/8 bg-[#111827]/72 px-3 py-2"
                      >
                        <View className="flex-row items-center gap-3">
                          <View className="max-w-[84%]">
                            <Text className="text-white font-semibold text-[15px]" numberOfLines={1}>
                              {activeAccount.type === 'personal' ? personalFirstName : activeIdentityName}
                            </Text>
                            <View className="mt-0.5 flex-row items-center">
                              <View
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    activeAccount.type === 'circle'
                                      ? '#7DD3FC'
                                      : activeAccount.type === 'business'
                                        ? '#FFB05A'
                                        : '#CBD5E1',
                                }}
                              />
                              <View className="w-2.5" />
                              <Text className="text-[10px] uppercase tracking-[0.16em] text-slate-400" numberOfLines={1}>
                                {activeAccount.type === 'personal' ? 'Personal' : activeIdentityBadge || activeIdentityMeta}
                              </Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-down" size={15} color="#94A3B8" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ),
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.home} />,
            }}
          />

          <Tabs.Screen
            name="bridge"
            options={{
              title: 'Payments',
              headerTitle:
                activeAccount.type === 'circle'
                  ? selectedCircle?.name || 'Circle'
                  : activeAccount.type === 'business'
                    ? selectedBusiness?.name || 'Business'
                    : 'Payments',
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
              title: 'Global',
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
              headerTitle:
                activeAccount.type === 'circle'
                  ? selectedCircle?.name || 'Circle Activity'
                  : activeAccount.type === 'business'
                    ? selectedBusiness?.name || 'Business Activity'
                    : 'Activity',
              href: FEATURE_TIMELINE ? undefined : null,
              tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.transaction} />,
            }}
          />

          <Tabs.Screen
            name="core"
            options={{
              title: 'Account',
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

      <WorkspaceSwitcherModal
        open={switchAccountOpen}
        onClose={() => setSwitchAccountOpen(false)}
        activeAccount={activeAccount}
        activeIdentityName={activeIdentityName}
        activeIdentityMeta={activeIdentityMeta}
        activeIdentityBadge={activeIdentityBadge}
        accountHydrated={accountHydrated}
        businessLoading={businessLoading}
        circlesLoading={circlesLoading}
        businessAccounts={businessAccounts}
        circleAccounts={circleAccounts}
        selectedBusinessName={selectedBusiness?.name || null}
        selectedCircleName={selectedCircle?.name || null}
        onSelectPersonal={async () => {
          await selectPersonalAccount()
          router.replace('/(tabs)' as any)
        }}
        onSelectBusiness={async (businessId) => {
          await selectBusinessAccount(businessId)
          router.replace('/business' as any)
        }}
        onSelectCircle={async (circleId) => {
          const selectedCircle = circleAccounts.find((item) => String(item.id) === String(circleId))
          await selectCircleAccount(circleId)
          router.replace({
            pathname: `/circles/${circleId}` as any,
            params: {
              name: selectedCircle?.name || 'Circle',
              role: selectedCircle?.role || 'member',
              memberCount: String(selectedCircle?.member_count || 0),
              circleType: selectedCircle?.circle_type || 'standard',
            },
          } as any)
        }}
        onOpenBusinessCreate={() => {
          router.push('/business/activate' as any)
        }}
        onOpenCircles={() => {
          router.push('/circles' as any)
        }}
        onLogout={() => {
          setToggleModal(true)
        }}
      />
    </>
  )
}
