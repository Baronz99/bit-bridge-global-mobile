import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import NotificationAlert from '@/components/notification'
import DepositAccountSection from '@/components/DepositAccountSection'
import AnchorAccountView from '@/components/AnchorAccountView'
import { createAnchorAccount, createDepositAccount, verifyKyc } from '@/api/account'
import { useAnchorOnboarding, normalizeAnchorOnboarding } from '@/services/useAnchorOnboarding'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { resolveUserProfile, useAuth } from '@/services/useAuth'
import { isKycAlreadyCompleted } from '@/utils/anchorAccount'

const AnchorAccountScreen = () => {
  const params = useLocalSearchParams()
  const router = useRouter()
  const { onLogout, userProfileData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string | null; error: boolean }>({
    message: null,
    error: false,
  })
  const [kycOverrideVerified, setKycOverrideVerified] = useState(false)
  const [kycOverridePending, setKycOverridePending] = useState(false)
  const anchorState = useAnchorOnboarding({ autoFetchOnMount: true, autoFetchOnFocus: false })
  const refreshHandledRef = useRef(false)
  const [anchorForm, setAnchorForm] = useState({
    address: '',
    city: '',
    state: '',
    postal_code: '',
    bvn: '',
    dob: '',
    gender: '',
  })

  const profile = useMemo(() => resolveUserProfile(userProfileData), [userProfileData])

  const profileRoot = userProfileData?.data ?? userProfileData ?? {}
  const kycLevel = String(profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level || 'tier_0')
    .trim()
    .toLowerCase()
  const platformTier2 = kycLevel === 'tier_2' || kycLevel === 'tier2' || kycLevel === 'tier_3' || kycLevel === 'tier3'

  const normalizePhone = (value?: string | null) => {
    const raw = String(value || '').trim()
    if (!raw) return ''
    if (raw.startsWith('+')) return raw.replace(/\s+/g, '')
    if (raw.startsWith('234')) return raw.replace(/\s+/g, '')
    if (raw.startsWith('0') && raw.length >= 11) return `234${raw.slice(1)}`
    return raw.replace(/\s+/g, '')
  }

  const prefilledDob = profile?.dob || profile?.date_of_birth
  const prefilledGender = profile?.gender
  const prefilledAddress = profile?.address_line1
  const prefilledCity = profile?.city
  const prefilledState = profile?.state
  const prefilledPostal = profile?.postal_code
  const prefilledFirstName = profile?.first_name
  const prefilledLastName = profile?.last_name
  const prefilledEmail = profile?.email || profileRoot?.email
  const prefilledPhone = normalizePhone(
    profile?.phone_number || profileRoot?.phone_number || profileRoot?.phone_e164 || profileRoot?.phone
  )

  useEffect(() => {
    setAnchorForm((prev) => ({
      ...prev,
      dob: prefilledDob || prev.dob,
      gender: prefilledGender || prev.gender,
      address: prefilledAddress || prev.address,
      city: prefilledCity || prev.city,
      state: prefilledState || prev.state,
      postal_code: prefilledPostal || prev.postal_code,
    }))
  }, [prefilledDob, prefilledGender, prefilledAddress, prefilledCity, prefilledState, prefilledPostal])

  const normalized = useMemo(
    () => normalizeAnchorOnboarding(anchorState.detailResponse, anchorState.userAccountsResponse),
    [anchorState.detailResponse, anchorState.userAccountsResponse]
  )
  const effectiveNormalized = useMemo(() => {
    if (!kycOverrideVerified && !kycOverridePending) return normalized
    const hasAccountNumber = normalized.hasAccountNumber
    if (kycOverrideVerified) {
      return {
        ...normalized,
        kycState: 'verified',
        depositReady: hasAccountNumber,
        nextStep: hasAccountNumber ? 'DONE' : 'GENERATE_NUMBER',
      }
    }
    return {
      ...normalized,
      kycState: 'pending',
      depositReady: false,
      nextStep: hasAccountNumber ? 'DONE' : 'GENERATE_NUMBER',
    }
  }, [normalized, kycOverrideVerified, kycOverridePending])

  const handleRefresh = useCallback(async () => {
    try {
      await anchorState.refresh({ force: true })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout().catch(() => {})
        return
      }
    }
  }, [anchorState, onLogout])

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

  const ensureAnchorAccount = async () => {
    if (!platformTier2) {
      setNotice({ message: 'Complete Tier 2 verification to create a deposit account.', error: true })
      return
    }
    if (normalized.hasAnchorAccount) {
      setNotice({ message: 'Deposit account already exists.', error: false })
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

    setLoading(true)
    setNotice({ message: null, error: false })
    let shouldRefresh = true
    let didLogout = false
    try {
      const response = await createAnchorAccount({
        account: {
          address: anchorForm.address,
          city: anchorForm.city,
          state: anchorForm.state,
          postal_code: anchorForm.postal_code,
          bvn: anchorForm.bvn,
          dob: anchorForm.dob,
          gender: anchorForm.gender,
          first_name: prefilledFirstName,
          last_name: prefilledLastName,
          phone_number: prefilledPhone,
          email: prefilledEmail,
        },
      })
      setNotice({ message: response?.message || 'Deposit account created.', error: false })
      await anchorState.refresh({ force: true })
      shouldRefresh = false
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status
      const data = error?.response?.data ?? error
      if (status === 409) {
        await anchorState.refresh({ force: true })
        shouldRefresh = false
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

  const ensureAccountNumber = async () => {
    if (!effectiveNormalized.hasAnchorAccount) return
    if (effectiveNormalized.hasAccountNumber) {
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
        ? normalizeAnchorOnboarding(refreshed.detailResponse, refreshed.userAccountsResponse)
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
      if (status === 401) {
        didLogout = true
        await onLogout().catch(() => {})
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
    setLoading(true)
    setNotice({ message: null, error: false })
    try {
      const response = await verifyKyc({
        bvn: anchorForm.bvn.trim(),
        dob: anchorForm.dob.trim(),
        gender: anchorForm.gender.trim() || undefined,
      })
      setKycOverrideVerified(true)
      setNotice({ message: response?.message || 'Verified successfully.', error: false })
      await anchorState.refresh({ force: true })
    } catch (error: any) {
      const status = error?.response?.status
      const messageText = String(
        error?.response?.data?.message || error?.message || ''
      ).toLowerCase()
      if (status === 401) {
        await onLogout().catch(() => {})
        return
      }
      if (status === 422 && messageText.includes('already completed')) {
        setKycOverrideVerified(true)
        setKycOverridePending(false)
        await anchorState.refresh({ force: true })
        setNotice({ message: 'Already verified.', error: false })
        await ensureAccountNumber()
        return
      }
      if (isKycAlreadyCompleted(error)) {
        setKycOverrideVerified(true)
        setKycOverridePending(false)
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
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
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

        {effectiveNormalized.depositReady ? (
          <AnchorAccountView
            statusLabel="Deposit account ready"
            helperText="Primary currency: NGN"
            displayAccountNumber={effectiveNormalized.displayAccountNumber || null}
            rawAccountNumber={effectiveNormalized.rawAccountNumber || null}
            accountName={effectiveNormalized.accountName || null}
            bankName={effectiveNormalized.bankName || null}
          />
        ) : (
          <DepositAccountSection
            normalized={effectiveNormalized}
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
          />
        )}
      </ScrollView>
    </View>
  )
}

export default AnchorAccountScreen
