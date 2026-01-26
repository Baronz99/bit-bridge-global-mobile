import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import ConsentCheckbox from '@/components/CheckInput'

const SignUp = () => {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<null | string>(null)

  const [formInput, setFormInput] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    confirm_password: '',
  })

  const [checked, setChecked] = useState(false)

  const [loading, setLoading] = useState(false)

  const [hidePassword, setHidePassword] = useState(true)

  const { onRegister } = useAuth()

  const handleLogin = async () => {
    setLoading(true)
    try {
      if (!checked) {
        setErrorMessage('You must consent before signing up')
        return
      }
      if (formInput.password !== formInput.confirm_password) {
        throw new Error('Passwords do not match')
      }

      const result = await onRegister(formInput)

      setLoading(false)
      router.push('/confirmEmail')
    } catch (error: any) {
      // Handle errors during the login process
      setErrorMessage(error.message)
      setLoading(false)
    }
  }
  return (
    <View className="flex-1  bg-gray-950">
      <KeyboardAvoidWrapper>
        <View>
          <Image source={icons.appLogo} className="w-full h-48 0 mt-20 mb-5 mx-auto" />

          <View className="">
            <FormInput
              placeholder="Email Address"
              onChangeText={(value: string) => setFormInput({ ...formInput, email: value })}
              className="border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 "
            />
            <FormInput
              placeholder="Enter Password"
              isPassword={true}
              secureTextEntry={hidePassword}
              hidePassword={hidePassword}
              setHidePassword={setHidePassword}
              onChangeText={(value: string) => setFormInput({ ...formInput, password: value })}
              className="border-gray-600 text-white border-b py-4 my-0  border-b-1 text-base font-semibold px-3 "
            />
            <FormInput
              placeholder="Confirm Password"
              isPassword={true}
              secureTextEntry={hidePassword}
              hidePassword={hidePassword}
              setHidePassword={setHidePassword}
              onChangeText={(value: string) => setFormInput({ ...formInput, confirm_password: value })}
              className="border-gray-600 text-white border-b py-4 my-0  border-b-1 text-base font-semibold px-3 "
            />
            <FormInput
              placeholder="First Name (optional)"
              onChangeText={(value: string) => setFormInput({ ...formInput, first_name: value })}
              className="border-gray-800 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 "
            />
            <FormInput
              placeholder="Last Name (optional)"
              onChangeText={(value: string) => setFormInput({ ...formInput, last_name: value })}
              className="border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 "
            />
            <FormInput
              placeholder="Phone Number (optional)"
              onChangeText={(value: string) => setFormInput({ ...formInput, phone: value })}
              className="border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 "
            />
            <View className="flex flex-row items-center">
              <ConsentCheckbox checked={checked} setChecked={setChecked} />

              <Text className="text-gray-400">
                I hereby give my e-signature and consent to use this platform in accordance with the{' '}
                <Text
                  className="text-white "
                  onPress={() => Linking.openURL('https://yourapp.com/terms')}
                >
                  Terms & Conditions
                </Text>
                .
              </Text>
            </View>
            <Text className="text-red-600">{errorMessage} </Text>

            <TouchableOpacity
              className="py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg"
              onPress={handleLogin}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text className=" font-semibold text-base text-gray-100">Register</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default SignUp

const styles = StyleSheet.create({})
