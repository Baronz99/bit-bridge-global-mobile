import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import { verifyBvn, BvnVerifyResponse } from '@/api/kyc'
import { useAuth } from '@/services/useAuth'
import { FEATURE_BVN, FEATURE_KYC_CENTER } from '@/constants/featureFlags'

const getErrorMessage = (err: any) =>
  err?.response?.data?.message || err?.message || 'Something went wrong'

export default function BvnScreen() {
  const router = useRouter()
  const { loadProfile } = useAuth()
  const [bvn, setBvn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BvnVerifyResponse | null>(null)

  const bvnValid = useMemo(() => /^\d{11}$/.test(bvn.trim()), [bvn])

  const handleVerify = useCallback(async () => {
    if (!bvnValid) return
    setLoading(true)
    setError(null)
    try {
      const res = await verifyBvn({ bvn })
      setResult(res)
      if (res.status && res.status !== 'error') {
        await loadProfile({ force: true })
      }
    } catch (err: any) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [bvn, bvnValid, loadProfile])

  if (!FEATURE_KYC_CENTER || !FEATURE_BVN) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">BVN Verification</Text>
        <Text className="text-gray-400">BVN verification is currently disabled.</Text>
        <Link href="/kyc" asChild>
          <TouchableOpacity className="mt-4 bg-app-primary py-3 rounded-xl items-center">
            <Text className="text-white font-medium">Back to KYC Center</Text>
          </TouchableOpacity>
        </Link>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-primary px-5" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="py-6">
        <Text className="text-white text-2xl font-semibold">BVN Verification</Text>
        <Text className="text-gray-400 mt-1">Enter your BVN to verify your identity.</Text>
      </View>

      <View className="bg-gray-900 rounded-2xl p-4 mb-4">
        <Text className="text-white font-semibold mb-2">BVN</Text>
        <FormInput
          required={true}
          placeHolder="12345678901"
          onChangeText={(value: string) => setBvn(value)}
          className="border border-gray-600 text-white rounded-lg mt-2 py-2 px-3"
          name="bvn"
          type="text"
        />

        <TouchableOpacity
          onPress={handleVerify}
          disabled={loading || !bvnValid}
          className="bg-app-primary py-3 rounded-xl items-center mt-4"
        >
          {loading ? <ActivityIndicator /> : <Text className="text-white font-medium">Verify BVN</Text>}
        </TouchableOpacity>
      </View>

      {result ? (
        <View className="bg-gray-900 rounded-2xl p-4 mb-4">
          <Text className="text-white font-semibold">Result</Text>
          <Text className="text-gray-300 mt-1">Status: {result.status}</Text>
          {result.reason ? <Text className="text-gray-400 mt-1">Reason: {result.reason}</Text> : null}
          {result.tier ? <Text className="text-gray-400 mt-1">Tier: {result.tier}</Text> : null}
          {result.bvn_last4 ? <Text className="text-gray-400 mt-1">BVN: ****{result.bvn_last4}</Text> : null}
        </View>
      ) : null}

      {result?.status === 'verified' ? (
        <View className="bg-green-700/30 border border-green-700/50 rounded-xl p-3 mb-4">
          <Text className="text-white font-semibold">BVN verified</Text>
          <Text className="text-gray-100 mt-1">Your BVN is verified.</Text>
          <TouchableOpacity onPress={() => router.replace('/kyc')} className="mt-3 bg-green-700 py-2 rounded-lg">
            <Text className="text-white text-center">Back to KYC Center</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3">
          <Text className="text-white font-semibold">Error</Text>
          <Text className="text-white/80">{error}</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}
