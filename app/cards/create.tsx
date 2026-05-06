import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { getCardSetupQuote, getCardSetupStatus, getCards, setupCard } from '@/api/cards'
import { uploadSelfieToCloudinary } from '@/api/uploads'
import { useAuth } from '@/services/useAuth'
import { useActiveAccount } from '@/services/useActiveAccount'
import { resolveUserProfile } from '@/services/auth/resolveUserProfile'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { pickCardRouteId } from '@/utils/cardIdentifier'
import AppModal from '@/components/modal/Modal'
import { warn } from '@/utils/logger'

type CardRoutePayload = {
  data?: unknown
  card?: unknown
  card_id?: string | number | null
  cardholder_id?: string | number | null
  id?: string | number | null
}

type CreateCardApiError = {
  message?: string
  code?: string
  response?: { status?: number; data?: { message?: string } }
}

const resolveCardRouteId = (payload: unknown): string | null => {
  const root = payload?.data ?? payload
  if (Array.isArray(root)) {
    const first = root[0] || {}
    return pickCardRouteId(first) || null
  }
  if (!root || typeof root !== 'object') return null
  return pickCardRouteId(root) || null
}

const isLikelyNetworkCreateError = (error: CreateCardApiError | null | undefined) => {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()
  return (
    !error?.response ||
    code === 'ecconnaborted' ||
    message.includes('network error') ||
    message.includes('timeout')
  )
}

const isLikelyInFlightCreateError = (error: CreateCardApiError | null | undefined) => {
  const status = Number(error?.response?.status || 0)
  const message = String(error?.response?.data?.message || error?.message || '').toLowerCase()
  return (
    status === 503 ||
    status === 504 ||
    message.includes('application error') ||
    message.includes('service unavailable')
  )
}

const nextIdempotencyKey = () => `card-setup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const CARD_SETUP_FIELD_LABELS: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  phone_number: 'Phone number',
  address_line1: 'Address line 1',
  city: 'City',
  state: 'State',
  postal_code: 'Postal code',
  country: 'Country',
  selfie_image: 'Selfie',
}

const normalizeCountryName = (value: unknown) => {
  const raw = String(value || '').trim()
  if (!raw) return 'Nigeria'
  if (raw.toUpperCase() === 'NG') return 'Nigeria'
  return raw
}

const resolveMissingFieldLabels = (
  data: { missing_field_labels?: unknown[]; missing_fields?: unknown[] } | null | undefined
) => {
  if (Array.isArray(data?.missing_field_labels) && data.missing_field_labels.length) {
    return data.missing_field_labels.map((label) => String(label || '').trim()).filter(Boolean)
  }

  if (Array.isArray(data?.missing_fields) && data.missing_fields.length) {
    return data.missing_fields
      .map((field) => CARD_SETUP_FIELD_LABELS[String(field || '').trim()] || String(field || '').replace(/_/g, ' '))
      .filter(Boolean)
  }

  return []
}

const CreateCard = () => {
  const router = useRouter()
  const { userProfileData } = useAuth()
  const { activeAccount } = useActiveAccount()
  const isCircleAccount = activeAccount?.type === 'circle'
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createdCardId, setCreatedCardId] = useState<string | null>(null)
  const [selfieLocalUri, setSelfieLocalUri] = useState<string | null>(null)
  const [selfieImageUrl, setSelfieImageUrl] = useState<string | null>(null)
  const [cardholderStatus, setCardholderStatus] = useState<string>('idle')
  const [cardholderStatusUpdatedAt, setCardholderStatusUpdatedAt] = useState<string | null>(null)
  const [setupState, setSetupState] = useState<string>('loading')
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
    country: 'Nigeria',
    currency: 'USD',
    card_limit: '500000',
    card_pin: '',
    card_pin_confirm: '',
  })

  const profileRoot = useMemo(() => {
    if (typeof resolveUserProfile !== 'function') {
      warn('[CreateCard] resolveUserProfile export missing; using empty profile fallback')
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
    const country = normalizeCountryName(profileRoot?.country || 'Nigeria')

    return {
      first_name: first,
      last_name: last,
      email,
      phone_number: phone,
      address_line1: address,
      city,
      state,
      postal_code: postal,
      country: country || 'Nigeria',
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

  if (isCircleAccount) {
    return (
      <KeyboardAvoidWrapper>
        <View className="flex-1 bg-primary px-4 pt-10">
          <View className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-5">
            <Text className="text-white text-xl font-semibold">Card creation is unavailable in circle context</Text>
            <Text className="text-gray-300 text-sm mt-3">
              Virtual cards are tied to Tunnel funding and remain personal or business wallet features. Return to the selected circle to continue group activity.
            </Text>

            <TouchableOpacity
              onPress={() => router.replace(`/circles/${activeAccount.circleId}`)}
              className="bg-app-primary py-4 rounded-xl mt-5"
            >
              <Text className="text-white text-center font-medium">Open circle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push(`/circles/${activeAccount.circleId}/activities`)}
              className="border border-gray-700 py-4 rounded-xl mt-3"
            >
              <Text className="text-white text-center font-medium">View circle activity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidWrapper>
    )
  }

  const setupQuote = useMemo(() => getCardSetupQuote(form.card_limit), [form.card_limit])
  const cardholderReadyForCreate = ['ready_for_funding', 'active'].includes(setupState)
  const cardholderVerificationBlocked = ['cardholder_pending', 'provider_pending'].includes(setupState)
  const cardholderNeedsProfile = ['not_started', 'cardholder_failed', 'loading', 'needs_selfie_upload', 'cardholder_profile_incomplete'].includes(setupState)

  const hasKycAccess = () => {
    const kycLevel = profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level
    const phoneVerified = profileRoot?.phone_verified === true || profileRoot?.phone_verified_at
    if (!kycLevel && !phoneVerified) return false
    if (kycLevel && String(kycLevel).toLowerCase() === 'tier_0') return false
    return true
  }

  const refreshCardholderState = async () => {
    try {
      const setup = await getCardSetupStatus()
      const data = setup?.data || {}
      const state = String(setup?.state || '').toLowerCase()
      const providerStatus = String(data?.cardholder_status || '').toLowerCase()
      setSetupState(state || 'not_started')

      if (state === 'active' || String(data?.provider_card_id || '').trim()) setCardholderStatus('verified')
      else if (state === 'cardholder_failed') setCardholderStatus('failed')
      else if (state === 'cardholder_pending' || state === 'provider_pending') setCardholderStatus('pending_verification')
      else if (providerStatus) setCardholderStatus(providerStatus)
      else setCardholderStatus('idle')

      setCardholderStatusUpdatedAt(String(data?.updated_at || '').trim() || null)
      if (data?.card_id) setCreatedCardId(String(data.card_id))
      return
    } catch {
      // fallback to cards list for backward compatibility
    }

    try {
      const raw = await getCards(activeAccount)
      const payload = raw?.data ?? raw
      let card: CardRoutePayload | null = null
      if (Array.isArray(payload)) card = payload[0] || null
      else if (payload?.card) card = payload.card
      else if (payload?.data) card = payload.data
      else if (payload?.card_id || payload?.cardholder_id || payload?.id) card = payload

      if (!card) {
        setSetupState('not_started')
        setCardholderStatus('idle')
        setCardholderStatusUpdatedAt(null)
        return
      }

      const meta = card?.meta_data || {}
      const kycStatus = String(meta?.cardholder_kyc_status || '').toLowerCase()
      const status = kycStatus || (card?.card_id ? 'verified' : 'idle')
      const fallbackState =
        card?.card_id
          ? 'active'
          : kycStatus === 'verified'
            ? 'ready_for_funding'
            : kycStatus === 'failed'
              ? 'cardholder_failed'
              : ['pending_verification', 'manual_review'].includes(kycStatus)
                ? 'cardholder_pending'
                : 'not_started'
      setSetupState(fallbackState)
      setCardholderStatus(status)
      setCardholderStatusUpdatedAt(
        String(meta?.cardholder_status_updated_at || card?.updated_at || '').trim() || null
      )
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
        country: normalizeCountryName(form.country || profileDefaults.country || 'Nigeria'),
      }

      if (cardholderNeedsProfile) {
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
          .map(([key]) => CARD_SETUP_FIELD_LABELS[key] || key.replace('_', ' '))

        if (missing.length) {
          setNotice(`Complete profile fields: ${missing.join(', ')}`)
          setLoading(false)
          return
        }
      }
      let selfieImage: string | undefined
      if (cardholderNeedsProfile && (selfieLocalUri || selfieImageUrl)) {
        selfieImage = await ensureSelfieUrl()
      }

      const setupRes = await setupCard(
        {
          ...payload,
          registration_mode: 'async',
          id_type: 'NIGERIAN_BVN_VERIFICATION',
          selfie_image: selfieImage,
          wallet_type: 'usd',
          currency: form.currency || 'USD',
          card_limit: normalizedCardLimit,
          card_pin: cardPin,
          requested_funding_usd: setupQuote.minimumFundingUsd,
        },
        nextIdempotencyKey()
      )

      const setupState = String(setupRes?.state || '').toLowerCase()
      const setupData = setupRes?.data || {}

      if (setupState === 'needs_selfie_upload') {
        setNotice(setupRes?.message || 'Upload a selfie to continue card setup.')
        setLoading(false)
        return
      }

      if (setupState === 'cardholder_profile_incomplete') {
        const missingLabels = resolveMissingFieldLabels(setupData)
        setNotice(
          missingLabels.length
            ? `${setupRes?.message || 'Complete your profile details to continue card setup.'} Missing: ${missingLabels.join(', ')}`
            : (setupRes?.message || 'Complete your profile details to continue card setup.')
        )
        setLoading(false)
        return
      }

      if (setupState === 'cardholder_pending' || setupState === 'provider_pending') {
        await refreshCardholderState()
        setNotice(setupRes?.message || 'We are verifying your cardholder profile. Refresh status shortly.')
        setLoading(false)
        return
      }

      if (setupState === 'cardholder_failed') {
        await refreshCardholderState()
        setNotice(setupRes?.message || 'Cardholder verification failed. Update your details and retry.')
        setLoading(false)
        return
      }

      if (setupState === 'insufficient_balance') {
        const shortfall = Number(setupData?.shortfall_usd || 0)
        setNotice(`Insufficient Tunnel balance. Shortfall: $${shortfall.toFixed(2)}`)
        setLoading(false)
        return
      }

      if (setupState === 'active') {
        const cardId = String(setupData?.card_id || '').trim() || resolveCardRouteId(setupRes)
        setSuccess(setupRes?.message || 'Card created successfully.')
        if (cardId) setCreatedCardId(String(cardId))
        return
      }

      await refreshCardholderState()
      setNotice(setupRes?.message || 'Card setup submitted. Please refresh status shortly.')
      const cardId = String(setupData?.card_id || '').trim()
      if (cardId) setCreatedCardId(cardId)
    } catch (error: unknown) {
      if (isLikelyNetworkCreateError(error) || isLikelyInFlightCreateError(error)) {
        setNotice('We are confirming whether your card was created. Please wait and do not retry yet.')
        for (let attempt = 0; attempt < 6; attempt += 1) {
          try {
            await refreshCardholderState()

            const statusCheck = await getCardSetupStatus().catch(() => null)
            const statusState = String(statusCheck?.state || '').toLowerCase()
            const statusData = statusCheck?.data || {}
            const statusCardId = String(statusData?.card_id || '').trim()
            const providerCardId = String(statusData?.provider_card_id || '').trim()

            if (statusState === 'active' || providerCardId || statusCardId) {
              const resolvedCardId = statusCardId || resolveCardRouteId(statusCheck)
              if (resolvedCardId) setCreatedCardId(String(resolvedCardId))
              setSuccess('Card request completed successfully. We confirmed the result after a temporary provider delay.')
              setNotice(null)
              return
            }

            const existing = await getCards(activeAccount)
            const existingCardId = resolveCardRouteId(existing)
            if (existingCardId) {
              setCreatedCardId(String(existingCardId))
              setSuccess('Card request completed successfully. We confirmed the result after a temporary provider delay.')
              setNotice(null)
              return
            }
          } catch {
            // keep retrying briefly before surfacing fallback error
          }
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
      }

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
            {cardholderReadyForCreate
              ? 'Your cardholder profile is verified. Set your card PIN and create your card.'
              : cardholderVerificationBlocked
                ? 'Your cardholder verification is in progress. Refresh status when ready.'
                : 'Complete cardholder verification and create your card in one flow.'}
          </Text>

          <View className="mt-6">
            {setupState === 'loading' ? (
              <View className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4 mb-4">
                <Text className="text-white text-sm font-semibold">Checking card setup status...</Text>
                <Text className="text-gray-400 text-xs mt-1">
                  Please wait while we load your cardholder state.
                </Text>
              </View>
            ) : cardholderReadyForCreate ? (
              <View className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3 mb-4">
                <Text className="text-emerald-100 text-xs font-semibold">Cardholder verified</Text>
                <Text className="text-emerald-200 text-[11px] mt-1">
                  Identity details are already on file for this card. You only need to set your card options below.
                </Text>
                {formatStatusTime(cardholderStatusUpdatedAt) ? (
                  <Text className="text-emerald-200 text-[11px] mt-2">
                    Verified update: {formatStatusTime(cardholderStatusUpdatedAt)}
                  </Text>
                ) : null}
              </View>
            ) : cardholderNeedsProfile ? (
              <>
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
              </>
            ) : null}
            {cardholderVerificationBlocked ? (
              <View className="rounded-xl border border-sky-700/40 bg-sky-900/20 p-3 mb-4">
                <Text className="text-sky-100 text-xs font-semibold">Cardholder verification in progress</Text>
                <Text className="text-sky-200 text-[11px] mt-1">
                  Your identity has already been submitted. Refresh the status below before creating the card.
                </Text>
              </View>
            ) : null}
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
            {cardholderNeedsProfile ? (
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
            ) : null}
            <View className="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3">
              <Text className="text-emerald-100 text-xs font-semibold">Card setup summary</Text>
              <Text className="text-emerald-200 text-[11px] mt-1">
                Card limit: {setupQuote.normalizedLimit === '1000000' ? '$10,000' : '$5,000'}
              </Text>
              <Text className="text-emerald-200 text-[11px] mt-1">
                Minimum funding at creation: ${setupQuote.minimumFundingUsd.toFixed(2)}
              </Text>
              <Text className="text-emerald-200 text-[11px] mt-1">
                Card creation fee: ${setupQuote.creationFeeUsd.toFixed(2)}
              </Text>
              <Text className="text-emerald-100 text-[11px] mt-2 font-semibold">
                Required balance now: ${setupQuote.requiredTotalUsd.toFixed(2)}
              </Text>
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
              {cardholderVerificationBlocked || cardholderStatus === 'failed' ? (
                <View className="mt-2 rounded-xl border border-sky-700/40 bg-sky-900/20 p-3">
                  <Text className="text-sky-100 text-xs font-semibold">
                    {cardholderStatus === 'failed'
                      ? 'Cardholder verification failed'
                      : 'Cardholder verification in progress'}
                  </Text>
                  <Text className="text-sky-200 text-[11px] mt-1">
                    {cardholderStatus === 'failed'
                      ? 'Retry card creation after correcting the verification issue.'
                      : 'Your card request is still in verification. You do not need to restart from scratch.'}
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
            disabled={loading || uploading || setupState === 'loading' || cardholderVerificationBlocked}
          >
            {loading || uploading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-white text-center font-medium">
                {cardholderVerificationBlocked
                  ? 'Verification Pending'
                  : cardholderReadyForCreate
                    ? 'Create Card'
                    : 'Verify and Create Card'}
              </Text>
            )}
          </TouchableOpacity>
          {loading ? (
            <Text className="text-sky-300 text-xs mt-2">
              Finalizing card request. Please wait...
            </Text>
          ) : null}
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


