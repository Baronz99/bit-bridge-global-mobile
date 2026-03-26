import { ActivityIndicator, Image, Linking, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { icons } from '@/constants/icons'
import { useRouter } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'

const SignUp = () => {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [formInput, setFormInput] = useState({
    email: '',
    password: '',
    confirm_password: '',
  })

  const [loading, setLoading] = useState(false)
  const [hidePassword, setHidePassword] = useState(true)

  const { onRegister } = useAuth()

  const authInputStyle = {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4B5563',
    marginBottom: 4,
  }

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

      await onRegister(formInput)
      router.push('/confirmEmail')
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to register')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-gray-950 px-4">
      <KeyboardAvoidWrapper>
        <View>
          <Image source={icons.appLogo} className="w-full h-48 0 mt-20 mb-5 mx-auto" />

          <View>
            <FormInput
              placeholder="Email Address"
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
              textContentType="newPassword"
              autoComplete="new-password"
              onChangeText={(value: string) => setFormInput({ ...formInput, password: value })}
              style={authInputStyle}
              className="text-white py-4 my-0 text-base font-semibold px-3"
            />
            <FormInput
              placeholder="Confirm Password"
              value={formInput.confirm_password}
              isPassword
              secureTextEntry={hidePassword}
              hidePassword={hidePassword}
              setHidePassword={setHidePassword}
              textContentType="newPassword"
              autoComplete="new-password"
              onChangeText={(value: string) => setFormInput({ ...formInput, confirm_password: value })}
              style={authInputStyle}
              className="text-white py-4 my-0 text-base font-semibold px-3"
            />
            <Text className="text-red-600">{errorMessage} </Text>

            <TouchableOpacity
              className="py-3 flex-row items-center flex justify-center mt-10 bg-app-primary rounded-lg"
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text className="font-semibold text-base text-gray-100">Register</Text>
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
