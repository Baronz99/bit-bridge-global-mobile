import {
  ActivityIndicator,
  Image,
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
import { error as logError } from '@/utils/log'

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

  const authInputStyle = {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4B5563',
    marginBottom: 4,
  }

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
      router.replace('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setErrorMessage(message)
      logError('Login error:', message)
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
              style={authInputStyle}
              className="text-white my-0 py-4 text-base font-semibold px-3"
            />

            <FormInput
              placeholder="Enter Password"
              value={formInput.password}
              isPassword
              secureTextEntry={hidePassword}
              hidePassword={hidePassword}
              setHidePassword={setHidePassword}
              textContentType="password"
              autoComplete="password"
              onChangeText={(value: string) => setFormInput({ ...formInput, password: value })}
              style={authInputStyle}
              className="text-white py-4 my-0 text-base font-semibold px-3"
            />

            <Link href="/forgot-password" className="text-alt text-right mt-2">
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

          {__DEV__ ? (
            <Text className="text-gray-400 mt-2 text-xs">
              Authenticated: {String(authState?.authenticated)}
            </Text>
          ) : null}

          <TouchableOpacity className="w-full m-auto mt-auto py-3 flex-row">
            <Text className="text-white w-full border-gray-800 border-b py-2 text-center">
              Don&apos;t have an account?{' '}
              <Link
                href="/sign-up"
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
