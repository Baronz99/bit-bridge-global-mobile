import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import { fundCircle, getCircle } from '@/api/circles'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import { useTransactionBiometrics } from '@/services/useTransactionBiometrics'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import moneyFormat from '@/utils/moneyFormat'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const getTierRank = (value: unknown) => {
  const normalized = String(value || 'tier_0').toLowerCase()
  if (normalized.includes('tier_4')) return 4
  if (normalized.includes('tier_3')) return 3
  if (normalized.includes('tier_2')) return 2
  if (normalized.includes('tier_1')) return 1
  return 0
}

const CircleFundScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { onLogout, userProfileData } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(String(profilePayload?.id || ''))
  const [loading, setLoading] = useState(false)
  const [circle, setCircle] = useState<Record<string, any> | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
  })
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  useEffect(() => {
    if (!circleId) return
    getCircle(circleId)
      .then((payload) => setCircle(((payload?.data ?? payload) as Record<string, any>) || null))
      .catch(() => {})
  }, [circleId])

  const profileRoot = (userProfileData?.data ?? userProfileData) || {}
  const tierRank = getTierRank(profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level)
  const isTier1User = tierRank === 1
  const isStandardCircle = circle?.circle_type !== 'official'
  const isFlexibleOfficial = circle?.circle_type === 'official' && circle?.kyc_mode === 'flexible'
  const maxContributionCents = Number(circle?.max_contribution_cents || 0)
  const standardDailyCapCents = 10000000
  const amountCents = useMemo(
    () => Math.round(Number(String(formData.amount).replace(/[^0-9.]/g, '')) * 100) || 0,
    [formData.amount]
  )
  const overCap = isFlexibleOfficial && isTier1User && maxContributionCents > 0 && amountCents > maxContributionCents

  const handleOpenPin = async () => {
    const amountValue = Number(String(formData.amount).replace(/[^0-9.]/g, ''))
    if (!circleId) {
      setNotice({ message: 'Missing circle ID.', error: true, data: null })
      return
    }
    if (!amountValue || Number.isNaN(amountValue)) {
      setNotice({ message: 'Amount is required.', error: true, data: null })
      return
    }
    if (overCap) {
      setNotice({
        message: 'Complete verification to contribute above your current limit.',
        error: true,
        data: null,
      })
      return
    }

    try {
      const status = await getTransactionPinStatus()
      const payload = status?.data ?? status
      const hasPin =
        payload?.has_pin === true ||
        payload?.status === 'set' ||
        payload?.pin_set === true
      if (!hasPin) {
        setNotice({
          message: 'Set your transaction PIN to continue.',
          error: true,
          data: null,
        })
        router.push('/settings/pin/set')
        return
      }
    } catch (error: any) {
      const statusCode = error?.response?.status
      if (statusCode === 401) {
        return
      }
    }

    setPinError(null)
    setPinModalOpen(true)
  }

  const submitFunding = async (credential: {
    transaction_pin?: string
    biometric_approval_token?: string
  }) => {
    const amountValue = Number(String(formData.amount).replace(/[^0-9.]/g, ''))
    if (!circleId || !amountValue || Number.isNaN(amountValue)) {
      setNotice({ message: 'Amount is required.', error: true, data: null })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await fundCircle(circleId, {
        amount_cents: Math.round(amountValue * 100),
        note: formData.description.trim() || undefined,
        ...credential,
      })
      const payload: any = response
      setPinModalOpen(false)
      setFormData({ amount: '', description: '' })
      setNotice({
        message: payload?.message || 'Circle funded successfully.',
        error: false,
        data: payload?.data || null,
      })
      if (credential.transaction_pin) {
        await transactionBiometrics.maybeEnrollAfterPinSuccess(credential.transaction_pin).catch(() => {})
      }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        return
      }

      const errors = error?.response?.data?.errors
      const messageFromErrors =
        Array.isArray(errors) && errors.length > 0
          ? errors.join('\n')
          : typeof errors === 'string'
            ? errors
            : error?.response?.data?.message

      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: messageFromErrors || error?.message || 'Something went wrong',
      })

      setPinError(message)
      setNotice({ message, error: true, data: null })
      Alert.alert('Funding failed', message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (transactionPin: string) =>
    submitFunding({ transaction_pin: transactionPin })

  const handleBiometricSubmit = async () => {
    try {
      const approvalToken = await transactionBiometrics.getApprovalToken()
      await submitFunding({ biometric_approval_token: approvalToken })
    } catch (error: any) {
      const message = error?.message || 'Biometric confirmation failed. Use your transaction PIN.'
      setPinError(message)
      setNotice({ message, error: true, data: null })
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-10">
          <Text className="text-white text-2xl mb-2">Fund Circle</Text>
          <Text className="text-gray-300 mb-6">
            {isFlexibleOfficial ? 'Add money to this official circle.' : 'Add money to this circle.'}
          </Text>

          {circle?.circle_type === 'official' ? (
            <View className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <Text className="text-amber-100 text-xs uppercase">Official BitBridge Circle</Text>
              {circle?.badge_label ? (
                <Text className="text-white text-sm font-semibold mt-1">{String(circle.badge_label)}</Text>
              ) : null}
            </View>
          ) : null}

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <FormInput
            label="Amount"
            value={formData.amount}
            name="amount"
            keyboardType="numeric"
            onChangeText={(text: string) => setFormData({ ...formData, amount: text })}
          />

          <FormInput
            label="Description (optional)"
            value={formData.description}
            name="description"
            onChangeText={(text: string) => setFormData({ ...formData, description: text })}
          />

          {isFlexibleOfficial && isTier1User && maxContributionCents > 0 ? (
            <View className={`mt-4 rounded-2xl border px-4 py-3 ${overCap ? 'border-amber-500/40 bg-amber-500/10' : 'border-sky-500/30 bg-sky-500/10'}`}>
              <Text className={`text-xs ${overCap ? 'text-amber-100' : 'text-sky-100'}`}>
                You can contribute up to {moneyFormat(maxContributionCents / 100)} with your current verification level.
              </Text>
              <Text className="text-gray-300 text-[10px] mt-1">
                Complete verification to unlock higher contributions.
              </Text>
            </View>
          ) : null}

          {isStandardCircle && isTier1User ? (
            <View className="mt-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
              <Text className="text-xs text-sky-100">
                Tier 1 users can contribute up to {moneyFormat(standardDailyCapCents / 100)} per day across standard circles.
              </Text>
              <Text className="text-gray-300 text-[10px] mt-1">
                Complete Tier 2 verification to unlock higher contributions.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleOpenPin}
            className={`py-6 mt-6 rounded-xl ${overCap ? 'bg-gray-700' : 'bg-theme-primary'}`}
          >
            <Text className="text-alt font-medium text-center">Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handleSubmit}
        onBiometricSubmit={handleBiometricSubmit}
        loading={loading}
        biometricLoading={transactionBiometrics.biometricLoading}
        biometricAvailable={transactionBiometrics.biometricAvailable}
        biometricEnabled={transactionBiometrics.biometricEnabled}
        errorMessage={pinError}
        title="Enter PIN to Fund"
      />

      <Loader open={loading} />
    </View>
  )
}

export default CircleFundScreen



