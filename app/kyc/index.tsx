import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import { getKycStatus, KycStatusResponse } from '@/api/kyc'
import { FEATURE_BVN, FEATURE_KYC_CENTER, FEATURE_OTP } from '@/constants/featureFlags'

type KycStatus = KycStatusResponse['data']

const extractProfile = (payload: KycStatusResponse | any): KycStatus | null => {
  if (!payload) return null
  return (payload.data ?? payload) as KycStatus
}

const StatusPill = ({ label, ok }: { label: string; ok: boolean }) => (
  <View className={`px-3 py-1 rounded-full ${ok ? 'bg-green-700' : 'bg-yellow-700'}`}>
    <Text className="text-white text-xs font-semibold">{label}</Text>
  </View>
)

export default function KycCenter() {
  const { userProfileData } = useAuth()
  const [status, setStatus] = useState<KycStatus | null>(() => extractProfile(userProfileData))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getKycStatus()
      setStatus(extractProfile(res))
    } catch (err: any) {
      setError(err?.message || 'Failed to load KYC status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setStatus(extractProfile(userProfileData))
  }, [userProfileData])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const phoneVerified = !!status?.phone_verified
  const bvnStatus = status?.user_kyc?.bvn_status
  const bvnVerified = bvnStatus === 'verified'

  const tierLabel = useMemo(() => status?.kyc_level || 'tier_0', [status?.kyc_level])

  if (!FEATURE_KYC_CENTER) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">KYC Center</Text>
        <Text className="text-gray-400">KYC Center is currently disabled.</Text>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-primary px-5" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="py-6">
        <Text className="text-white text-2xl font-semibold">KYC Center</Text>
        <Text className="text-gray-400 mt-1">Complete verification to unlock more features.</Text>
      </View>

      <View className="bg-gray-900 rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-white font-semibold">Current Tier</Text>
          <Text className="text-white font-semibold">{tierLabel}</Text>
        </View>
      </View>

      {loading ? (
        <View className="py-4">
          <ActivityIndicator />
        </View>
      ) : null}

      {error ? (
        <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mb-4">
          <Text className="text-white font-semibold">Error</Text>
          <Text className="text-white/80">{error}</Text>
          <TouchableOpacity onPress={fetchStatus} className="mt-3 bg-red-600 py-2 rounded-lg">
            <Text className="text-white text-center">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="bg-gray-900 rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white font-semibold">Phone Verification</Text>
          <StatusPill label={phoneVerified ? 'Verified' : 'Pending'} ok={phoneVerified} />
        </View>
        <Text className="text-gray-400 mb-3">
          {phoneVerified ? 'Your phone number is verified.' : 'Verify your phone number via OTP.'}
        </Text>
        {FEATURE_OTP ? (
          <Link href="/kyc/otp" asChild>
            <TouchableOpacity className="bg-app-primary py-3 rounded-xl items-center">
              <Text className="text-white font-medium">{phoneVerified ? 'View OTP' : 'Start OTP'}</Text>
            </TouchableOpacity>
          </Link>
        ) : (
          <Text className="text-gray-500">OTP is disabled.</Text>
        )}
      </View>

      <View className="bg-gray-900 rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white font-semibold">BVN Verification</Text>
          <StatusPill label={bvnVerified ? 'Verified' : bvnStatus || 'Pending'} ok={bvnVerified} />
        </View>
        <Text className="text-gray-400 mb-3">
          {bvnVerified ? 'Your BVN is verified.' : 'Verify your BVN to reach Tier 2.'}
        </Text>
        {FEATURE_BVN ? (
          <Link href="/kyc/bvn" asChild>
            <TouchableOpacity className="bg-app-primary py-3 rounded-xl items-center">
              <Text className="text-white font-medium">{bvnVerified ? 'View BVN' : 'Start BVN'}</Text>
            </TouchableOpacity>
          </Link>
        ) : (
          <Text className="text-gray-500">BVN verification is disabled.</Text>
        )}
      </View>
    </ScrollView>
  )
}
