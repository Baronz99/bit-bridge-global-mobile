import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, { useEffect, useState } from 'react'
import { icons } from '@/constants/icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { sendUserConfirmation } from '@/api/auth'
import * as SecureStore from 'expo-secure-store'
import Loader from '@/components/Loader'
import { clearConfirmationFlow, getConfirmationFlow } from '@/auth/tokenstore'

const ConfirmEmail = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [flow, setFlow] = useState<'signup' | 'email-change'>('signup')
  const router = useRouter()
  const params = useLocalSearchParams<{ flow?: string; email?: string }>()

  useEffect(() => {
    ;(async () => {
      const storedEmail = await SecureStore.getItemAsync('email')
      const storedFlow = await getConfirmationFlow()
      const nextEmail = String(params.email || storedEmail || '').trim()
      const nextFlow = String(params.flow || storedFlow || 'signup').trim() === 'email-change' ? 'email-change' : 'signup'
      setEmail(nextEmail || null)
      setFlow(nextFlow)
    })()
  }, [params.email, params.flow])

  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    if (flow === 'email-change') {
      await clearConfirmationFlow()
      router.replace('/accountProfile')
      return
    }

    router.push('/login')
  }

  const handleResend = async () => {
    setLoading(true)

    try {
      if (!email) {
        throw new Error('Email not available')
      }

      await sendUserConfirmation(email)
      setErrorMessage(null)
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to resend email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary flex justify-center items-center px-4">
      <View>
        <Text className="text-white my-4 text-center font-semibold text-xl">
          {flow === 'email-change' ? 'Confirm your new email' : 'Check your inbox to verify your email'}
        </Text>
        <Text className="text-gray-400 text-center text-sm">
          {flow === 'email-change'
            ? `We sent a confirmation email to ${email ?? 'you'}. Your current login email stays active until you confirm the new address.`
            : `We sent a confirmation email to ${email ?? 'you'}. Open it to finish setup.`}
        </Text>
      </View>
      <Image source={icons.email} className="w-40 h-40 mb-5 mx-auto" />

      <View className="items-center justify-center">
        <View>
          <TouchableOpacity
            className="py-3 px-4 flex-row items-center justify-center mt-10 bg-app-primary rounded-lg"
            onPress={handleContinue}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-semibold text-base text-gray-100">
                {flow === 'email-change' ? 'Back to Profile' : 'Continue to LogIn'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {!!errorMessage && <Text className="text-red-600 mt-2">{errorMessage}</Text>}
        <TouchableOpacity onPress={handleResend} className="w-full m-auto mt-auto py-3 flex-row">
          <Text className="text-white w-full border-b py-2 text-center">Resend Email</Text>
        </TouchableOpacity>
      </View>

      <Loader open={loading} />
    </View>
  )
}

export default ConfirmEmail

const styles = StyleSheet.create({})
