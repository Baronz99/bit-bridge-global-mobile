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
import React, { useState } from 'react'
import { icons } from '@/constants/icons'
import { Link, router, useRouter } from 'expo-router'
import { Formik } from 'formik'
import { useAuth } from '@/services/useAuth'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'

const Login = () => {
  const [errorMessage, setErrorMessage] = useState<null | string>(null)
  const router = useRouter()

  const [formInput, setFormInput] = useState({
    email: '',
    password: '',
  })

  const [hidePassword, setHidePassword] = useState(true)
  const [loading, setLoading] = useState(false)

  const { onLogin } = useAuth()
  const handleLogin = async () => {
    try {
      if (formInput.email.trim() === '' || formInput.password.trim() === '') {
        throw new Error('Enter Login Details')
      }
      setLoading(true)

      const result = await onLogin(formInput)
      if (result) {
        router.push('/')
      } else {
        setErrorMessage('Invalid email or password')
      }

      setLoading(false)
    } catch (error: any) {
      setLoading(false)
      setErrorMessage(error.message)
      console.error('Login error:', error.message)
    }
  }
  return (
    <View className="flex-1 bg-primary px-4 ">
      <Image source={icons.appLogo} className="w-full h-96 mb-5 mx-auto" />
      <Link href={'/sign-up'} asChild></Link>
      <KeyboardAvoidWrapper>
        <View className="flex-1">
          <View>
            <FormInput
              placeholder="Enter Email Address"
              value={formInput.email}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              onChangeText={(value) => setFormInput({ ...formInput, email: value })}
              className="border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 "
            />
            <FormInput
              placeholder="Enter Password"
              isPassword={true}
              // value={formInput.password}

              secureTextEntry={hidePassword}
              hidePassword={hidePassword}
              setHidePassword={setHidePassword}
              onChangeText={(value) => setFormInput({ ...formInput, password: value })}
              className="border-gray-600  text-white border-b py-4 my-0  border-b-1 text-base font-semibold px-3 "
            />
            <TouchableOpacity
              className="py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg"
              onPress={handleLogin}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text className=" font-semibold text-base text-gray-100">Log In</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text className="text-red-600">{errorMessage} </Text>
          <TouchableOpacity className="w-full m-auto mt-auto py-3 flex-row">
            <Text className="text-white  w-full border-gray-800 border-b py-2 text-center">
              Don't have an account?{' '}
              <Link
                href={'/sign-up'}
                className=" text-center border-gray-100 border-b text-alt py-2 "
              >
                {' '}
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
