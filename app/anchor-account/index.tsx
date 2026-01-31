import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { createAnchorAccount, createDepositAccount, verifyKyc } from '@/api/account'
import { useAuth } from '@/services/useAuth'
import { getAnchorNextStep, normalizeAnchorOnboarding, useAnchorOnboarding } from '@/services/useAnchorOnboarding'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import { isKycAlreadyCompleted } from '@/utils/anchorAccount'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const AnchorAccountScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { onLogout, userProfileData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
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

  const handleRefresh = useCallback(
    async (options?: { force?: boolean }) => {
      setRefreshing(true)
      try {
        return await anchorState.refresh(options)
      } catch (error: any) {
        const status = error?.response?.status
        if (status === 401) {
          await onLogout()
          router.replace('/login')
          return null
        }
        const message =
          error?.message ||
          buildApiErrorMessage({
            status,
            data: error?.response?.data,
            fallback: error?.message || 'Something went wrong',
          })
        setNotice({ message, error: true, data: null })
        return null
      } finally {
        setRefreshing(false)
      }
    },
    [anchorState, onLogout, router]
  )

  useEffect(() => {
    if (anchorState.error?.response?.status === 401) {
      onLogout().then(() => router.replace('/login')).catch(() => {})
    }
  }, [anchorState.error, onLogout, router])

  useEffect(() => {
    if (params?.refresh === '1' && !refreshHandledRef.current) {
      refreshHandledRef.current = true
      handleRefresh({ force: true }).catch(() => {})
    }
  }, [params?.refresh, handleRefresh])

  const ensureAnchorAccount = async () => {
    if (anchorState.hasAnchorAccount) {
      setNotice({ message: 'Anchor account already exists.', error: false, data: null })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    let shouldRefresh = true
    try {
      const response = await createAnchorAccount()
      setNotice({
        message: response?.message || 'Anchor account created.',
        error: false,
        data: response?.data || null,
      })
      await handleRefresh({ force: true })
      shouldRefresh = false
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status
      const data = error?.response?.data ?? error
      if (status === 409) {
        await handleRefresh({ force: true })
        shouldRefresh = false
        return
      }
      if (status === 422 && Array.isArray(data?.missing_fields)) {
        setNotice({
          message: `Complete your profile: ${data.missing_fields.join(', ')}`,
          error: true,
          data: null,
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
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
      if (shouldRefresh) {
        await handleRefresh()
      }
    }
  }

  const ensureAccountNumber = async () => {
    if (!anchorState.hasAnchorAccount) return
    if (anchorState.hasAccountNumber) {
      setNotice({ message: 'Account number already generated.', error: false, data: null })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    let shouldRefresh = true
    try {
      await createDepositAccount()
      const refreshed = await handleRefresh({ force: true })
      shouldRefresh = false
      const normalized = refreshed
        ? normalizeAnchorOnboarding(refreshed.detailResponse, refreshed.userAccountsResponse)
        : null
      if (normalized?.hasAccountNumber) {
        setNotice({ message: 'Account number generated.', error: false, data: null })
      } else {
        setNotice({
          message: 'Your virtual account is being set up. This may take a moment.',
          error: false,
          data: null,
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
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
      if (shouldRefresh) {
        await handleRefresh()
      }
    }
  }

  const normalized = useMemo(
    () => normalizeAnchorOnboarding(anchorState.detailResponse, anchorState.userAccountsResponse),
    [anchorState.detailResponse, anchorState.userAccountsResponse]
  )

  const statusLabel = useMemo(() => {
    const map: Record<string, string> = {
      verified: 'Verified',
      pending: 'Pending review',
      not_started: 'Not verified',
      unknown: 'Unknown',
    }
    return map[normalized.kycState] || 'Unknown'
  }, [normalized.kycState])

  const pendingMessage =
    normalized.hasAnchorAccount && normalized.kycState === 'verified' && !normalized.accountNumber
      ? 'Your virtual account is being set up. This may take a moment.'
      : null

  const inactiveNumberMessage =
    normalized.hasAnchorAccount && normalized.accountNumber && normalized.kycState !== 'verified'
      ? 'Account number created. Deposits will activate after KYC verification.'
      : null

  const maskedAccountNumber = normalized.accountNumber
    ? `****${String(normalized.accountNumber).slice(-4)}`
    : ''

  const handleKycSubmit = async () => {
    if (!kycForm.bvn.trim() || !kycForm.dob.trim()) {
      setNotice({ message: 'BVN and date of birth are required.', error: true, data: null })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await verifyKyc({
        bvn: kycForm.bvn.trim(),
        dob: kycForm.dob.trim(),
        gender: kycForm.gender.trim() || undefined,
      })
      setNotice({
        message: response?.message || 'KYC verification submitted.',
        error: false,
        data: null,
      })
      await handleRefresh({ force: true })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout()
        router.replace('/login')
        return
      }
      if (isKycAlreadyCompleted(error)) {
        await handleRefresh({ force: true })
        setNotice({
          message: 'KYC already completed.',
          error: false,
          data: null,
        })
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to verify KYC',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  const primaryAction = useMemo(() => {
    const step = getAnchorNextStep(normalized)
    switch (step) {
      case 'CREATE_ANCHOR':
        return { label: 'Create Anchor Account', onPress: ensureAnchorAccount }
      case 'DO_KYC':
        return { label: 'Verify Anchor KYC', onPress: handleKycSubmit }
      case 'GENERATE_NUMBER':
        return { label: 'Generate Account Number', onPress: ensureAccountNumber }
      case 'DONE':
        return null
      default:
        return null
    }
  }, [normalized, ensureAnchorAccount, ensureAccountNumber, handleKycSubmit])

  const step = useMemo(() => getAnchorNextStep(normalized), [normalized])

  const explanation = useMemo(() => {
    if (!normalized.hasAnchorAccount) {
      return 'Create your Anchor account to get started.'
    }
    if (normalized.kycState !== 'verified') {
      return 'Finish verification to unlock deposits.'
    }
    if (!normalized.hasAccountNumber) {
      return 'Generate your account number to fund your wallet.'
    }
    return 'You are ready to fund your wallet.'
  }, [normalized])

  const isHydrated = anchorState.isHydrated

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => handleRefresh({ force: true })}
            tintColor="#f59e0b"
          />
        }
      >
        <View className="pt-10">
          <Text className="text-white text-2xl mb-2">Anchor Account</Text>
          <Text className="text-gray-300 mb-6">
            Complete each step to start funding your wallet.
          </Text>

          {notice.message ? (
            <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
          ) : null}

          {!isHydrated ? (
            <View className="bg-gray-900 rounded-xl p-4 gap-3">
              <View className="h-4 w-36 bg-gray-800 rounded" />
              <View className="h-3 w-56 bg-gray-800 rounded" />
              <View className="h-3 w-48 bg-gray-800 rounded" />
              <View className="h-10 w-full bg-gray-800 rounded-xl" />
            </View>
          ) : (
            <View className="bg-gray-900 rounded-xl p-4 gap-3">
              <Text className="text-white text-base font-semibold">Onboarding progress</Text>
              <View className="flex-row items-center gap-2">
                <View
                  className={`flex-1 h-1 rounded-full ${
                    normalized.hasAnchorAccount ? 'bg-emerald-400' : 'bg-gray-700'
                  }`}
                />
                <View
                  className={`flex-1 h-1 rounded-full ${
                    normalized.kycState === 'verified' ? 'bg-emerald-400' : 'bg-gray-700'
                  }`}
                />
                <View
                  className={`flex-1 h-1 rounded-full ${
                    normalized.hasAccountNumber ? 'bg-emerald-400' : 'bg-gray-700'
                  }`}
                />
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-400 text-xs">Account</Text>
                <Text className="text-gray-400 text-xs">KYC</Text>
                <Text className="text-gray-400 text-xs">Account #</Text>
              </View>

              <View className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                <Text className="text-gray-200 text-xs">{explanation}</Text>
              </View>

              <View className="mt-1">
                <Text className="text-gray-200 text-sm">Step 1: Anchor account</Text>
                <Text className="text-gray-400 text-xs">
                  {normalized.hasAnchorAccount ? 'Account exists' : 'Not created yet'}
                </Text>
              </View>

              <View className="mt-3">
                <Text className="text-gray-200 text-sm">Step 2: Anchor KYC</Text>
                <Text className="text-gray-400 text-xs">Status: {statusLabel}</Text>
                <Text className="text-gray-500 text-xs mt-1">
                  Verify once to unlock deposits.
                </Text>
              </View>

              <View className="mt-3">
                <Text className="text-gray-200 text-sm">Step 3: Virtual account number</Text>
                <Text className="text-gray-400 text-xs">
                  {normalized.accountNumber
                    ? `Account Number: ${
                        normalized.kycState === 'verified' ? normalized.accountNumber : maskedAccountNumber
                      }`
                    : 'Not generated yet'}
                </Text>
              </View>

              {pendingMessage ? (
                <View className="mt-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                  <Text className="text-slate-200 text-xs">{pendingMessage}</Text>
                </View>
              ) : null}

              {inactiveNumberMessage ? (
                <View className="mt-3 rounded-xl border border-amber-500/40 bg-amber-900/20 p-3">
                  <View className="flex-row items-center justify-between">
                  <Text className="text-amber-200 text-xs">Inactive until verified</Text>
                    {maskedAccountNumber ? (
                      <Text className="text-amber-100 text-xs font-semibold">{maskedAccountNumber}</Text>
                    ) : null}
                  </View>
                  <Text className="text-amber-200 text-xs mt-1">{inactiveNumberMessage}</Text>
                </View>
              ) : null}

              {normalized.depositReady ? (
                <View className="mt-4 border border-emerald-500/40 rounded-xl p-3 bg-emerald-900/20">
                  <Text className="text-emerald-300 font-semibold">All set</Text>
                  <Text className="text-emerald-100 text-xs mt-1">
                    Use the account number above to fund your wallet.
                  </Text>
                </View>
              ) : null}

              <View className="mt-4">
                {normalized.accountName ? (
                  <Text className="text-gray-300 text-xs">Account Name: {normalized.accountName}</Text>
                ) : null}
                {normalized.bankName ? (
                  <Text className="text-gray-300 text-xs">Bank: {normalized.bankName}</Text>
                ) : null}
              </View>

              {normalized.hasAnchorAccount && normalized.kycState !== 'verified' ? (
                <View className="mt-4">
                  <Text className="text-gray-200 text-sm mb-2">Verify Anchor KYC</Text>
                  <Text className="text-gray-500 text-xs mb-3">
                    Why can’t I deposit yet? Verification is still pending.
                  </Text>
                  <FormInput
                    label="BVN"
                    value={kycForm.bvn}
                    onChangeText={(value: string) =>
                      setKycForm((prev) => ({ ...prev, bvn: value }))
                    }
                    keyboardType="numeric"
                  />
                  <FormInput
                    label="Date of Birth (YYYY-MM-DD)"
                    value={kycForm.dob}
                    editable={!prefilledDob}
                    onChangeText={(value: string) =>
                      setKycForm((prev) => ({ ...prev, dob: value }))
                    }
                  />
                  <FormSelect
                    label="Gender (optional)"
                    selectedValue={kycForm.gender}
                    disabled={!!prefilledGender}
                    onValueChange={(value: string) =>
                      setKycForm((prev) => ({ ...prev, gender: value }))
                    }
                    options={[
                      { label: 'Select gender', value: '' },
                      { label: 'Male', value: 'male' },
                      { label: 'Female', value: 'female' },
                    ]}
                  />
                </View>
              ) : null}

              {primaryAction ? (
                <TouchableOpacity
                  onPress={primaryAction.onPress}
                  className="bg-app-primary py-3 rounded-xl mt-4"
                  disabled={loading}
                >
                  <Text className="text-white text-center font-medium">{primaryAction.label}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => handleRefresh({ force: true })}
                className="bg-gray-900 border border-gray-800 py-3 rounded-xl mt-3"
                disabled={loading || refreshing}
              >
                <Text className="text-white text-center text-xs">Refresh status</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      <Loader open={loading} />
    </View>
  )
}

export default AnchorAccountScreen
