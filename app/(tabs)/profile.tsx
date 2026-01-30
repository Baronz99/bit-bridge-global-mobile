import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, { useEffect, useMemo, useState, ReactElement, ReactNode } from 'react'
import { images } from '@/constants/images'
import { Link } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import { AntDesign, Feather, FontAwesome, Ionicons } from '@expo/vector-icons'
import AppModal from '@/components/modal/Modal'
import ScreenContainer from '@/components/ScreenContainer'
import {
  FEATURE_CIRCLES,
  FEATURE_KYC_CENTER,
  FEATURE_TIMELINE,
  FEATURE_ONBOARDING,
  FEATURE_TRANSACTION_PIN,
  FEATURE_ORDERS,
  FEATURE_REWARDS,
  FEATURE_STATS,
  FEATURE_CARD_TOKENS,
  FEATURE_PAYMENT_TOOLS,
} from '@/constants/featureFlags'

type RowItem = {
  label: string
  href?: string
  icon: ReactElement
  tone?: 'default' | 'danger'
  onPress?: () => void
}

const Profile = (): ReactElement => {
  const [toggleModal, setToggleModal] = useState(false)
  const { userProfileData, onLogout, loadProfile } = useAuth()

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const kycLabel = (userProfileData?.kyc_level || 'unverified')
    .toString()
    .replace('_', ' ')

  const sections = useMemo(() => {
    const data: { title: string; items: RowItem[] }[] = []

    data.push({
      title: 'Account',
      items: [
        {
          label: 'My Profile',
          href: '/accountProfile',
          icon: <FontAwesome name="user-o" size={18} color="white" />,
        },
        {
          label: 'Virtual Accounts',
          href: '/accounts',
          icon: <Ionicons name="card-outline" size={18} color="white" />,
        },
        {
          label: 'Cards',
          href: '/cards',
          icon: <Ionicons name="card" size={18} color="white" />,
        },
      ],
    })

    if (FEATURE_CARD_TOKENS) {
      data[0].items.push({
        label: 'Saved Cards',
        href: '/settings/card-tokens',
        icon: <Ionicons name="card-outline" size={18} color="white" />,
      })
    }

    if (FEATURE_ONBOARDING || FEATURE_KYC_CENTER) {
      data.push({
        title: 'Verification',
        items: [
          ...(FEATURE_KYC_CENTER
            ? [
              {
                label: 'KYC Center',
                  href: '/kyc',
                  icon: <Ionicons name="shield-checkmark-outline" size={18} color="white" />,
                },
              ]
            : []),
        ],
      })
    }

    if (FEATURE_CIRCLES || FEATURE_TIMELINE) {
      data.push({
        title: 'Community',
        items: [
          ...(FEATURE_CIRCLES
            ? [
                {
                  label: 'Circles',
                  href: '/circles',
                  icon: <Ionicons name="people-outline" size={18} color="white" />,
                },
              ]
            : []),
          ...(FEATURE_TIMELINE
            ? [
                {
                  label: 'Timeline',
                  href: '/timeline',
                  icon: <Ionicons name="time-outline" size={18} color="white" />,
                },
              ]
            : []),
        ],
      })
    }

    data.push({
      title: 'Security',
      items: [
        {
          label: 'Change Password',
          href: '/change-password',
          icon: <Feather name="shield" size={18} color="white" />,
        },
        ...(FEATURE_TRANSACTION_PIN
          ? [
              {
                label: 'Transaction PIN',
                href: '/settings/pin',
                icon: <Ionicons name="key-outline" size={18} color="white" />,
              },
            ]
          : []),
      ],
    })

    if (FEATURE_STATS) {
      data.push({
        title: 'Wallet',
        items: [
          {
            label: 'Wallet Stats',
            href: '/wallet/stats',
            icon: <Ionicons name="stats-chart-outline" size={18} color="white" />,
          },
        ],
      })
    }

    if (FEATURE_ORDERS || FEATURE_REWARDS) {
      data.push({
        title: 'Activity',
        items: [
          ...(FEATURE_ORDERS
            ? [
                {
                  label: 'Orders',
                  href: '/orders',
                  icon: <Ionicons name="receipt-outline" size={18} color="white" />,
                },
              ]
            : []),
          ...(FEATURE_REWARDS
            ? [
                {
                  label: 'Rewards',
                  href: '/rewards',
                  icon: <Ionicons name="trophy-outline" size={18} color="white" />,
                },
              ]
            : []),
        ],
      })
    }

    data.push({
      title: 'More',
      items: [
        ...(FEATURE_PAYMENT_TOOLS
          ? [
              {
                label: 'Payment Tools',
                href: '/payment-tools',
                icon: <Ionicons name="search-outline" size={18} color="white" />,
              },
            ]
          : []),
        {
          label: 'Legal',
          href: '/legal',
          icon: <Ionicons name="document-text-outline" size={18} color="white" />,
        },
        {
          label: 'Deactivate/Delete',
          href: '/delete-deactivate',
          icon: <AntDesign name="delete" size={18} color="white" />,
        },
        {
          label: 'Log out',
          icon: <AntDesign name="logout" size={18} color="white" />,
          tone: 'danger',
          onPress: () => setToggleModal(true),
        },
      ],
    })

    return data
  }, [
    FEATURE_CARD_TOKENS,
    FEATURE_CIRCLES,
    FEATURE_KYC_CENTER,
    FEATURE_ONBOARDING,
    FEATURE_ORDERS,
    FEATURE_PAYMENT_TOOLS,
    FEATURE_REWARDS,
    FEATURE_STATS,
    FEATURE_TIMELINE,
    FEATURE_TRANSACTION_PIN,
  ])

  return (
    <>
      <ScreenContainer>
        <Image source={images.bg} resizeMode="cover" className="absolute top-0 left-0 w-full z-0" />
          <View className="rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
            <View className="flex-row items-center gap-4">
              <Image
                source={images.user}
                className="w-12 h-12 border border-gray-800 bg-gray-700 rounded-2xl"
              />
              <View>
                <Text className="text-white text-lg font-semibold">
                  {userProfileData?.user_profile?.first_name || 'Member'}
                </Text>
                <Text className="text-gray-400 text-sm">{userProfileData?.email}</Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2 mt-4">
              <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
                <Text className="text-xs text-gray-300">Plan: Core</Text>
              </View>
              <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
                <Text className="text-xs text-gray-300">KYC: {kycLabel}</Text>
              </View>
            </View>

            <View className="flex-row gap-3 mt-4">
              <Link href={'/accounts' as any} asChild>
                <TouchableOpacity className="flex-1 bg-app-primary rounded-xl py-3">
                  <Text className="text-white text-center text-xs font-semibold">Virtual Accounts</Text>
                </TouchableOpacity>
              </Link>
              <Link href={'/cards' as any} asChild>
                <TouchableOpacity className="flex-1 bg-gray-900 border border-gray-800 rounded-xl py-3">
                  <Text className="text-white text-center text-xs font-semibold">Cards</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          <View className="mt-6 gap-5">
            {sections.map((section) => (
              <View key={section.title} className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                <Text className="text-white text-base font-semibold">{section.title}</Text>
                <View className="mt-3 gap-3">
                  {section.items.map((item) => {
                    const row = (
                      <View className="flex-row items-center gap-3">
                        <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-800 bg-gray-950">
                          {item.icon}
                        </View>
                        <Text className={`flex-1 ${item.tone === 'danger' ? 'text-red-400' : 'text-white'}`}>
                          {item.label}
                        </Text>
                        <Feather name="arrow-right" size={18} color="white" />
                      </View>
                    )

                    if (item.href) {
                      return (
                        <Link key={item.label} href={item.href as any} asChild>
                          <TouchableOpacity>{row}</TouchableOpacity>
                        </Link>
                      )
                    }

                    return (
                      <TouchableOpacity key={item.label} onPress={item.onPress}>
                        {row}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ))}
          </View>
      </ScreenContainer>

      <AppModal open={toggleModal} onclose={() => setToggleModal(false)}>
        <View className="bg-[#0f172a] w-full rounded-2xl px-4">
          <Text className="text-white text-center text-2xl my-2">Log Out </Text>
          <Text className="my-4 text-center text-white">Are you sure you want to Log Out </Text>
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

export default Profile
