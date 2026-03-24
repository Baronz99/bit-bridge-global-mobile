import React, { useMemo } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { type Href, Link } from 'expo-router'
import { AntDesign, Feather, FontAwesome, Ionicons } from '@expo/vector-icons'

import ScreenContainer from '@/components/ScreenContainer'
import { useAuth } from '@/services/useAuth'
import {
  FEATURE_KYC_CENTER,
  FEATURE_ONBOARDING,
  FEATURE_TRANSACTION_PIN,
} from '@/constants/featureFlags'

type RowItem = {
  label: string
  href: Href
  icon: React.ReactElement
}

export default function CoreHub() {
  const { userProfileData } = useAuth()

  const kycLabel = (userProfileData?.kyc_level || 'unverified').toString().replace('_', ' ')
  const profileName = userProfileData?.user_profile?.first_name || 'Member'

  const sections = useMemo(() => {
    const rows: { title: string; items: RowItem[] }[] = [
      {
        title: 'Account',
        items: [
          {
            label: 'My Profile',
            href: '/accountProfile',
            icon: <FontAwesome name="user-o" size={18} color="white" />,
          },
          {
            label: 'Deposit Accounts',
            href: '/accounts',
            icon: <Ionicons name="card-outline" size={18} color="white" />,
          },
        ],
      },
      {
        title: 'Trust & verification',
        items: [
          ...((FEATURE_ONBOARDING || FEATURE_KYC_CENTER)
            ? [
                {
                  label: 'KYC Center',
                  href: '/kyc',
                  icon: <Ionicons name="shield-checkmark-outline" size={18} color="white" />,
                },
              ]
            : []),
        ],
      },
      {
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
      },
      {
        title: 'More',
        items: [
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
        ],
      },
    ]

    return rows.filter((section) => section.items.length > 0)
  }, [])

  return (
    <ScreenContainer>
      <View className="rounded-[28px] border border-gray-800 bg-gray-900/85 p-5 shadow-2xl">
        <Text className="text-white text-[28px] font-semibold">Core</Text>
        <Text className="text-gray-400 mt-2 text-sm">
          Keep your trust, security, and account state in one controlled place.
        </Text>

        <View className="flex-row flex-wrap gap-2 mt-4">
          <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1.5">
            <Text className="text-xs text-gray-300">Trust center</Text>
          </View>
          <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1.5">
            <Text className="text-xs text-gray-300">KYC: {kycLabel}</Text>
          </View>
        </View>
      </View>

      <View className="mt-5 rounded-[24px] border border-gray-800 bg-gray-900/70 p-4 shadow-lg">
        <Text className="text-white text-base font-semibold">Trust center</Text>
        <View className="flex-row gap-3 mt-4">
          <View className="flex-1 rounded-2xl border border-gray-800 bg-gray-950/70 p-3">
            <Text className="text-gray-400 text-[11px] uppercase tracking-[0.16em]">Profile</Text>
            <Text className="text-white text-sm font-semibold mt-2">{profileName}</Text>
          </View>
          <View className="flex-1 rounded-2xl border border-gray-800 bg-gray-950/70 p-3">
            <Text className="text-gray-400 text-[11px] uppercase tracking-[0.16em]">KYC</Text>
            <Text className="text-white text-sm font-semibold mt-2 capitalize">{kycLabel}</Text>
          </View>
          <View className="flex-1 rounded-2xl border border-gray-800 bg-gray-950/70 p-3">
            <Text className="text-gray-400 text-[11px] uppercase tracking-[0.16em]">Security</Text>
            <Text className="text-white text-sm font-semibold mt-2">Active</Text>
          </View>
        </View>
      </View>

      <View className="mt-5 gap-4">
        {sections.map((section) => (
          <View key={section.title} className="rounded-[24px] border border-gray-800 bg-gray-900/70 p-4 shadow-lg">
            <Text className="text-white text-base font-semibold">{section.title}</Text>
            <View className="mt-2 gap-2">
              {section.items.map((item) => (
                <Link key={item.label} href={item.href} asChild>
                  <TouchableOpacity>
                    <View className="flex-row items-center gap-3 rounded-2xl border border-gray-800 bg-gray-950/60 px-3 py-3">
                      <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
                        {item.icon}
                      </View>
                      <Text className="flex-1 text-white">{item.label}</Text>
                      <Feather name="arrow-right" size={18} color="white" />
                    </View>
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScreenContainer>
  )
}
