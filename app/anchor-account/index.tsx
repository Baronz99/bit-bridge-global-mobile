import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import NotificationAlert from '@/components/notification'
import DepositAccountSection from '@/components/DepositAccountSection'
import AnchorAccountView from '@/components/AnchorAccountView'
import { setupAnchorOnboarding } from '@/api/account'
import {
  useAnchorOnboarding,
  normalizeAnchorOnboarding,
} from '@/services/useAnchorOnboarding'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useAuth } from '@/services/useAuth'
import { resolveUserProfile } from '@/services/auth/resolveUserProfile'
import { warn } from '@/utils/logger'
import { resolveAnchorPrefill } from '@/utils/anchorOnboardingPrefill'
import {
  isValidNgPhone,
} from '@/utils/phone'

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
  const platformTier2 = kycLevel === 'tier_2' || kycLevel === 'tier2' || kycLevel === 'tier_3' || kycLevel === 'tier3'

  const isValidEmail = (value?: string | null) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

  const anchorPrefill = useMemo(
    () => resolveAnchorPrefill(profile, profileRoot),
    [profile, profileRoot]
  )
  const prefilledFirstName = anchorPrefill.firstName
  const prefilledLastName = anchorPrefill.lastName
  const prefilledEmail = anchorPrefill.email
  const prefilledPhone = anchorPrefill.phone

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
    if (normalized.depositReady) {
      setNotice({ message: 'Account number already generated.', error: false })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false })
    let shouldRefresh = true
    let didLogout = false
    try {
      await setupAnchorOnboarding({ account: {} })
      const refreshed = await anchorState.refresh({ force: true })
      shouldRefresh = false
      const refreshedNormalized = refreshed
        ? normalizeAnchorOnboarding(
            refreshed.detailResponse,
            refreshed.userAccountsResponse,
            refreshed.onboardingResponse
          )
        : null
      if (refreshedNormalized?.depositReady || refreshedNormalized?.hasAccountNumber) {
        setNotice({ message: 'Account number generated.', error: false })
      } else {
        setNotice({
          message: 'Your account setup is in progress. This may take a moment.',
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
      if (
        errorCode === 'ANCHOR_ONBOARDING_INCOMPLETE' ||
        flowState === 'blocked_profile_incomplete' ||
        (status === 422 && Array.isArray(error?.missing_fields))
      ) {
        const missingFields = Array.isArray(error?.missing_fields) ? error.missing_fields.join(', ') : null
        setNotice({
          message: missingFields
            ? `Complete your profile: ${missingFields}`
            : (error?.message || 'Complete your profile to continue.'),
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
            onGenerateAccount={ensureAccountNumber}
            onRefresh={handleRefresh}
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
