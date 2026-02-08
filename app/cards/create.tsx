import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { createCard, registerCardholder } from '@/api/cards'
import { resolveUserProfile, useAuth } from '@/services/useAuth'
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

  const profileRoot = useMemo(() => resolveUserProfile(userProfileData) || {}, [userProfileData])
  const profileDefaults = useMemo(() => {
    const first = String(profileRoot?.first_name || '').trim()
    const last = String(profileRoot?.last_name || '').trim()
    const email = String(profileRoot?.email || userProfileData?.email || '').trim()
    const phone = String(
      profileRoot?.phone_number || profileRoot?.phone || profileRoot?.phone_e164 || ''
    ).trim()
    const address = String(profileRoot?.address_line1 || profileRoot?.address || '').trim()
    const city = String(profileRoot?.city || '').trim()
    const state = String(profileRoot?.state || '').trim()
    const postal = String(profileRoot?.postal_code || profileRoot?.zip || '').trim()
    const country = String(profileRoot?.country || 'NG').trim().toUpperCase()

    return {
      first_name: first,
      last_name: last,
      email,
      phone_number: phone,
      address_line1: address,
      city,
      state,
      postal_code: postal,
      country: country || 'NG',
      currency: 'USD',
    }
  }, [profileRoot, userProfileData?.email])

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      first_name: prev.first_name || profileDefaults.first_name,
      last_name: prev.last_name || profileDefaults.last_name,
      email: prev.email || profileDefaults.email,
      phone_number: prev.phone_number || profileDefaults.phone_number,
      address_line1: prev.address_line1 || profileDefaults.address_line1,
      city: prev.city || profileDefaults.city,
      state: prev.state || profileDefaults.state,
      postal_code: prev.postal_code || profileDefaults.postal_code,
      country: prev.country || profileDefaults.country,
      currency: prev.currency || 'USD',
    }))
  }, [profileDefaults])

  const hasKycAccess = () => {
    const kycLevel = profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level
    const phoneVerified = profileRoot?.phone_verified === true || profileRoot?.phone_verified_at
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
      const payload = {
        first_name: String(form.first_name || profileDefaults.first_name || '').trim(),
        last_name: String(form.last_name || profileDefaults.last_name || '').trim(),
        email: String(form.email || profileDefaults.email || userProfileData?.email || '').trim(),
        phone_number: String(form.phone_number || profileDefaults.phone_number || '').trim(),
        address_line1: String(form.address_line1 || profileDefaults.address_line1 || '').trim(),
        city: String(form.city || profileDefaults.city || '').trim(),
        state: String(form.state || profileDefaults.state || '').trim(),
        postal_code: String(form.postal_code || profileDefaults.postal_code || '').trim(),
        country: String(form.country || profileDefaults.country || 'NG').trim().toUpperCase(),
      }

      const missing = Object.entries({
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone_number: payload.phone_number,
        address_line1: payload.address_line1,
        city: payload.city,
        state: payload.state,
        postal_code: payload.postal_code,
        country: payload.country,
      })
        .filter(([, value]) => !String(value || '').trim())
        .map(([key]) => key.replace('_', ' '))

      if (missing.length) {
        setNotice(`Complete profile fields: ${missing.join(', ')}`)
        setLoading(false)
        return
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
