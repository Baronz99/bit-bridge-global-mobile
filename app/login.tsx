import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, { useState } from 'react'
import { icons } from '@/constants/icons'
import { Link, useRouter } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'

const Login = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()

  const [formInput, setFormInput] = useState({
    email: '',
    password: '',
  })

  const [hidePassword, setHidePassword] = useState(true)
  const [loading, setLoading] = useState(false)

  const { onLogin, authState } = useAuth()

  const handleLogin = async () => {
    try {
      setErrorMessage(null)

      const email = formInput.email.trim()
      const password = formInput.password.trim()

      if (!email || !password) {
        throw new Error('Enter Login Details')
      }

      setLoading(true)
      await onLogin({ email, password })
      router.replace('/' as any)
    } catch (error: any) {
      setErrorMessage(error?.message || 'Login failed')
      console.error('Login error:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4 ">
      <Image source={icons.appLogo} className="w-full h-96 mb-5 mx-auto" />

      <KeyboardAvoidWrapper>
        <View className="flex-1">
          <View>
            <FormInput
              placeholder="Enter Email Address"
              value={formInput.email}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              onChangeText={(value: string) => setFormInput({ ...formInput, email: value })}

              className="border-gray-600 border-b text-white my-0 py-4 border-b-1 text-base font-semibold px-3 "
            />

            <FormInput
              placeholder="Enter Password"
              isPassword
              secureTextEntry={hidePassword}
              hidePassword={hidePassword}
              setHidePassword={setHidePassword}
              onChangeText={(value: string) => setFormInput({ ...formInput, password: value })}

              className="border-gray-600 text-white border-b py-4 my-0 border-b-1 text-base font-semibold px-3 "
            />

            <Link href={"/forgot-password" as any} className="text-alt text-right mt-2">
              Forgot password?
            </Link>

            <TouchableOpacity
              className="py-3 flex-row items-center flex justify-center mt-10 bg-app-primary rounded-lg"
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text className="font-semibold text-base text-gray-100">
                  Log In
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {!!errorMessage && <Text className="text-red-600 mt-3">{errorMessage}</Text>}

          {/* Debug */}
          <Text className="text-gray-400 mt-2 text-xs">
            Authenticated: {String(authState?.authenticated)}
          </Text>

          <TouchableOpacity className="w-full m-auto mt-auto py-3 flex-row">
            <Text className="text-white w-full border-gray-800 border-b py-2 text-center">
              Don't have an account?{' '}
              <Link
                href={"/sign-up" as any}
                className="text-center border-gray-100 border-b text-alt py-2"
              >
                Sign Up
              </Link>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default Login

const styles = StyleSheet.create({})
