import { ActivityIndicator, Image, Linking, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { icons } from '@/constants/icons'
import { useRouter } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'

const SignUp = () => {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<null | string>(null)

  const [formInput, setFormInput] = useState({
    email: '',
    password: '',
    confirm_password: '',
  })

  const [loading, setLoading] = useState(false)

  const [hidePassword, setHidePassword] = useState(true)

  const { onRegister } = useAuth()

  const handleSignUp = async () => {
    setLoading(true)
    try {
      setErrorMessage(null)
      if (!formInput.email || !formInput.password || !formInput.confirm_password) {
        setErrorMessage('Please fill in all fields.')
        setLoading(false)
        return
      }
      if (formInput.password !== formInput.confirm_password) {
        throw new Error('Passwords do not match.')
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
            <Text className="text-red-600">{errorMessage} </Text>

            <TouchableOpacity
              className="py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg"
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text className=" font-semibold text-base text-gray-100">Register</Text>
              )}
            </TouchableOpacity>
            <Text className="text-gray-400 text-xs mt-4 text-center">
              By continuing, you agree to BitBridge&apos;s{' '}
              <Text
                className="text-white underline"
                onPress={() => Linking.openURL('https://bitbridgeglobal.com')}
              >
                Terms & Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default SignUp
