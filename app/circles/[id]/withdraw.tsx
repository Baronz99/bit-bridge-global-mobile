import React, { useMemo, useState } from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import CompletionPanel from '@/components/finance/CompletionPanel'
import FinancialSummaryCard from '@/components/finance/FinancialSummaryCard'
import { withdrawCircle } from '@/api/circles'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import moneyFormat from '@/utils/moneyFormat'
import { error as logError, log } from '@/utils/logger'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const formatTime = (value?: string) => {
  if (!value) return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const CircleWithdrawScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { userProfileData } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))
  const [loading, setLoading] = useState(false)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ amount: '', description: '' })
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })

  const amountValue = useMemo(() => Number(String(formData.amount).replace(/[^0-9.]/g, '')), [formData.amount])
  const successData = (notice.data && !notice.error ? notice.data : null) as Record<string, any> | null
  const successReference = String(successData?.reference || successData?.transaction_reference || successData?.transfer_reference || '').trim()
  const successTimestamp = String(successData?.created_at || successData?.occurred_at || '').trim()
  const successStatus = String(successData?.status || 'successful').trim()

  const handleOpenPin = async () => {
    if (!circleId) {
      setNotice({ message: 'Missing circle ID.', error: true, data: null })
      return
    }
    if (!amountValue || Number.isNaN(amountValue)) {
      setNotice({ message: 'Amount is required.', error: true, data: null })
      return
    }

    try {
      const status = await getTransactionPinStatus()
      const payload = status?.data ?? status
      const hasPin = payload?.has_pin === true || payload?.status === 'set' || payload?.pin_set === true
      if (!hasPin) {
        setNotice({ message: 'Set your transaction PIN to continue.', error: true, data: null })
        router.push('/settings/pin/set')
        return
      }
    } catch (error: any) {
      const statusCode = error?.response?.status
      if (statusCode === 401) return
    }

    setPinError(null)
    setPinModalOpen(true)
  }

  const submitWithdrawal = async (credential: { transaction_pin?: string; biometric_approval_token?: string }) => {
    if (!circleId || !amountValue || Number.isNaN(amountValue)) {
      setNotice({ message: 'Amount is required.', error: true, data: null })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await withdrawCircle(circleId, {
        amount_cents: Math.round(amountValue * 100),
        note: formData.description.trim() || undefined,
        ...credential,
      })
      const payload: any = response
      setPinModalOpen(false)
      setFormData({ amount: '', description: '' })
      setNotice({ message: payload?.message || 'Withdrawal request submitted.', error: false, data: payload?.data || null })
      if (credential.transaction_pin) {
        log('[CIRCLE_WITHDRAW][BIOMETRIC] enrollment:begin_after_success')
        try {
          const enrollmentResult = await transactionBiometrics.maybeEnrollAfterPinSuccess(credential.transaction_pin)
          log('[CIRCLE_WITHDRAW][BIOMETRIC] enrollment:completed_after_success', enrollmentResult)
          if (enrollmentResult.status === 'enrolled') {
            setNotice({
              message: 'Withdrawal succeeded. Face ID / Fingerprint is now enabled for future transfer confirmations on this device.',
              error: false,
              data: payload?.data || null,
            })
          } else if (enrollmentResult.status === 'skipped') {
            setNotice({
              message: 'Withdrawal succeeded. Set up device biometrics to enable faster transfer confirmations next time.',
              error: false,
              data: payload?.data || null,
            })
          }
        } catch (enrollmentError: any) {
          logError('[CIRCLE_WITHDRAW][BIOMETRIC] enrollment:failed_after_success', enrollmentError)
          setNotice({
            message:
              enrollmentError?.message ||
              'Withdrawal succeeded, but biometric confirmation could not be enabled on this device yet.',
            error: true,
            data: null,
          })
        }
      }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) return

      const errors = error?.response?.data?.errors
      const messageFromErrors =
        Array.isArray(errors) && errors.length > 0 ? errors.join('\n') : typeof errors === 'string' ? errors : error?.response?.data?.message

      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: messageFromErrors || error?.message || 'Something went wrong',
      })
      setPinError(message)
      setNotice({ message, error: true, data: null })
      Alert.alert('Withdrawal failed', message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (transactionPin: string) => submitWithdrawal({ transaction_pin: transactionPin })

  const handleBiometricSubmit = async () => {
    try {
      const approvalToken = await transactionBiometrics.getApprovalToken()
      await submitWithdrawal({ biometric_approval_token: approvalToken })
    } catch (error: any) {
      const message = error?.message || 'Biometric confirmation failed. Use your transaction PIN.'
      setPinError(message)
      setNotice({ message, error: true, data: null })
    }
  }

  const preflightRows = [
    { label: 'Amount', value: amountValue > 0 ? moneyFormat(amountValue) : '--', emphasis: true },
    formData.description.trim() ? { label: 'Note', value: formData.description.trim() } : null,
    { label: 'Destination', value: 'Your linked BitBridge wallet' },
  ].filter(Boolean) as { label: string; value: string; emphasis?: boolean }[]

  const completionRows = [
    { label: 'You received', value: amountValue > 0 ? moneyFormat(amountValue) : '--', emphasis: true },
    { label: 'Source', value: 'Circle balance' },
    successReference ? { label: 'Transaction ID', value: successReference, mono: true } : null,
    successTimestamp ? { label: 'Timestamp', value: formatTime(successTimestamp) } : null,
    { label: 'Status', value: successStatus || 'successful' },
  ].filter(Boolean) as { label: string; value: string; emphasis?: boolean; mono?: boolean }[]

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-8 gap-4">
          {successData ? (
            <CompletionPanel
              eyebrow="Circle withdrawal"
              title="Withdrawal completed"
              supportingText={notice.message || 'Funds have been moved from this circle.'}
              primaryLabel="You received"
              primaryValue={amountValue > 0 ? moneyFormat(amountValue) : '--'}
              statusLabel="Successful"
              statusTone="success"
              summaryTitle="Withdrawal receipt"
              summaryRows={completionRows}
              primaryActionLabel={successReference ? 'View receipt' : 'Done'}
              onPrimaryAction={() => {
                if (successReference) {
                  router.push({ pathname: '/transaction/receipt', params: { reference: successReference } } as any)
                  return
                }
                router.replace(`/circles/${circleId}` as any)
              }}
              secondaryActionLabel="Back to circle"
              onSecondaryAction={() => router.replace(`/circles/${circleId}` as any)}
            />
          ) : (
            <>
              <View className="rounded-[30px] bg-[#0F1115] px-5 py-5 border border-white/6">
                <Text className="text-[#D49A3A] text-[10px] uppercase tracking-[3px]">Circle withdrawal</Text>
                <Text className="text-white text-[28px] font-semibold mt-2">Move funds from this circle</Text>
                <Text className="text-[#A9AFB8] text-[13px] leading-5 mt-2">
                  Withdraw to your BitBridge wallet with the same calm confirmation flow used across the app.
                </Text>
              </View>

              <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

              <FinancialSummaryCard
                title="Withdrawal summary"
                rows={preflightRows}
                footer="Final amount is confirmed before execution."
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

              <TouchableOpacity onPress={handleOpenPin} className="bg-theme-primary py-5 rounded-[20px]">
                <Text className="text-alt font-semibold text-center">Continue</Text>
              </TouchableOpacity>
            </>
          )}
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
        title="Enter PIN to Withdraw"
      />

      <Loader open={loading} />
    </View>
  )
}

export default CircleWithdrawScreen
