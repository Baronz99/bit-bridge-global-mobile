import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { userProfileUpdate } from '@/api/auth'
import { useAuth } from '@/services/useAuth'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import FormInput from '@/components/FormInput'
import { images } from '@/constants/images'
import Loader from '@/components/Loader'
import AppAlert from '@/components/app-notification/AppAlert'

type ErrorState = {
  error: boolean
  message: string | null
  data: any | null
}

type ProfileForm = {
  email: string
  first_name: string
  last_name: string
  phone: string
  address_line1: string
  city: string
  state: string
  postal_code: string
  user_profile_id: string
}

const index = () => {
  const [errorMessage, setErrorMessage] = useState<ErrorState>({
    error: false,
    message: null,
    data: null,
  })

  const { userProfileData, loadProfile } = useAuth()

  const [formInput, setFormInput] = useState<ProfileForm>({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    user_profile_id: '',
  })

  const [loading, setLoading] = useState(false)

  const handleUpdate = async () => {
    if (
      !formInput.address_line1.trim() ||
      !formInput.city.trim() ||
      !formInput.state.trim() ||
      !formInput.postal_code.trim()
    ) {
      setErrorMessage({
        error: true,
        data: null,
        message: 'Address, city, state, and postal code are required.',
      })
      return
    }

    setLoading(true)
    try {
      const result = await userProfileUpdate({
        formData: {
          ...formInput,
          user_profile_id: String(userProfileData?.user_profile?.id ?? ''),
        },
      })

      await loadProfile({ force: true })

      setErrorMessage({
        error: false,
        data: result?.data ?? null,
        message: result?.message ?? 'Profile updated successfully.',
      })
    } catch (error: any) {
      setErrorMessage({
        error: true,
        data: null,
        message: error?.message ?? 'Something went wrong',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userProfileData) return

    // ✅ Use functional state update to avoid stale `formInput` closure
    setFormInput((prev) => ({
      ...prev,
      first_name: String(userProfileData?.user_profile?.first_name ?? ''),
      last_name: String(userProfileData?.user_profile?.last_name ?? ''),
      phone: String(userProfileData?.user_profile?.phone_number ?? ''),
      email: String(userProfileData?.email ?? ''),
      address_line1: String(userProfileData?.user_profile?.address_line1 ?? ''),
      city: String(userProfileData?.user_profile?.city ?? ''),
      state: String(userProfileData?.user_profile?.state ?? ''),
      postal_code: String(userProfileData?.user_profile?.postal_code ?? ''),
    }))
  }, [userProfileData])

  return (
    <>
      <View className="flex-1 bg-gray-950">
        <KeyboardAvoidWrapper>
          <View>
            <Image source={images?.user} className="w-20 h-20 mt-20 mb-5 mx-auto" />

            <View>
              <FormInput
                placeholder="First Name"
                value={formInput.first_name}
                onChangeText={(value: string) => setFormInput((p) => ({ ...p, first_name: value }))}
                className="border-gray-800 border-b text-white my-0 py-4 border-b-1 text-base font-semibold px-3"
              />

              <FormInput
                value={formInput.last_name}
                placeholder="Last Name"
                onChangeText={(value: string) => setFormInput((p) => ({ ...p, last_name: value }))}
                className="border-gray-600 border-b text-white my-0 py-4 border-b-1 text-base font-semibold px-3"
              />

              <FormInput
                value={formInput.email}
                placeholder="Email Address"
                onChangeText={(value: string) => setFormInput((p) => ({ ...p, email: value }))}
                className="border-gray-600 border-b text-white my-0 py-4 border-b-1 text-base font-semibold px-3"
              />

              <FormInput
                value={formInput.phone}
                placeholder="Phone Number"
                onChangeText={(value: string) => setFormInput((p) => ({ ...p, phone: value }))}
                className="border-gray-600 border-b text-white my-0 py-4 border-b-1 text-base font-semibold px-3"
              />

              <FormInput
                value={formInput.address_line1}
                placeholder="Address Line 1"
                onChangeText={(value: string) =>
                  setFormInput((p) => ({ ...p, address_line1: value }))
                }
                className="border-gray-600 border-b text-white my-0 py-4 border-b-1 text-base font-semibold px-3"
              />

              <FormInput
                value={formInput.city}
                placeholder="City"
                onChangeText={(value: string) => setFormInput((p) => ({ ...p, city: value }))}
                className="border-gray-600 border-b text-white my-0 py-4 border-b-1 text-base font-semibold px-3"
              />

              <FormInput
                value={formInput.state}
                placeholder="State"
                onChangeText={(value: string) => setFormInput((p) => ({ ...p, state: value }))}
                className="border-gray-600 border-b text-white my-0 py-4 border-b-1 text-base font-semibold px-3"
              />

              <FormInput
                value={formInput.postal_code}
                placeholder="Postal Code"
                onChangeText={(value: string) =>
                  setFormInput((p) => ({ ...p, postal_code: value }))
                }
                className="border-gray-600 border-b text-white my-0 py-4 border-b-1 text-base font-semibold px-3"
              />

              {!!errorMessage.message && (
                <Text className="text-red-600 mt-2">{errorMessage.message}</Text>
              )}

              <TouchableOpacity
                className="py-3 flex-row items-center justify-center mt-10 bg-app-primary rounded-lg"
                onPress={handleUpdate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-semibold text-base text-gray-100">Update Profile</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidWrapper>
      </View>

      <Loader open={loading} />

      <AppAlert
        message={errorMessage.message}
        error={errorMessage.error}
        data={errorMessage.data}
        onPress={() => setErrorMessage({ error: false, message: null, data: null })}
      />
    </>
  )
}

export default index

const styles = StyleSheet.create({})
