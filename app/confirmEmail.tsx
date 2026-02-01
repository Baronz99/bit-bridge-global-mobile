import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import React, { useEffect, useState } from 'react'
import { icons } from '@/constants/icons'
import { Link, router, useRouter } from 'expo-router'
import { sendUserConfirmation } from '@/api/auth'
import * as SecureStore from 'expo-secure-store'
import Loader from '@/components/Loader'

const ConfirmEmail = () => {
  const [errorMessage, setErrorMessage] = useState(null)
  const [email, setEmail] = useState<string | null>(null)
  const router = useRouter()

  const [formInput, setFormInput] = useState({
    email: '',
    password: '',
  })

  useEffect(() => {
    ;(async () => {
      const emailadd = await SecureStore.getItemAsync('email')
      console.log(emailadd)
      setEmail(emailadd)
    })()
  }, [])

  const [loading, setLoading] = useState(false)
  const handleLogin = async () => {
    router.push('/login')
  }

  const handleResend = async () => {
    setLoading(true)

    try {
      if (!email) {
        throw new Error('Email not available')
      }

      const result = await sendUserConfirmation(email)

      setLoading(false)
    } catch (error: any) {
      // Handle errors during the login process
      setErrorMessage(error?.message || 'failed to resend email')
      setLoading(false)
    }
  }
  return (
    <View className="flex-1 bg-primary flex justify-center items-center px-4">
      <View>
        <Text className="text-white my-4 text-center font-semibold text-xl">
          Check your inbox to verify your email
        </Text>
        <Text className="text-gray-400 text-center text-sm">
          We sent a confirmation email to {email ?? 'you'}. Open it to finish setup.
        </Text>
      </View>
      <Image source={icons.email} className="w-40 h-40 mb-5 mx-auto" />

      <View className="items-center justify-center">
        <View>
          <TouchableOpacity
            className="py-3 px-4  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg"
            onPress={handleLogin}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className=" font-semibold text-base text-gray-100">Continue to LogIn</Text>
            )}
          </TouchableOpacity>
        </View>

        {!!errorMessage && <Text className="text-red-600 mt-2">{errorMessage}</Text>}
        <TouchableOpacity onPress={handleResend} className="w-full m-auto mt-auto py-3 flex-row">
          <Text className="text-white  w-full  border-b py-2 text-center">Resend Email</Text>
        </TouchableOpacity>
      </View>

      <Loader open={loading} />
    </View>
  )
}

export default ConfirmEmail

const styles = StyleSheet.create({})
