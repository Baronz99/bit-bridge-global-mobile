import React, { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { createCard, registerCardholder } from '@/api/cards'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'

const CreateCard = () => {
  const router = useRouter()
  const { userProfileData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createdCardId, setCreatedCardId] = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'NG',
    currency: 'USD',
  })

  const hasKycAccess = () => {
    const payload = userProfileData?.data ?? userProfileData
    const kycLevel = payload?.kyc_level || payload?.user_kyc?.kyc_level
    const phoneVerified = payload?.phone_verified === true || payload?.phone_verified_at
    if (!kycLevel && !phoneVerified) return false
    if (kycLevel && String(kycLevel).toLowerCase() === 'tier_0') return false
    return true
  }

  const handleSubmit = async () => {
    if (!hasKycAccess()) {
      setNotice('Complete KYC to create a card.')
      router.push('/kyc')
      return
    }
    setLoading(true)
    setNotice(null)
    try {
      const profile = userProfileData?.user_profile ?? userProfileData?.data?.user_profile ?? {}
      const payload = {
        first_name: form.first_name || profile?.first_name,
        last_name: form.last_name || profile?.last_name,
        email: form.email || userProfileData?.email,
        phone_number: form.phone_number || profile?.phone_number,
        address_line1: form.address_line1 || profile?.address_line1,
        city: form.city || profile?.city,
        state: form.state || profile?.state,
        postal_code: form.postal_code || profile?.postal_code,
        country: form.country || 'NG',
      }

      const registerRes = await registerCardholder(payload)
      const cardholderId =
        registerRes?.data?.id ||
        registerRes?.data?.cardholder_id ||
        registerRes?.cardholder_id ||
        registerRes?.id

      const cardRes = await createCard({
        cardholder_id: cardholderId,
        currency: form.currency || 'USD',
      })

      const cardId =
        cardRes?.data?.id || cardRes?.data?.card_id || cardRes?.card_id || cardRes?.id

      setSuccess(cardRes?.message || 'Card created successfully.')
      if (cardId) setCreatedCardId(String(cardId))
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to create card',
      })
      setNotice(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="pt-8">
          <Text className="text-white text-2xl font-semibold">Create Card</Text>
          <Text className="text-gray-400 mt-1">
            Enter your details to issue a virtual card.
          </Text>

          <View className="mt-6">
            <FormInput
              label="First Name"
              value={form.first_name}
              onChangeText={(value: string) => setForm({ ...form, first_name: value })}
            />
            <FormInput
              label="Last Name"
              value={form.last_name}
              onChangeText={(value: string) => setForm({ ...form, last_name: value })}
            />
            <FormInput
              label="Email"
              value={form.email}
              keyboardType="email-address"
              onChangeText={(value: string) => setForm({ ...form, email: value })}
            />
            <FormInput
              label="Phone Number"
              value={form.phone_number}
              keyboardType="phone-pad"
              onChangeText={(value: string) => setForm({ ...form, phone_number: value })}
            />
            <FormInput
              label="Address Line 1"
              value={form.address_line1}
              onChangeText={(value: string) => setForm({ ...form, address_line1: value })}
            />
            <FormInput
              label="City"
              value={form.city}
              onChangeText={(value: string) => setForm({ ...form, city: value })}
            />
            <FormInput
              label="State"
              value={form.state}
              onChangeText={(value: string) => setForm({ ...form, state: value })}
            />
            <FormInput
              label="Postal Code"
              value={form.postal_code}
              onChangeText={(value: string) => setForm({ ...form, postal_code: value })}
            />
            <FormInput
              label="Country"
              value={form.country}
              onChangeText={(value: string) => setForm({ ...form, country: value })}
            />
            <FormInput
              label="Currency"
              value={form.currency}
              onChangeText={(value: string) => setForm({ ...form, currency: value })}
            />
          </View>

          {notice ? <Text className="text-yellow-400 mt-2">{notice}</Text> : null}

          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-app-primary py-4 rounded-xl mt-6"
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-white text-center font-medium">Create Card</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>

      <AppModal
        open={!!success}
        onclose={() => {
          setSuccess(null)
          setCreatedCardId(null)
          router.replace('/cards')
        }}
      >
        <View className="bg-gray-900 w-full rounded-xl px-4 py-6">
          <Text className="text-white text-center text-xl mb-2">Card Created</Text>
          <Text className="text-gray-300 text-center mb-6">{success}</Text>
          <View className="flex-row gap-4">
            <TouchableOpacity
              onPress={() => {
                setSuccess(null)
                setCreatedCardId(null)
                router.replace('/cards')
              }}
              className="bg-gray-800 py-3 flex-1 rounded-xl"
            >
              <Text className="text-white text-center">Back to Cards</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (createdCardId) {
                  router.replace({ pathname: '/cards/[id]', params: { id: createdCardId } })
                }
                setSuccess(null)
              }}
              className="bg-app-primary py-3 flex-1 rounded-xl"
            >
              <Text className="text-white text-center">View Card</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppModal>
    </View>
  )
}

export default CreateCard
