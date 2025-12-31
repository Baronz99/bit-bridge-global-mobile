import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Constants from 'expo-constants'
import { Link, Redirect } from 'expo-router'
import { AntDesign, Feather } from '@expo/vector-icons'

import { getProducts } from '@/api/products'
import { getRescentPurchaseOrder, repurchaseOrder } from '@/api/billOrder'
import { createBankAccount } from '@/api/account'

import { icons } from '@/constants/icons'
import { images } from '@/constants/images'

import { useAuth } from '@/services/useAuth'
import useFetch from '@/services/useFetch'

import moneyFormat from '@/utils/moneyFormat'
import { splitString } from '@/utils/index'

import powerDistribution from '../../data/powerDistributions.json'
import PowerProviderCard from '@/components/ProviderCard'
import ProviderCard from '@/components/Card'
import ViewBox from '@/components/view-box/ViewBoxIcon'

import AppModal from '@/components/modal/Modal'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import FormInput from '@/components/FormInput'

/**
 * images is a typed object with fixed keys.
 * Dynamic indexing images[someString] causes TS error.
 * This helper safely returns a fallback image.
 */
const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

export default function Index() {
  const { authState, userProfileData, loadProfile } = useAuth()
  const token = authState?.token // string | null

  const [selectedService, setSelectedService] = useState<'Top Up' | 'TV Subscription' | 'Electric Bills'>('Top Up')
  const [bvnNumber, setBvnNumber] = useState('')
  const [billOrder, setBillOrder] = useState<any | null>(null)
  const [openModal, setOpenModal] = useState(false)

  const { notification, setNotification } = useNotification()
  const [toggleAlert, setToggleAlert] = useState(false)

  const [toggleBvn, setToggleBvn] = useState(false)
  const [bvnDismissed, setBvnDismissed] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const [getstarted, setOpenStarted] = useState(false)
  const [loader, setLoader] = useState(false)

  // ✅ log once only
  useEffect(() => {
    console.log('Runtime Versions:', Constants.manifest2?.runtimeVersion)
  }, [])

  // ✅ Typed redirect
  if (!token) return <Redirect href={"/login" as any} />

  // ✅ IMPORTANT: memoize fetch functions to stop rerender-fetch loops (blinking)
  const fetchProducts = useCallback(() => {
    return getProducts()
  }, [])

  const fetchRecent = useCallback(() => {
    return getRescentPurchaseOrder()
  }, [])

  const { data, loading, error } = useFetch(fetchProducts, true)
  const { data: recentTransaction, loading: recentLoading, error: recentError } = useFetch(fetchRecent, true)

  // ✅ refresh profile once on mount
  useEffect(() => {
    loadProfile().catch(() => {})
  }, [loadProfile])

  // ✅ BVN modal: open only when profile is loaded AND account missing AND user hasn't dismissed
  useEffect(() => {
    if (bvnDismissed) return
    if (!userProfileData) return
    if (!userProfileData?.account) setToggleBvn(true)
  }, [userProfileData?.account, userProfileData, bvnDismissed])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadProfile()
      .catch(() => {})
      .finally(() => {
        setTimeout(() => setRefreshing(false), 700)
      })
  }, [loadProfile])

  const items = useMemo(
    () =>
      [
        { id: 0, label: 'Airtime', link: '/airtime-top-up', image: icons.call },
        { id: 2, label: 'Data', link: '/data-subscription', image: icons.data },
        { id: 1, label: 'Electricity', link: '/electricity-provider', image: icons.power },
        { id: 3, label: 'Cable Tv', link: '/cable-tv-provider', image: icons.tv },
      ] as const,
    []
  )

  const datalist = useMemo(() => {
    return (
      data?.flatMap((item: any) =>
        item?.provisions?.flatMap((provision: any) => (provision.service_type === 'DATA' ? provision : []))
      ) ?? []
    )
  }, [data])

  const VTUList = useMemo(() => {
    return (
      data?.flatMap((item: any) =>
        item?.provisions?.flatMap((provision: any) => (provision.service_type === 'VTU' ? provision : []))
      ) ?? []
    )
  }, [data])

  const cableList = useMemo(() => {
    return (
      data?.flatMap((item: any) => {
        if (item?.category === 'utility') return item?.provisions?.flatMap((p: any) => p) ?? []
        return []
      }) ?? []
    )
  }, [data])

  const prevsummary = useMemo(
    () => [
      { id: 2, label: 'Bought', amount: userProfileData?.wallet?.total_bills ?? 0, icon: icons.walletColor },
      { id: 3, label: 'Withdrawals', amount: userProfileData?.wallet?.withdrawn ?? 0, icon: icons.withdraw },
      { id: 4, label: 'Sold', amount: 0, icon: icons.tag },
    ],
    [userProfileData]
  )

  const services = useMemo(
    () => [
      {
        id: 1,
        render: <MobileService VTUList={VTUList} datalist={datalist} />,
        label: 'Mobile Top Up',
        name: 'Top Up' as const,
      },
      {
        id: 2,
        render: <CableService cableList={cableList} />,
        label: 'Subscribe Cable Tv',
        name: 'TV Subscription' as const,
      },
      {
        id: 3,
        render: <PowerService powerList={powerDistribution} />,
        label: 'Pay Electric Bills',
        name: 'Electric Bills' as const,
      },
    ],
    [VTUList, datalist, cableList]
  )

  const pickedService = useMemo(
    () => services.find((s) => s.name === selectedService),
    [services, selectedService]
  )

  const handleRepurchase = async (id: string) => {
    try {
      setLoader(true)
      const response = await repurchaseOrder(id)
      setOpenModal(false)
      setToggleAlert(true)
      setNotification({ error: false, message: response?.message ?? 'Success', data: response?.data })
    } catch (err: any) {
      setOpenModal(false)
      setToggleAlert(true)
      setNotification({ error: true, message: err?.message || 'Repurchase failed', data: null })
    } finally {
      setLoader(false)
    }
  }

  const showTopError = error?.message || recentError?.message

  return (
    <View className="flex-1 bg-primary">
      <Image source={images.bg} className="absolute top-0 w-full z-0" />

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ minHeight: '100%', paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#f3f3f3', '#2f3b69', '#ffcc00']}
            progressBackgroundColor={'#111827'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1">
          {/* Wallet */}
          <View className="bg-purple-700 my-6 flex-row justify-between rounded-2xl h-28 px-6">
            {loading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : (
              <>
                <View className="justify-center">
                  <Text className="text-white text-base text-left font-bold mt-2">Wallet Balance</Text>
                  <Text className="text-white text-left text-lg font-bold">
                    {moneyFormat(userProfileData?.wallet?.balance ?? 0)}
                  </Text>

                  <View className="flex-row my-1 items-center gap-2">
                    <Image source={icons.trophy} className="w-5 h-5" />
                    <Text className="text-white">{moneyFormat(userProfileData?.wallet?.commission ?? 0)}</Text>
                  </View>
                </View>

                <View className="flex-col my-2 items-center gap-2 justify-center">
                  <Link href={"/history" as any} asChild>
                    <TouchableOpacity className="gap-3 font-semibold items-center rounded-2xl flex-row py-1 px-4">
                      <Text className="text-white">History</Text>
                      <Feather name="arrow-right" size={14} color="white" />
                    </TouchableOpacity>
                  </Link>

                  <Link href={"/fundWallet" as any} asChild>
                    <TouchableOpacity className="bg-purple-900 font-semibold rounded-2xl py-2 px-4">
                      <Text className="text-white">Fund Wallet</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </>
            )}
          </View>

          {/* Show fetch error once (prevents confusing “Something went wrong” blank screen) */}
          {showTopError ? (
            <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mb-4">
              <Text className="text-white font-semibold">Network/Error</Text>
              <Text className="text-white/80">{showTopError}</Text>
              <Text className="text-white/60 text-xs mt-1">
                If this persists, the endpoint URL is still wrong in one of the legacy api files.
              </Text>
            </View>
          ) : null}

          {/* Account */}
          {userProfileData?.account ? (
            <Link href={"/accountDetails" as any} asChild>
              <TouchableOpacity className="my-2 bg-gray-900 py-2 w-48 flex flex-row gap-4 items-center rounded-2xl px-4">
                <Text className="text-white text-lg text-left font-bold">Moniepoint</Text>
                <AntDesign name="caretdown" size={14} color="gray" />
              </TouchableOpacity>
            </Link>
          ) : null}

          {/* Services grid */}
          <View className="bg-gray-900/60 p-4 rounded-xl">
            <View className="py-4 flex-wrap gap-y-4 flex-row">
              {items.map((item) => (
                <Link key={item.id} href={item.link as any} asChild>
                  <TouchableOpacity activeOpacity={0.9} className="w-1/4 h-24 items-center justify-center">
                    <ViewBox icon={item.image} label={item.label} />
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          </View>

          {/* Summary */}
          <View className="my-10">
            <FlatList
              data={prevsummary}
              renderItem={({ item }) => (
                <TouchableOpacity className="bg-gray-800/50 p-4 min-w-40 rounded-lg flex-row items-center gap-3 mb-3">
                  <Image source={item.icon} className="w-6 h-6" />
                  <View>
                    <Text className="text-base text-white/70 font-bold">{item.label}</Text>
                    <Text className="text-sm text-gray-500">{moneyFormat(item.amount)}</Text>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => <View className="w-4" />}
            />
          </View>

          {/* Recent */}
          <View>
            {recentLoading ? (
              <ActivityIndicator />
            ) : (
              <FlatList
                data={recentTransaction || []}
                renderItem={({ item }: any) => (
                  <TouchableOpacity
                    onPress={() => {
                      setOpenModal(true)
                      setBillOrder(item)
                    }}
                    className="bg-alt/80 border rounded-lg text-sm h-16 w-40 shadow-sm flex flex-col justify-center items-center"
                  >
                    <Text className="font-semibold">{item?.biller}</Text>
                    <Text className="text-primary font-medium text-xl">{moneyFormat(item?.amount ?? 0)}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item: any, index) => String(item?.id ?? index)}
                horizontal
                shouldRasterizeIOS={false}
                ItemSeparatorComponent={() => <View className="w-4" />}
              />
            )}
          </View>
        </View>

        {/* Selected section label */}
        <View className="mb-3 p-2">
          <Text className="text-white">{pickedService?.label}</Text>
        </View>

        {/* Service switch pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
          <View className="flex flex-row gap-3 w-full">
            {services.map((item) => (
              <TouchableOpacity key={item.id} onPress={() => setSelectedService(item.name)}>
                <Text className="text-white font-semibold bg-app-primary py-2.5 px-4 rounded-md">
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Render selected */}
        {loading ? (
          <ActivityIndicator size="large" className="mt-10 self-center" />
        ) : (
          pickedService?.render ?? null
        )}
      </ScrollView>

      {/* Confirm Repurchase */}
      <AppModal onclose={() => setOpenModal(false)} open={openModal}>
        <View className="bg-black/70 justify-center items-center px-6">
          <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
            <Text className="text-white text-xl font-semibold text-center mb-4">Confirm Transaction</Text>
            <Text className="text-gray-300 text-center mb-6">
              Are you sure you want to proceed with this transaction?
            </Text>

            <View>
              <Text className="text-white font-semibold text-center text-lg">{billOrder?.biller}</Text>
              <LabelText label="Description" value={`subscription ${billOrder?.service_type ?? ''}`} />
              <LabelText label="Recipient" value={billOrder?.meter_number ?? ''} />
              <Text className="text-3xl text-white text-center my-2">{moneyFormat(billOrder?.amount ?? 0)}</Text>
            </View>

            <View className="flex-row gap-4 justify-between">
              <TouchableOpacity
                onPress={() => setOpenModal(false)}
                className="flex-1 bg-gray-700 py-3 rounded-xl items-center"
              >
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleRepurchase(String(billOrder?.id))}
                className="flex-1 bg-green-600 py-3 rounded-xl items-center"
              >
                <Text className="text-white font-medium">Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AppModal>

      {/* Alert */}
      <AppModal open={toggleAlert} onclose={() => setToggleAlert(false)}>
        <NotificationAlert
          onPress={() => setToggleAlert(false)}
          message={notification?.message}
          error={notification.error}
          data={notification.data}
        />
      </AppModal>

      {/* BVN */}
      <AppModal
        open={toggleBvn}
        onclose={() => {
          setToggleBvn(false)
          setBvnDismissed(true)
        }}
      >
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md m-auto">
          <Text className="text-white text-xl font-semibold text-center mb-2">BVN Verification</Text>
          <Text className="text-gray-300 text-center mb-6">Please enter your BVN number to continue</Text>

          <View className="mb-4">
            <Text className="text-white mb-0">BVN Number</Text>

            <FormInput
              required={true}
              placeHolder="Enter BVN Number"
              onChangeText={(value: string) => setBvnNumber(value)}
              className="border border-gray-600 text-white rounded-lg mt-4 py-2 px-3"
              name="bvn"
              type="text"
            />

            {notification?.error ? <Text className="text-red-600 mb-2">{notification?.message}</Text> : null}

            <TouchableOpacity
              onPress={() => {
                if (bvnNumber.length !== 11) {
                  setNotification({ error: true, message: 'BVN number must be 11 digits', data: null })
                  return
                }

                setLoader(true)
                createBankAccount(
                  {
                    account: {
                      bvn: bvnNumber,
                      currency: 'ngn',
                      vendor: 'moniepoint',
                    },
                  }
                )
                  .then((response: any) => {
                    setLoader(false)
                    setToggleBvn(false)
                    setBvnDismissed(true)
                    setNotification({ error: false, message: response?.message ?? 'BVN submitted', data: response?.data })
                    loadProfile()
                  })
                  .catch((err: any) => {
                    setLoader(false)
                    setNotification({
                      error: true,
                      message: err?.message || 'Failed to verify BVN',
                      data: null,
                    })
                  })
              }}
              className="bg-app-primary py-3 rounded-xl items-center"
            >
              <Text className="text-white font-medium">Verify BVN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppModal>

      {/* Get started */}
      <AppModal open={getstarted} onclose={() => setOpenStarted(false)}>
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
          <Text className="text-white text-xl font-semibold text-center mb-4">Welcome to BitBridge</Text>
          <Text className="text-gray-300 text-center mb-6">Explore our services and enjoy seamless transactions.</Text>

          <Link href={"/airtime-top-up" as any} asChild>
            <TouchableOpacity className="bg-app-primary py-3 rounded-xl items-center">
              <Text className="text-white font-medium">Get Started</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </AppModal>

      <Loader open={loader} />
    </View>
  )
}

const LabelText = ({ label, value }: any) => (
  <View className="justify-between flex-row mt-2">
    <Text className="text-white">{label}</Text>
    <Text className="text-white text-center">{value}</Text>
  </View>
)

const MobileService = ({ datalist, VTUList }: any) => {
  return (
    <View className="mt-6">
      <Text className="text-lg text-white font-bold mb-3">VTU Top Up</Text>
      <FlatList
        horizontal
        data={VTUList ?? []}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View className="w-4" />}
        renderItem={({ item }: any) => (
          <Link
            href={{
              pathname: '/mobileProviders/[id]',
              params: { id: String(item.id) },
            }}
            asChild
          >
            <TouchableOpacity className="bg-gray-800/50 overflow-hidden rounded-lg w-40 h-40">
              <Image
                source={getImageByKey(String(splitString(item.name)))}
                resizeMode="contain"
                className="w-full h-full"
              />
            </TouchableOpacity>
          </Link>
        )}
        keyExtractor={(item: any, index) => String(item?.id ?? index)}
      />

      <Text className="text-lg text-white font-bold mb-3 mt-8">Data Top Up</Text>
      <FlatList
        horizontal
        data={datalist ?? []}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View className="w-4" />}
        renderItem={({ item }: any) => (
          <Link
            href={{
              pathname: '/mobileProviders/[id]',
              params: { id: String(item.id) },
            }}
            asChild
          >
            <TouchableOpacity className="bg-gray-800/50 overflow-hidden rounded-lg w-40 h-40">
              <Image
                source={getImageByKey(String(splitString(item.name)))}
                resizeMode="contain"
                className="w-full h-full"
              />
            </TouchableOpacity>
          </Link>
        )}
        keyExtractor={(item: any, index) => String(item?.id ?? index)}
      />
    </View>
  )
}

const CableService = ({ cableList }: any) => {
  return (
    <View className="mt-6">
      <Text className="text-lg text-white font-bold mb-3">TV Subscription</Text>

      <FlatList
        horizontal
        data={cableList ?? []}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View className="w-4" />}
        renderItem={({ item }: any) => (
          <Link
            href={{
              pathname: '/cableProviders/[id]',
              params: { id: String(item.id) },
            }}
            asChild
          >
            <TouchableOpacity activeOpacity={0.9}>
              <ProviderCard item={item} />
            </TouchableOpacity>
          </Link>
        )}
        keyExtractor={(item: any, index) => String(item?.id ?? index)}
      />
    </View>
  )
}

export const PowerService = ({ powerList }: any) => {
  return (
    <View className="mt-6">
      <Text className="text-lg text-white font-bold mb-3">Discos</Text>

      <View className="flex-row flex-wrap gap-3">
        {(powerList ?? []).map((item: any, idx: number) => (
          <View key={String(item?.id ?? idx)} className="w-[30%]">
            <PowerProviderCard item={item} />
          </View>
        ))}
      </View>

      <View className="h-10" />
    </View>
  )
}
