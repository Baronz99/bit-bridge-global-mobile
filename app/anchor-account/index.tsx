import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import NotificationAlert from '@/components/notification'
import DepositAccountSection from '@/components/DepositAccountSection'
import AnchorAccountView from '@/components/AnchorAccountView'
import { createAnchorAccount, createDepositAccount, verifyKyc } from '@/api/account'
import {
  useAnchorOnboarding,
  normalizeAnchorOnboarding,
} from '@/services/useAnchorOnboarding'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useAuth } from '@/services/useAuth'
import { resolveUserProfile } from '@/services/auth/resolveUserProfile'
import { isKycAlreadyCompleted } from '@/utils/anchorAccount'
import { warn } from '@/utils/logger'
import { resolveAnchorPrefill } from '@/utils/anchorOnboardingPrefill'
import {
  isValidNgPhone,
  normalizeNgPhoneForApi,
} from '@/utils/phone'

const ANCHOR_FORM_DRAFT_KEY = 'anchor_account_form_draft_v1'

const AnchorAccountScreen = () => {
  const params = useLocalSearchParams()
  const router = useRouter()
  const { onLogout, userProfileData, loadProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string | null; error: boolean }>({
    message: null,
    error: false,
  })
  const anchorState = useAnchorOnboarding({ autoFetchOnMount: true, autoFetchOnFocus: false })
  const refreshHandledRef = useRef(false)
  const scrollRef = useRef<ScrollView | null>(null)
  const [anchorForm, setAnchorForm] = useState({
    address: '',
    city: '',
    state: '',
    postal_code: '',
    bvn: '',
    dob: '',
    gender: '',
  })

  useEffect(() => {
    let isMounted = true
    const loadDraft = async () => {
      try {
        const raw = await SecureStore.getItemAsync(ANCHOR_FORM_DRAFT_KEY)
        if (!raw || !isMounted) return
        const parsed = JSON.parse(raw)
        setAnchorForm((prev) => ({
          ...prev,
          address: String(parsed?.address || prev.address || ''),
          city: String(parsed?.city || prev.city || ''),
          state: String(parsed?.state || prev.state || ''),
          postal_code: String(parsed?.postal_code || prev.postal_code || ''),
          dob: String(parsed?.dob || prev.dob || ''),
          gender: String(parsed?.gender || prev.gender || ''),
        }))
      } catch {
        // Ignore corrupt draft state.
      }
    }
    void loadDraft()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const draft = {
      address: anchorForm.address,
      city: anchorForm.city,
      state: anchorForm.state,
      postal_code: anchorForm.postal_code,
      dob: anchorForm.dob,
      gender: anchorForm.gender,
    }
    void SecureStore.setItemAsync(ANCHOR_FORM_DRAFT_KEY, JSON.stringify(draft)).catch(() => {})
  }, [anchorForm])

  useEffect(() => {
    void loadProfile({ force: true }).catch(() => {})
  }, [loadProfile])

  const profile = useMemo(() => {
    if (typeof resolveUserProfile !== 'function') {
      warn('[AnchorAccount] resolveUserProfile export missing; using empty profile fallback')
      return {}
    }
    return resolveUserProfile(userProfileData)
  }, [userProfileData])

  const profileRoot = userProfileData?.data ?? userProfileData ?? {}
  const kycLevel = String(profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level || 'tier_0')
    .trim()
    .toLowerCase()
  const platformTier2 =
    kycLevel === 'tier_2' ||
    kycLevel === 'tier2' ||
    kycLevel === 'tier_3' ||
    kycLevel === 'tier3' ||
    kycLevel === 'tier_4' ||
    kycLevel === 'tier4'

  const isValidBvn = (value?: string | null) => /^\d{11}$/.test(String(value || '').trim())
  const isValidDob = (value?: string | null) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
  const isValidEmail = (value?: string | null) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

  const anchorPrefill = useMemo(
    () => resolveAnchorPrefill(profile, profileRoot),
    [profile, profileRoot]
  )
  const prefilledDob = anchorPrefill.dob
  const prefilledGender = anchorPrefill.gender
  const prefilledAddress = anchorPrefill.address
  const prefilledCity = anchorPrefill.city
  const prefilledState = anchorPrefill.state
  const prefilledPostal = anchorPrefill.postalCode
  const prefilledFirstName = anchorPrefill.firstName
  const prefilledLastName = anchorPrefill.lastName
  const prefilledEmail = anchorPrefill.email
  const prefilledPhone = anchorPrefill.phone

  useEffect(() => {
    setAnchorForm((prev) => ({
      ...prev,
      dob: prefilledDob || prev.dob,
      gender: prefilledGender || prev.gender,
      address: prefilledAddress || prev.address,
      city: prefilledCity || prev.city,
      state: prefilledState || prev.state,
      postal_code: prefilledPostal || prev.postal_code,
      bvn: anchorPrefill.bvn || prev.bvn,
    }))
  }, [prefilledDob, prefilledGender, prefilledAddress, prefilledCity, prefilledState, prefilledPostal, anchorPrefill.bvn])

  const normalized = useMemo(
    () =>
      normalizeAnchorOnboarding(
        anchorState.detailResponse,
        anchorState.userAccountsResponse,
        anchorState.onboardingResponse
      ),
    [anchorState.onboardingResponse, anchorState.detailResponse, anchorState.userAccountsResponse]
  )

  const handleRefresh = useCallback(async () => {
    try {
      await loadProfile({ force: true }).catch(() => {})
      await anchorState.refresh({ force: true })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout().catch(() => {})
        return
      }
    }
  }, [anchorState.refresh, loadProfile, onLogout])

  useFocusEffect(
    useCallback(() => {
      handleRefresh().catch(() => {})
    }, [handleRefresh])
  )

  useEffect(() => {
    if (anchorState.error?.response?.status === 401) {
      onLogout().catch(() => {})
    }
  }, [anchorState.error, onLogout])

  useEffect(() => {
    if (params?.refresh === '1' && !refreshHandledRef.current) {
      refreshHandledRef.current = true
      handleRefresh().catch(() => {})
    }
  }, [params?.refresh, handleRefresh])

  const createProfileBlockReason = useMemo(() => {
    if (!platformTier2) return 'Complete Tier 2 verification before creating a deposit profile.'
    if (normalized.hasAnchorAccount) return null

    const missing: string[] = []
    if (!String(prefilledFirstName || '').trim()) missing.push('first name')
    if (!String(prefilledLastName || '').trim()) missing.push('last name')
    if (!isValidEmail(prefilledEmail)) missing.push('valid email')
    if (!isValidNgPhone(prefilledPhone)) missing.push('phone number')

    return missing.length ? `Update your profile first: ${missing.join(', ')}.` : null
  }, [platformTier2, normalized.hasAnchorAccount, prefilledFirstName, prefilledLastName, prefilledEmail, prefilledPhone])

  useEffect(() => {
    if (!notice.message) return
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [notice.message])

  const ensureAnchorAccount = async () => {
    if (!platformTier2) {
      setNotice({ message: 'Complete Tier 2 verification to create a deposit account.', error: true })
      return
    }
    if (normalized.hasAnchorAccount) {
      setNotice({ message: 'Deposit account already exists.', error: false })
      return
    }
    const trimmedPhone = String(prefilledPhone || '').trim()
    const phoneForApi = normalizeNgPhoneForApi(trimmedPhone)
    const trimmedFirstName = String(prefilledFirstName || '').trim()
    const trimmedLastName = String(prefilledLastName || '').trim()
    const trimmedEmail = String(prefilledEmail || '').trim()

    if (!trimmedPhone) {
      setNotice({
        message: 'Phone number is required. Update your phone in profile, then retry.',
        error: true,
      })
      return
    }
    if (!isValidNgPhone(trimmedPhone)) {
      setNotice({
        message:
          'Phone number must be in Nigerian E.164 format (+2348012345678). Update your profile phone and retry.',
        error: true,
      })
      return
    }
    if (!trimmedFirstName || !trimmedLastName) {
      setNotice({
        message: 'First name and last name are required. Update your profile and retry.',
        error: true,
      })
      return
    }
    if (!isValidEmail(trimmedEmail)) {
      setNotice({
        message: 'A valid email is required. Update your profile and retry.',
        error: true,
      })
      return
    }
    const missing: string[] = []
    if (!anchorForm.address.trim()) missing.push('address')
    if (!anchorForm.city.trim()) missing.push('city')
    if (!anchorForm.state.trim()) missing.push('state')
    if (!anchorForm.postal_code.trim()) missing.push('postal_code')
    if (!anchorForm.bvn.trim()) missing.push('bvn')
    if (!anchorForm.dob.trim()) missing.push('dob')
    if (missing.length > 0) {
      setNotice({
        message: `Complete your profile: ${missing.join(', ')}`,
        error: true,
      })
      return
    }
    if (!isValidBvn(anchorForm.bvn)) {
      setNotice({ message: 'BVN must be exactly 11 digits.', error: true })
      return
    }
    if (!isValidDob(anchorForm.dob)) {
      setNotice({ message: 'Date of birth must be in YYYY-MM-DD format.', error: true })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false })
    let shouldRefresh = true
    let didLogout = false
    try {
      const response = await createAnchorAccount({
        account: {
          address: anchorForm.address.trim(),
          city: anchorForm.city.trim(),
          state: anchorForm.state.trim(),
          postal_code: anchorForm.postal_code.trim(),
          bvn: anchorForm.bvn.trim(),
          dob: anchorForm.dob.trim(),
          gender: anchorForm.gender.trim() || undefined,
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          phone_number: phoneForApi || trimmedPhone,
          email: trimmedEmail,
        },
      })
      setNotice({ message: response?.message || 'Deposit account created.', error: false })
      await SecureStore.deleteItemAsync(ANCHOR_FORM_DRAFT_KEY).catch(() => {})
      await anchorState.refresh({ force: true })
      shouldRefresh = false
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status
      const data = error?.response?.data ?? error
      const errorCode = String(data?.error_code || data?.error || '').trim()
      const flowState = String(data?.flow?.state || data?.meta?.flow?.state || '').trim()
      if (status === 409) {
        setNotice({
          message:
            data?.message ||
            'This phone number already exists on Anchor. Please contact support or refresh.',
          error: true,
        })
        await anchorState.refresh({ force: true })
        shouldRefresh = false
        return
      }
      if (errorCode === 'ANCHOR_ONBOARDING_INCOMPLETE' || flowState === 'blocked_profile_incomplete') {
        setNotice({
          message: Array.isArray(data?.missing_fields)
            ? `Complete your profile: ${data.missing_fields.join(', ')}`
            : data?.message || 'Complete your profile before continuing.',
          error: true,
        })
        return
      }
      if (errorCode === 'ANCHOR_PHONE_EXISTS' || flowState === 'blocked_phone_exists') {
        setNotice({
          message:
            data?.message ||
            'This phone number already exists on Anchor. Update phone in profile or contact support.',
          error: true,
        })
        return
      }
      if (errorCode === 'kyc_required' || data?.error === 'kyc_required' || flowState === 'blocked_kyc') {
        setNotice({
          message: data?.message || 'Complete Tier 2 verification first.',
          error: true,
        })
        return
      }
      if (status === 422 && Array.isArray(data?.missing_fields)) {
        setNotice({
          message: `Complete your profile: ${data.missing_fields.join(', ')}`,
          error: true,
        })
        return
      }
      if (status === 422 && !Array.isArray(data?.missing_fields)) {
        const backendMessage = String(data?.message || '').trim()
        if (backendMessage) {
          setNotice({ message: backendMessage, error: true })
          return
        }
        setNotice({
          message:
            'We could not verify your phone with Anchor. Please confirm your phone number in profile (E.164 format, e.g. 2348012345678) and try again.',
          error: true,
        })
        return
      }
      if (status === 401) {
        didLogout = true
        await onLogout().catch(() => {})
        return
      }
      const message = buildApiErrorMessage({
        status,
        data,
        fallback: 'Something went wrong',
      })
      setNotice({ message, error: true })
    } finally {
      setLoading(false)
      if (!didLogout && shouldRefresh) {
        await anchorState.refresh()
      }
    }
  }

  const profileUpdatedAt = useMemo(() => {
    const raw = profile?.updated_at || profileRoot?.updated_at
    if (!raw) return null
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }, [profile?.updated_at, profileRoot?.updated_at])

  const profileFreshnessLabel = useMemo(() => {
    if (!profileUpdatedAt) return null
    const minutes = Math.max(0, Math.floor((Date.now() - profileUpdatedAt.getTime()) / 60000))
    if (minutes < 1) return 'Using profile data updated just now'
    if (minutes === 1) return 'Using profile data updated 1 min ago'
    if (minutes < 60) return `Using profile data updated ${minutes} mins ago`
    const hours = Math.floor(minutes / 60)
    if (hours === 1) return 'Using profile data updated 1 hour ago'
    return `Using profile data updated ${hours} hours ago`
  }, [profileUpdatedAt])

  const ensureAccountNumber = async () => {
    if (!normalized.hasAnchorAccount) return
    if (normalized.hasAccountNumber) {
      setNotice({ message: 'Account number already generated.', error: false })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false })
    let shouldRefresh = true
    let didLogout = false
    try {
      await createDepositAccount()
      const refreshed = await anchorState.refresh({ force: true })
      shouldRefresh = false
      const refreshedNormalized = refreshed
        ? normalizeAnchorOnboarding(
            refreshed.detailResponse,
            refreshed.userAccountsResponse,
            refreshed.onboardingResponse
          )
        : null
      if (refreshedNormalized?.hasAccountNumber) {
        setNotice({ message: 'Account number generated.', error: false })
      } else {
        setNotice({
          message: 'Your virtual account is being set up. This may take a moment.',
          error: false,
        })
      }
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status
      const errorCode = String(error?.error_code || error?.error || '').trim()
      const flowState = String(error?.flow?.state || error?.meta?.flow?.state || '').trim()
      if (status === 401) {
        didLogout = true
        await onLogout().catch(() => {})
        return
      }
      if (errorCode === 'kyc_required' || flowState === 'blocked_kyc') {
        setNotice({ message: error?.message || 'Complete Tier 2 verification first.', error: true })
        return
      }
      if (errorCode === 'anchor_phone_already_exists' || flowState === 'blocked_phone_exists') {
        setNotice({
          message:
            error?.message ||
            'Phone is already attached at provider. Refresh status or contact support.',
          error: true,
        })
        return
      }
      const retryable =
        error?.response?.data?.meta?.retryable === true || error?.meta?.retryable === true
      const fallbackMessage = retryable
        ? 'Anchor is temporarily unavailable. Please retry in a moment.'
        : error?.message || 'Unable to generate account number'
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data || error,
        fallback: fallbackMessage,
      })
      setNotice({ message, error: true })
    } finally {
      setLoading(false)
      if (!didLogout && shouldRefresh) {
        await anchorState.refresh()
      }
    }
  }

  const handleKycSubmit = async () => {
    if (!anchorForm.bvn.trim() || !anchorForm.dob.trim()) {
      setNotice({ message: 'BVN and date of birth are required.', error: true })
      return
    }
    if (!anchorForm.gender.trim()) {
      setNotice({ message: 'Gender is required.', error: true })
      return
    }
    if (!isValidBvn(anchorForm.bvn)) {
      setNotice({ message: 'BVN must be exactly 11 digits.', error: true })
      return
    }
    if (!isValidDob(anchorForm.dob)) {
      setNotice({ message: 'Date of birth must be in YYYY-MM-DD format.', error: true })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false })
    try {
      const response = await verifyKyc({
        bvn: anchorForm.bvn.trim(),
        dob: anchorForm.dob.trim(),
        gender: anchorForm.gender.trim() || undefined,
      })
      setNotice({ message: response?.message || 'Verified successfully.', error: false })
      await anchorState.refresh({ force: true })
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status
      const messageText = String(
        error?.response?.data?.message || error?.message || ''
      ).toLowerCase()
      if (status === 401) {
        await onLogout().catch(() => {})
        return
      }
      if (status === 422 && messageText.includes('already completed')) {
        await anchorState.refresh({ force: true })
        setNotice({ message: 'Already verified.', error: false })
        await ensureAccountNumber()
        return
      }
      if (status === 422 && Array.isArray(error?.details?.missing_fields)) {
        setNotice({
          message: `Complete KYC fields: ${error.details.missing_fields.join(', ')}`,
          error: true,
        })
        return
      }
      if (status === 422 && Array.isArray(error?.response?.data?.details?.missing_fields)) {
        setNotice({
          message: `Complete KYC fields: ${error.response.data.details.missing_fields.join(', ')}`,
          error: true,
        })
        return
      }
      if (isKycAlreadyCompleted(error)) {
        await anchorState.refresh({ force: true })
        setNotice({ message: 'Already verified.', error: false })
        await ensureAccountNumber()
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to verify KYC',
      })
      setNotice({ message, error: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white/70 text-xs tracking-widest uppercase">Deposit account</Text>
          <Text className="text-white text-2xl font-semibold mt-2">Deposit account</Text>
          {normalized.depositReady ? (
            <Text className="text-gray-400 mt-2 text-sm">Account details (NGN)</Text>
          ) : (
            <Text className="text-gray-400 mt-2 text-sm">
              Complete the steps below to enable NGN deposits.
            </Text>
          )}
          {profileFreshnessLabel ? (
            <Text className="text-gray-500 mt-2 text-xs">{profileFreshnessLabel}</Text>
          ) : null}
        </View>

        {loading || anchorState.loading ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : null}

        {notice.message ? (
          <View className="mt-4">
            <NotificationAlert message={notice.message} error={notice.error} data={null} />
          </View>
        ) : null}

        {normalized.depositReady ? (
          <AnchorAccountView
            statusLabel="Deposit account ready"
            displayAccountNumber={normalized.displayAccountNumber || null}
            rawAccountNumber={normalized.rawAccountNumber || null}
            accountName={normalized.accountName || null}
            bankName={normalized.bankName || null}
          />
        ) : (
          <DepositAccountSection
            normalized={normalized}
            loading={loading}
            onCreateAnchor={ensureAnchorAccount}
            onVerifyKyc={handleKycSubmit}
            onGenerateAccount={ensureAccountNumber}
            onRefresh={handleRefresh}
            anchorForm={anchorForm}
            setAnchorForm={setAnchorForm}
            prefilledDob={prefilledDob}
            prefilledGender={prefilledGender}
            prefilledAddress={prefilledAddress}
            prefilledCity={prefilledCity}
            prefilledState={prefilledState}
            prefilledPostal={prefilledPostal}
            platformTier2={platformTier2}
            onGoToKyc={() => router.push('/kyc')}
            prefilledPhone={prefilledPhone}
            onGoToProfile={() => router.push('/accountProfile')}
            actionBlockReason={createProfileBlockReason}
          />
        )}
      </ScrollView>
    </View>
  )
}

export default AnchorAccountScreen
