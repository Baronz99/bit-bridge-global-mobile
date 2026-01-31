import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import NotificationAlert from '@/components/notification'
import DepositAccountSection from '@/components/DepositAccountSection'
import AnchorAccountView from '@/components/AnchorAccountView'
import { createAnchorAccount, createDepositAccount, verifyKyc } from '@/api/account'
import { useAnchorOnboarding, normalizeAnchorOnboarding } from '@/services/useAnchorOnboarding'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useAuth } from '@/services/useAuth'
import { isKycAlreadyCompleted } from '@/utils/anchorAccount'

const AnchorAccountScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { onLogout, userProfileData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string | null; error: boolean }>({
    message: null,
    error: false,
  })
  const anchorState = useAnchorOnboarding({ autoFetchOnMount: true, autoFetchOnFocus: false })
  const refreshHandledRef = useRef(false)
  const [kycForm, setKycForm] = useState({ bvn: '', dob: '', gender: '' })

  const profile = useMemo(() => {
    const payload = (userProfileData as any)?.data ?? userProfileData ?? {}
    return payload.user_profile || payload.userProfile || payload
  }, [userProfileData])

  const prefilledDob = profile?.dob || profile?.date_of_birth
  const prefilledGender = profile?.gender

  useEffect(() => {
    setKycForm((prev) => ({
      ...prev,
      dob: prefilledDob || prev.dob,
      gender: prefilledGender || prev.gender,
    }))
  }, [prefilledDob, prefilledGender])

  const normalized = useMemo(
    () => normalizeAnchorOnboarding(anchorState.detailResponse, anchorState.userAccountsResponse),
    [anchorState.detailResponse, anchorState.userAccountsResponse]
  )

  const handleRefresh = useCallback(async () => {
    try {
      await anchorState.refresh({ force: true })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout()
        router.replace('/login')
      }
    }
  }, [anchorState, onLogout, router])

  useEffect(() => {
    if (anchorState.error?.response?.status === 401) {
      onLogout().then(() => router.replace('/login')).catch(() => {})
    }
  }, [anchorState.error, onLogout, router])

  useEffect(() => {
    if (params?.refresh === '1' && !refreshHandledRef.current) {
      refreshHandledRef.current = true
      handleRefresh().catch(() => {})
    }
  }, [params?.refresh, handleRefresh])

  const ensureAnchorAccount = async () => {
    if (normalized.hasAnchorAccount) {
      setNotice({ message: 'Anchor account already exists.', error: false })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false })
    let shouldRefresh = true
    try {
      const response = await createAnchorAccount()
      setNotice({ message: response?.message || 'Anchor account created.', error: false })
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
      if (status === 401) {
        await onLogout()
        router.replace('/login')
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
      if (shouldRefresh) {
        await anchorState.refresh()
      }
    }
  }

  const ensureAccountNumber = async () => {
    if (!normalized.hasAnchorAccount) return
    if (normalized.hasAccountNumber) {
      setNotice({ message: 'Account number already generated.', error: false })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false })
    let shouldRefresh = true
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
      const status = error?.response?.status
      if (status === 401) {
        await onLogout()
        router.replace('/login')
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to generate account number',
      })
      setNotice({ message, error: true })
    } finally {
      setLoading(false)
      if (shouldRefresh) {
        await anchorState.refresh()
      }
    }
  }

  const handleKycSubmit = async () => {
    if (!kycForm.bvn.trim() || !kycForm.dob.trim()) {
      setNotice({ message: 'BVN and date of birth are required.', error: true })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false })
    try {
      const response = await verifyKyc({
        bvn: kycForm.bvn.trim(),
        dob: kycForm.dob.trim(),
        gender: kycForm.gender.trim() || undefined,
      })
      setNotice({ message: response?.message || 'Verified successfully.', error: false })
      await anchorState.refresh({ force: true })
    } catch (error: any) {
      const status = error?.response?.status
      const messageText = String(
        error?.response?.data?.message || error?.message || ''
      ).toLowerCase()
      if (status === 401) {
        await onLogout()
        router.replace('/login')
        return
      }
      if (status === 422 && messageText.includes('already completed')) {
        await anchorState.refresh({ force: true })
        setNotice({ message: 'Already verified.', error: false })
        return
      }
      if (isKycAlreadyCompleted(error)) {
        await anchorState.refresh({ force: true })
        setNotice({ message: 'Already verified.', error: false })
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
          <Text className="text-white text-2xl font-semibold mt-2">Anchor</Text>
          {normalized.depositReady ? (
            <Text className="text-gray-400 mt-2 text-sm">Account details</Text>
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
            kycForm={kycForm}
            setKycForm={setKycForm}
            prefilledDob={prefilledDob}
            prefilledGender={prefilledGender}
          />
        )}
      </ScrollView>
    </View>
  )
}

export default AnchorAccountScreen
