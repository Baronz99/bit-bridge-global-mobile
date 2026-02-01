import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { saveOnboardingUseCase, updateBasicProfile } from '@/api/onboarding'
import { FEATURE_ONBOARDING } from '@/constants/featureFlags'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useAuth } from '@/services/useAuth'

const USE_CASES = [
  {
    id: 'send_receive',
    label: 'Send and receive money',
    description: 'Transfer money to bank accounts or other BitBridge users quickly and securely.',
  },
  {
    id: 'virtual_cards',
    label: 'Virtual cards and online spend',
    description: 'Use virtual cards for subscriptions, online shopping, and digital services.',
  },
  {
    id: 'airtime_utilities',
    label: 'Airtime, data and utilities',
    description: 'Top up airtime, data, electricity, and essential bills from your wallet.',
  },
  {
    id: 'taxes',
    label: 'Taxes and statutory bills',
    description: 'Handle tax, levies, and government-related payments from one place.',
  },
  {
    id: 'student_life',
    label: 'Student life and campus spend',
    description: 'Perfect for students managing data, subscriptions, and campus spending.',
  },
]

const KYC_REQUIREMENTS: Record<
  string,
  {
    level: string
    title: string
    points: string[]
  }
> = {
  send_receive: {
    level: 'tier_2',
    title: 'KYC for sending and receiving money',
    points: [
      'BVN or NIN linked to your phone number',
      'Government-issued ID (NIN slip, passport, driver license, or voter card)',
      'Basic personal details (name, date of birth, address)',
    ],
  },
  virtual_cards: {
    level: 'tier_2',
    title: 'KYC for virtual cards and online spend',
    points: [
      'BVN or NIN',
      'Government-issued ID',
      'Sometimes a selfie or extra verification for higher limits',
    ],
  },
  airtime_utilities: {
    level: 'tier_1',
    title: 'Light KYC for airtime, data and bills',
    points: ['Basic profile (name and phone number)', 'Upgrade later to unlock higher limits.'],
  },
  taxes: {
    level: 'tier_2',
    title: 'KYC for tax and statutory payments',
    points: ['BVN or NIN', 'Government-issued ID', 'Address and basic profile details'],
  },
  student_life: {
    level: 'tier_1',
    title: 'Light KYC for student life and campus spend',
    points: [
      'Basic profile (name, date of birth, phone number)',
      'School details or ID (optional for some features)',
      'Upgrade later to unlock virtual cards and higher limits',
    ],
  },
}

const KYC_REQUIRED_NOW = ['send_receive', 'virtual_cards', 'taxes']

const UseCaseScreen = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { userProfileData, loadProfile, authState, authHydrated } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedUseCase, setSelectedUseCase] = useState('')
  const [basicProfile, setBasicProfile] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
  })

  const hydratedRef = useRef(false)
  const didKickoffProfileRef = useRef(false)

  useEffect(() => {
    if (!authHydrated) return
    if (!authState?.authenticated) return
    if (didKickoffProfileRef.current) return
    didKickoffProfileRef.current = true
    loadProfile().catch(() => {})
  }, [authHydrated, authState?.authenticated, loadProfile])

  useEffect(() => {
    if (authState?.authenticated) return
    didKickoffProfileRef.current = false
  }, [authState?.authenticated])

  useEffect(() => {
    if (!userProfileData || hydratedRef.current) return

    const profile = userProfileData?.user_profile || {}
    const dob = profile?.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : ''

    setBasicProfile({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      date_of_birth: dob,
    })

    if (userProfileData?.primary_use_case) {
      setSelectedUseCase(userProfileData.primary_use_case)
    }

    hydratedRef.current = true
  }, [userProfileData])

  const selectedKycConfig = useMemo(
    () => (selectedUseCase ? KYC_REQUIREMENTS[selectedUseCase] : null),
    [selectedUseCase]
  )

  if (!FEATURE_ONBOARDING) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Use Case</Text>
        <Text className="text-gray-400">Onboarding is currently disabled.</Text>
      </View>
    )
  }

  const handleContinue = async () => {
    if (!selectedUseCase) {
      setNotice('Select a primary use case to continue.')
      return
    }

    setSubmitting(true)
    setNotice(null)
    try {
      const first_name = basicProfile.first_name.trim()
      const last_name = basicProfile.last_name.trim()
      const date_of_birth = basicProfile.date_of_birth.trim()
      const hasBasicProfile = !!(first_name || last_name || date_of_birth)

      if (hasBasicProfile) {
        await updateBasicProfile({
          first_name,
          last_name,
          date_of_birth,
        })
      }

      await saveOnboardingUseCase({
        primary_use_case: selectedUseCase,
        onboarding_stage: 'use_case_selected',
      })

      setNotice('Use case saved successfully.')

      const needsKycNow = KYC_REQUIRED_NOW.includes(selectedUseCase)
      router.replace(needsKycNow ? '/kyc' : '/(tabs)')
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to save use case',
      })
      setNotice(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="pt-6">
          <Text className="text-gray-400 text-xs tracking-widest uppercase">Step 2 of 3</Text>
          <Text className="text-white text-2xl font-semibold mt-2">Tell us about you</Text>
          <Text className="text-gray-400 mt-1">
            We use this to personalize your limits, onboarding, and recommendations.
          </Text>

          <View className="mt-6">
            <FormInput
              label="First Name"
              value={basicProfile.first_name}
              onChangeText={(value: string) =>
                setBasicProfile((prev) => ({ ...prev, first_name: value }))
              }
            />
            <FormInput
              label="Last Name"
              value={basicProfile.last_name}
              onChangeText={(value: string) =>
                setBasicProfile((prev) => ({ ...prev, last_name: value }))
              }
            />
            <FormInput
              label="Date of Birth (YYYY-MM-DD)"
              value={basicProfile.date_of_birth}
              onChangeText={(value: string) =>
                setBasicProfile((prev) => ({ ...prev, date_of_birth: value }))
              }
            />
          </View>

          <Text className="text-white text-xl font-semibold mt-8">Primary use case</Text>
          <Text className="text-gray-400 mt-1">Pick one to tailor your experience.</Text>

          <View className="mt-4 gap-3">
            {USE_CASES.map((useCase) => {
              const active = selectedUseCase === useCase.id
              return (
                <TouchableOpacity
                  key={useCase.id}
                  onPress={() => setSelectedUseCase(useCase.id)}
                  className={`rounded-2xl border px-4 py-3 ${
                    active
                      ? 'border-app-primary bg-app-primary/10'
                      : 'border-gray-800 bg-gray-900/70'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white text-sm font-medium">{useCase.label}</Text>
                    {active ? (
                      <View className="bg-app-primary rounded-full px-2 py-1">
                        <Text className="text-[10px] font-semibold text-black">Selected</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-gray-400 text-xs mt-1">{useCase.description}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {selectedKycConfig ? (
            <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <Text className="text-[10px] uppercase tracking-widest text-gray-400">
                KYC requirements
              </Text>
              <Text className="text-white text-sm font-semibold mt-2">
                {selectedKycConfig.title}
              </Text>
              <Text className="text-xs text-gray-400 mt-1">
                Target KYC level:{' '}
                <Text className="text-app-primary font-semibold">
                  {selectedKycConfig.level}
                </Text>
              </Text>
              <View className="mt-3 gap-2">
                {selectedKycConfig.points.map((point, index) => (
                  <View key={`${selectedUseCase}-${index}`} className="flex-row gap-2">
                    <View className="h-1.5 w-1.5 rounded-full bg-app-primary mt-1.5" />
                    <Text className="text-xs text-gray-300 flex-1">{point}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View className="mt-5 rounded-2xl border border-dashed border-gray-800 bg-gray-900/50 p-4">
              <Text className="text-xs text-gray-400">
                Select a use case to see the required KYC level.
              </Text>
            </View>
          )}

          {notice ? <Text className="text-yellow-400 mt-3">{notice}</Text> : null}

          <View className="flex-row items-center justify-between mt-6">
            <TouchableOpacity
              onPress={() => {
                if (!pathname?.startsWith('/(tabs)')) {
                  router.replace('/(tabs)')
                }
              }}
            >
              <Text className="text-xs text-gray-400">Skip for now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleContinue}
              className={`px-5 py-3 rounded-full ${
                !selectedUseCase || submitting
                  ? 'bg-gray-800'
                  : 'bg-app-primary'
              }`}
              disabled={!selectedUseCase || submitting}
            >
              {submitting ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-black text-sm font-semibold">Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default UseCaseScreen
