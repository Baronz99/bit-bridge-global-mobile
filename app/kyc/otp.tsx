import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import { requestPhoneOtp, verifyPhoneOtp, PhoneVerificationRequestResponse } from '@/api/kyc'
import { useAuth } from '@/services/useAuth'
import { FEATURE_KYC_CENTER, FEATURE_OTP } from '@/constants/featureFlags'

const getErrorMessage = (err: any) =>
  err?.response?.data?.message ||
  err?.response?.data?.errors?.[0] ||
  err?.message ||
  'Something went wrong'

export default function OtpScreen() {
  const router = useRouter()
  const { loadProfile } = useAuth()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<PhoneVerificationRequestResponse | null>(null)
  const [verified, setVerified] = useState(false)

  const canVerify = useMemo(() => code.trim().length > 0, [code])

  const handleRequest = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await requestPhoneOtp({ phone_number: phoneNumber })
      setStatus(res)
      if (res.status === 'already_verified') {
        await loadProfile({ force: true })
        setVerified(true)
      }
    } catch (err: any) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [loadProfile, phoneNumber])

  const handleVerify = useCallback(async () => {
    if (!canVerify) return
    setLoading(true)
    setError(null)
    try {
      const res = await verifyPhoneOtp({ phone_number: phoneNumber, code })
      if (res.status === 'verified') {
        await loadProfile({ force: true })
        setVerified(true)
      } else {
        setError(res.errors?.[0] || 'Verification failed')
      }
    } catch (err: any) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [canVerify, code, loadProfile, phoneNumber])

  if (!FEATURE_KYC_CENTER || !FEATURE_OTP) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Phone OTP</Text>
        <Text className="text-gray-400">OTP verification is currently disabled.</Text>
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
        <Text className="text-white text-2xl font-semibold">Phone OTP</Text>
        <Text className="text-gray-400 mt-1">Verify your phone number using OTP.</Text>
      </View>

      <View className="bg-gray-900 rounded-2xl p-4 mb-4">
        <Text className="text-white font-semibold mb-2">Phone Number</Text>
        <FormInput
          required={true}
          placeHolder="08012345678"
          onChangeText={(value: string) => setPhoneNumber(value)}
          className="border border-gray-600 text-white rounded-lg mt-2 py-2 px-3"
          name="phone_number"
          type="text"
        />

        <TouchableOpacity
          onPress={handleRequest}
          disabled={loading || phoneNumber.trim().length === 0}
          className="bg-app-primary py-3 rounded-xl items-center mt-4"
        >
          {loading ? <ActivityIndicator /> : <Text className="text-white font-medium">Request OTP</Text>}
        </TouchableOpacity>
      </View>

      <View className="bg-gray-900 rounded-2xl p-4 mb-4">
        <Text className="text-white font-semibold mb-2">Enter OTP</Text>
        <FormInput
          required={true}
          placeHolder="123456"
          onChangeText={(value: string) => setCode(value)}
          className="border border-gray-600 text-white rounded-lg mt-2 py-2 px-3"
          name="otp_code"
          type="text"
        />

        <TouchableOpacity
          onPress={handleVerify}
          disabled={loading || !canVerify}
          className="bg-app-primary py-3 rounded-xl items-center mt-4"
        >
          {loading ? <ActivityIndicator /> : <Text className="text-white font-medium">Verify OTP</Text>}
        </TouchableOpacity>
      </View>

      {status?.status ? (
        <View className="bg-gray-800 rounded-2xl p-4 mb-4">
          <Text className="text-white font-semibold">Request Status</Text>
          <Text className="text-gray-300 mt-1">{status.status}</Text>
          {status.message ? <Text className="text-gray-400 mt-1">{status.message}</Text> : null}
        </View>
      ) : null}

      {verified ? (
        <View className="bg-green-700/30 border border-green-700/50 rounded-xl p-3 mb-4">
          <Text className="text-white font-semibold">Phone verified</Text>
          <Text className="text-gray-100 mt-1">Your phone number is verified.</Text>
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
