import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { createCard, getUserCards, registerCardholder } from '@/api/cards'
import { uploadSelfieToCloudinary } from '@/api/uploads'
import { useAuth } from '@/services/useAuth'
import { resolveUserProfile } from '@/services/auth/resolveUserProfile'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import AppModal from '@/components/modal/Modal'

const resolveCardRouteId = (payload: any): string | null => {
  const root = payload?.data ?? payload
  if (Array.isArray(root)) {
    const first = root[0] || {}
    return String(first?.id || first?.card_id || '').trim() || null
  }
  if (!root || typeof root !== 'object') return null
  return String(root?.id || root?.card_id || '').trim() || null
}

const CreateCard = () => {
  const router = useRouter()
  const { userProfileData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createdCardId, setCreatedCardId] = useState<string | null>(null)
  const [selfieLocalUri, setSelfieLocalUri] = useState<string | null>(null)
  const [selfieImageUrl, setSelfieImageUrl] = useState<string | null>(null)
  const [cardholderStatus, setCardholderStatus] = useState<string>('idle')
  const [cardholderStatusUpdatedAt, setCardholderStatusUpdatedAt] = useState<string | null>(null)
  const [existingCardholderId, setExistingCardholderId] = useState<string | null>(null)
  const [refreshingStatus, setRefreshingStatus] = useState(false)
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
    card_limit: '500000',
    card_pin: '',
    card_pin_confirm: '',
  })

  const profileRoot = useMemo(() => {
    if (typeof resolveUserProfile !== 'function') {
      if (__DEV__) {
        console.warn('[CreateCard] resolveUserProfile export missing; using empty profile fallback')
      }
      return {}
    }
    return resolveUserProfile(userProfileData) || {}
  }, [userProfileData])
  const bvnStatus = String(profileRoot?.user_kyc?.bvn_status || '').toLowerCase()
  const bvnVerified = bvnStatus === 'verified'
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

  const refreshCardholderState = async () => {
    try {
      const raw = await getUserCards()
      const payload = raw?.data ?? raw
      let card: any = null
      if (Array.isArray(payload)) card = payload[0] || null
      else if (payload?.card) card = payload.card
      else if (payload?.data) card = payload.data
      else if (payload?.card_id || payload?.cardholder_id || payload?.id) card = payload

      if (!card) {
        setCardholderStatus('idle')
        setCardholderStatusUpdatedAt(null)
        setExistingCardholderId(null)
        return
      }

      const meta = card?.meta_data || {}
      const kycStatus = String(meta?.cardholder_kyc_status || '').toLowerCase()
      const status = kycStatus || (card?.card_id ? 'verified' : 'idle')
      setCardholderStatus(status)
      setCardholderStatusUpdatedAt(
        String(meta?.cardholder_status_updated_at || card?.updated_at || '').trim() || null
      )
      setExistingCardholderId(String(card?.cardholder_id || '').trim() || null)
      const routeId = resolveCardRouteId(card)
      if (routeId) setCreatedCardId(routeId)
    } catch {
      // no-op
    }
  }

  const formatStatusTime = (value: string | null) => {
    if (!value) return null
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return null
    return dt.toLocaleString()
  }

  const handleRefreshStatus = async () => {
    if (refreshingStatus) return
    setRefreshingStatus(true)
    try {
      await refreshCardholderState()
    } finally {
      setRefreshingStatus(false)
    }
  }

  useEffect(() => {
    void refreshCardholderState()
  }, [])

  const chooseSelfie = async (fromCamera: boolean) => {
    setNotice(null)
    const permissionResult = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permissionResult.granted) {
      setNotice(fromCamera ? 'Camera permission is required.' : 'Photo library permission is required.')
      return
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.9,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          cameraType: ImagePicker.CameraType.front,
        })
      : await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          quality: 0.9,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        })

    if (result.canceled || !result.assets?.[0]?.uri) return
    setSelfieLocalUri(result.assets[0].uri)
    setSelfieImageUrl(null)
  }

  const ensureSelfieUrl = async () => {
    if (selfieImageUrl) return selfieImageUrl
    if (!selfieLocalUri) throw new Error('Capture or select a selfie image first.')

    setUploading(true)
    try {
      const secureUrl = await uploadSelfieToCloudinary(selfieLocalUri)
      setSelfieImageUrl(secureUrl)
      return secureUrl
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!hasKycAccess()) {
      setNotice('Complete KYC to create a card.')
      router.push('/kyc')
      return
    }
    if (!bvnVerified) {
      setNotice('Verify your BVN to create a card.')
      router.push('/kyc/bvn')
      return
    }
    setLoading(true)
    setNotice(null)
    const normalizedLimitInput = String(form.card_limit || '').replace(/[^0-9]/g, '')
    const normalizedCardLimit =
      normalizedLimitInput === '5000' || normalizedLimitInput === '500000'
        ? '500000'
        : normalizedLimitInput === '10000' || normalizedLimitInput === '1000000'
          ? '1000000'
          : ''

    if (!normalizedCardLimit) {
      setNotice('Card limit must be 5000 or 10000.')
      setLoading(false)
      return
    }

    const cardPin = String(form.card_pin || '').trim()
    const cardPinConfirm = String(form.card_pin_confirm || '').trim()
    if (!/^\d{4}$/.test(cardPin)) {
      setNotice('Card PIN is required and must be exactly 4 digits.')
      setLoading(false)
      return
    }
    if (cardPin !== cardPinConfirm) {
      setNotice('Card PIN confirmation does not match.')
      setLoading(false)
      return
    }

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

      // Step 1: ensure cardholder verification record exists (async)
      const normalizedStatus = String(cardholderStatus || '').toLowerCase()
      let cardholderId = existingCardholderId

      if (!['verified', 'pending_verification', 'manual_review'].includes(normalizedStatus)) {
        if (!bvnVerified) {
          setNotice('BVN must be verified before cardholder registration.')
          setLoading(false)
          return
        }

        const selfieUrl = await ensureSelfieUrl()
        const registerRes = await registerCardholder({
          ...payload,
          registration_mode: 'async',
          id_type: 'NIGERIAN_BVN_VERIFICATION',
          selfie_image: selfieUrl,
        })

        cardholderId =
          registerRes?.data?.cardholder_id ||
          registerRes?.data?.id ||
          registerRes?.cardholder_id ||
          registerRes?.id ||
          null

        await refreshCardholderState()
        setNotice(registerRes?.message || 'Cardholder submitted. Verification in progress.')
        setLoading(false)
        return
      }

      if (['pending_verification', 'manual_review'].includes(normalizedStatus)) {
        setNotice('Cardholder verification is still in progress. Refresh status and retry once verified.')
        setLoading(false)
        return
      }

      // Step 2: create card only when verified
      const cardRes = await createCard({
        cardholder_id: cardholderId || undefined,
        currency: form.currency || 'USD',
        wallet_type: 'usd',
        card_limit: normalizedCardLimit,
        card_pin: cardPin,
      })

      let cardId = resolveCardRouteId(cardRes)
      if (!cardId) {
        await refreshCardholderState()
        cardId = resolveCardRouteId((await getUserCards()) as any)
      }

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
            <FormInput
              label="Card Limit (5000 or 10000)"
              value={form.card_limit}
              keyboardType="number-pad"
              onChangeText={(value: string) => setForm({ ...form, card_limit: value.replace(/[^0-9]/g, '') })}
            />
            <FormInput
              label="Card PIN (4 digits)"
              value={form.card_pin}
              secureTextEntry
              keyboardType="number-pad"
              onChangeText={(value: string) => setForm({ ...form, card_pin: value.replace(/[^0-9]/g, '').slice(0, 4) })}
            />
            <FormInput
              label="Confirm Card PIN"
              value={form.card_pin_confirm}
              secureTextEntry
              keyboardType="number-pad"
              onChangeText={(value: string) => setForm({ ...form, card_pin_confirm: value.replace(/[^0-9]/g, '').slice(0, 4) })}
            />
            <View className="mt-3">
              <Text className="text-gray-300 text-xs mb-2">Selfie (required for cardholder verification)</Text>
              {selfieLocalUri ? (
                <Image source={{ uri: selfieLocalUri }} className="w-full h-40 rounded-xl mb-2" />
              ) : null}
              <View className="flex-row gap-2">
                <TouchableOpacity
                  disabled={loading || uploading}
                  onPress={() => chooseSelfie(true)}
                  className="bg-gray-800 py-3 rounded-xl flex-1"
                >
                  <Text className="text-white text-center">Capture Selfie</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={loading || uploading}
                  onPress={() => chooseSelfie(false)}
                  className="bg-gray-800 py-3 rounded-xl flex-1"
                >
                  <Text className="text-white text-center">Upload from Gallery</Text>
                </TouchableOpacity>
              </View>
              {selfieImageUrl ? (
                <Text className="text-emerald-400 text-xs mt-2">Selfie upload ready.</Text>
              ) : null}
            </View>
            <View className="mt-3">
              <Text className="text-gray-400 text-xs">
                Cardholder status: {cardholderStatus.replace('_', ' ') || 'idle'}
              </Text>
              {formatStatusTime(cardholderStatusUpdatedAt) ? (
                <Text className="text-gray-500 text-xs mt-1">
                  Last update: {formatStatusTime(cardholderStatusUpdatedAt)}
                </Text>
              ) : null}
              {['pending_verification', 'manual_review', 'failed'].includes(cardholderStatus) ? (
                <View className="mt-2 rounded-xl border border-sky-700/40 bg-sky-900/20 p-3">
                  <Text className="text-sky-100 text-xs font-semibold">
                    {cardholderStatus === 'failed'
                      ? 'Cardholder verification failed'
                      : 'Cardholder verification in progress'}
                  </Text>
                  <Text className="text-sky-200 text-[11px] mt-1">
                    {cardholderStatus === 'failed'
                      ? 'Re-submit cardholder details to continue.'
                      : 'Card creation unlocks automatically after provider confirmation webhook.'}
                  </Text>
                  <TouchableOpacity
                    disabled={refreshingStatus || loading}
                    onPress={handleRefreshStatus}
                    className="mt-2 border border-sky-400/50 rounded-lg py-2"
                  >
                    <Text className="text-sky-100 text-center text-xs font-semibold">
                      {refreshingStatus ? 'Refreshing...' : 'Refresh Verification Status'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>

          {notice ? <Text className="text-yellow-400 mt-2">{notice}</Text> : null}

          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-app-primary py-4 rounded-xl mt-6"
            disabled={loading || uploading}
          >
            {loading || uploading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-white text-center font-medium">
                {['pending_verification', 'manual_review'].includes(cardholderStatus)
                  ? 'Verification Pending'
                  : cardholderStatus === 'verified'
                    ? 'Create Card'
                    : 'Verify Cardholder'}
              </Text>
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
