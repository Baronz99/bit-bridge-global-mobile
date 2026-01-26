import React, { useMemo } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Link } from 'expo-router'
import { FEATURE_ONBOARDING } from '@/constants/featureFlags'
import { useAuth } from '@/services/useAuth'

const OnboardingHome = () => {
  const { userProfileData } = useAuth()

  const { steps, nextStep } = useMemo(() => {
    const payload = userProfileData?.data ?? userProfileData
    const profile = payload?.user_profile || {}
    const primaryUseCase = payload?.primary_use_case
    const kycLevel = String(payload?.kyc_level || payload?.user_kyc?.kyc_level || 'tier_0')
      .trim()
      .toLowerCase()

    const hasBasicProfile = Boolean(
      profile?.first_name ||
        profile?.last_name ||
        profile?.phone_number ||
        profile?.date_of_birth
    )
    const hasUseCase = Boolean(primaryUseCase)
    const hasKyc = kycLevel !== 'tier_0' && kycLevel !== 'nil'

    const items = [
      {
        key: 'basic_profile',
        title: 'Basic profile',
        description: 'Name, phone number, and date of birth.',
        done: hasBasicProfile,
        href: '/onboarding/basic-profile',
      },
      {
        key: 'use_case',
        title: 'Primary use case',
        description: 'Choose how you plan to use BitBridge.',
        done: hasUseCase,
        href: '/onboarding/use-case',
      },
      {
        key: 'kyc',
        title: 'KYC verification',
        description: 'Address and ID details to unlock limits.',
        done: hasKyc,
        href: '/kyc',
      },
    ]

    return {
      steps: items,
      nextStep: items.find((item) => !item.done) || items[items.length - 1],
    }
  }, [userProfileData])

  if (!FEATURE_ONBOARDING) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Onboarding</Text>
        <Text className="text-gray-400">Onboarding is currently disabled.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-5 py-8">
      <Text className="text-white text-2xl font-semibold">Get Started</Text>
      <Text className="text-gray-400 mt-2">
        Complete your profile to unlock more features.
      </Text>

      <View className="mt-6 gap-4">
        {steps.map((step) => (
          <Link key={step.key} href={step.href as any} asChild>
            <TouchableOpacity className="bg-gray-900 border border-gray-800 py-4 rounded-xl px-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-white font-medium">{step.title}</Text>
                <View
                  className={`px-2 py-1 rounded-full ${
                    step.done ? 'bg-emerald-500/20' : 'bg-gray-800'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-semibold ${
                      step.done ? 'text-emerald-300' : 'text-gray-300'
                    }`}
                  >
                    {step.done ? 'Done' : 'Pending'}
                  </Text>
                </View>
              </View>
              <Text className="text-gray-400 text-xs mt-1">{step.description}</Text>
            </TouchableOpacity>
          </Link>
        ))}
      </View>

      <View className="mt-6">
        <Link href={(nextStep?.href || '/onboarding/use-case') as any} asChild>
          <TouchableOpacity className="bg-app-primary py-4 rounded-xl">
            <Text className="text-black text-center font-semibold">Continue setup</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  )
}

export default OnboardingHome
