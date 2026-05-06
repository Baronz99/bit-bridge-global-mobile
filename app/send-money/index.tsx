import React, { useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import { sendMoneyToUser } from '@/api/wallet'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { error as logError, log } from '@/utils/logger'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const SendMoneyScreen = () => {
  const router = useRouter()
  const { userProfileData, loadProfile } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))
  const [loading, setLoading] = useState(false)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    phone_number: '',
    amount: '',
    description: '',
  })
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  const needsTier2 = useMemo(() => {
    const payload = userProfileData?.data ?? userProfileData
    const kycLevel = String(payload?.kyc_level || payload?.user_kyc?.kyc_level || 'nil')
      .trim()
      .toLowerCase()
    return ['nil', '', 'tier_0', 'tier_1'].includes(kycLevel)
  }, [userProfileData])

  const handleOpenPin = async () => {
    const amountValue = Number(formData.amount)

    if (needsTier2) {
      setNotice({
        message: 'Complete Tier 2 verification to send money.',
        error: true,
        data: null,
      })
      router.push('/kyc')
      return
    }

    if (!formData.phone_number.trim() || !amountValue) {
      setNotice({
        message: 'Phone number and amount are required.',
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
      if (error?.response?.status === 401) return
    }

    setPinError(null)
    setPinModalOpen(true)
  }

  const submitTransfer = async (credential: {
    transaction_pin?: string
    biometric_approval_token?: string
  }) => {
    const amountValue = Number(formData.amount)
    if (!formData.phone_number.trim() || !amountValue) {
      setNotice({
        message: 'Phone number and amount are required.',
        error: true,
        data: null,
      })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await sendMoneyToUser({
        phone_number: formData.phone_number.trim(),
        amount: amountValue,
        ...credential,
        description: formData.description.trim() || undefined,
      })

      setPinModalOpen(false)
      setFormData({ phone_number: '', amount: '', description: '' })
      setNotice({
        message: response?.message || 'Transfer successful.',
        error: false,
        data: response?.data || null,
      })
      if (credential.transaction_pin) {
        log('[SEND_MONEY][BIOMETRIC] enrollment:begin_after_success')
        try {
          const enrollmentResult = await transactionBiometrics.maybeEnrollAfterPinSuccess(credential.transaction_pin)
          log('[SEND_MONEY][BIOMETRIC] enrollment:completed_after_success', enrollmentResult)
          if (enrollmentResult.status === 'enrolled') {
            setNotice({
              message: 'Transfer successful. Face ID / Fingerprint is now enabled for future transfer confirmations on this device.',
              error: false,
              data: response?.data || null,
            })
          } else if (enrollmentResult.status === 'skipped') {
            setNotice({
              message: 'Transfer successful. Set up device biometrics to enable faster transfer confirmations next time.',
              error: false,
              data: response?.data || null,
            })
          }
        } catch (enrollmentError: any) {
          logError('[SEND_MONEY][BIOMETRIC] enrollment:failed_after_success', enrollmentError)
          setNotice({
            message:
              enrollmentError?.message ||
              'Transfer succeeded, but biometric confirmation could not be enabled on this device yet.',
            error: true,
            data: null,
          })
        }
      }
      await loadProfile({ force: true })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) return
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Something went wrong',
      })
      setPinError(message)
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (transactionPin: string) =>
    submitTransfer({ transaction_pin: transactionPin })

  const handleBiometricSubmit = async () => {
    try {
      const approvalToken = await transactionBiometrics.getApprovalToken()
      await submitTransfer({ biometric_approval_token: approvalToken })
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
          <Text className="text-white text-2xl mb-2">Send Money</Text>
          <Text className="text-gray-300 mb-6">Send money to a BitBridge user.</Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <FormInput
            label="Recipient Phone Number"
            value={formData.phone_number}
            name="phone_number"
            keyboardType="phone-pad"
            onChangeText={(text: string) =>
              setFormData({ ...formData, phone_number: text })
            }
          />

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

          <TouchableOpacity
            onPress={handleOpenPin}
            className="bg-theme-primary py-6 mt-6 rounded-xl"
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
        title="Enter PIN to Send"
      />

      <Loader open={loading} />
    </View>
  )
}

export default SendMoneyScreen



