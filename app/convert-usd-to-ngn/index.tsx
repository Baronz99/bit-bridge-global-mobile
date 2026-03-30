import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import { convertTunnelUsdToNgn, getUserWallet, quoteTunnelUsdToNgn } from '@/api/wallet'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'
import useFetch from '@/services/useFetch'
import moneyFormat from '@/utils/moneyFormat'
import { apiErrorMessage } from '@/utils/apiErrorMessage'
import { log } from '@/utils/logger'

const tunnelCard = 'rounded-[28px] border border-[#6A4316] bg-[#1A0F05]'
const tunnelPanel = 'rounded-[20px] border border-[#5A3914] bg-[#120B04]'
const tunnelSoftPanel = 'rounded-[18px] border border-[#4A3012] bg-[#160D05]'

const ConvertUsdToNgnScreen = () => {
  const router = useRouter()
  const { onLogout, loadProfile, userProfileData } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))

  const [loading, setLoading] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [amountUsd, setAmountUsd] = useState('')
  const [quoteData, setQuoteData] = useState<any | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ message: string | null; error: boolean; data: any | null }>({
    message: null,
    error: false,
    data: null,
  })
  const { data: walletData } = useFetch(() => getUserWallet(), true)

  const amountValue = useMemo(() => Number(amountUsd), [amountUsd])
  const quote = quoteData
  const walletPayload = (walletData as any)?.data ?? walletData
  const bridgeWallet = walletPayload?.bridge ?? walletPayload?.data?.bridge ?? null
  const tunnelWallet = walletPayload?.tunnel ?? walletPayload?.data?.tunnel ?? null
  const sourceBalanceLabel = tunnelWallet
    ? moneyFormat(Number(tunnelWallet?.balance ?? tunnelWallet?.amount ?? 0), 'USD')
    : 'Tunnel not activated'

  const handleError = async (error: any, options?: { forPin?: boolean }) => {
    const status = error?.response?.status
    if (status === 401) {
      return
    }

    const data = error?.response?.data
    const message = apiErrorMessage({
      status,
      data,
      fallback: error?.message || 'Something went wrong',
    })

    if (options?.forPin) {
      setPinError(message)
    } else {
      setNotice({ message, error: true, data: null })
    }
  }

  useEffect(() => {
    const value = Number(amountUsd)
    if (!value || Number.isNaN(value) || value <= 0) {
      setQuoteData(null)
      setNotice({ message: null, error: false, data: null })
      setQuoteLoading(false)
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setQuoteLoading(true)
      setPinError(null)
      try {
        log('[TunnelFX] quote USD->NGN start')
        const response = await quoteTunnelUsdToNgn(value)
        if (!active) return
        setQuoteData(response)
        log('[TunnelFX] quote USD->NGN success')
        setNotice({ message: null, error: false, data: null })
      } catch (error: any) {
        if (!active) return
        log('[TunnelFX] quote USD->NGN failed', {
          status: error?.response?.status,
        })
        await handleError(error)
      } finally {
        if (active) setQuoteLoading(false)
      }
    }, 450)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [amountUsd])

  const handleConvertWithCredential = async (credential: {
    transaction_pin?: string
    biometric_approval_token?: string
  }) => {
    if (!quoteData) {
      setNotice({ message: 'Get a quote first.', error: true, data: null })
      return
    }

    setLoading(true)
    setPinError(null)
    try {
      log('[TunnelFX] convert USD->NGN start')
      const response = await convertTunnelUsdToNgn(
        amountValue,
        String(credential.transaction_pin || credential.biometric_approval_token || ''),
        quote?.quote_token
      )
      setPinModalOpen(false)
      log('[TunnelFX] convert USD->NGN success')
      setNotice({
        message: response?.message || 'Conversion successful.',
        error: false,
        data: response?.data || null,
      })
      setQuoteData(null)
      if (credential.transaction_pin) {
        try {
          await transactionBiometrics.maybeEnrollAfterPinSuccess(credential.transaction_pin)
        } catch (enrollmentError: any) {
          setNotice({
            message:
              enrollmentError?.message ||
              'Conversion succeeded, but biometric confirmation could not be enabled on this device yet.',
            error: true,
            data: null,
          })
        }
      }
      loadProfile({ force: true })
    } catch (error: any) {
      log('[TunnelFX] convert USD->NGN failed', {
        status: error?.response?.status,
      })
      await handleError(error, { forPin: true })
    } finally {
      setLoading(false)
    }
  }

  const handleConvert = async (transactionPin: string) =>
    handleConvertWithCredential({ transaction_pin: transactionPin })

  const handleBiometricSubmit = async () => {
    try {
      const approvalToken = await transactionBiometrics.getApprovalToken()
      await handleConvertWithCredential({ biometric_approval_token: approvalToken })
    } catch (error: any) {
      const message = error?.message || 'Biometric confirmation failed. Use your transaction PIN.'
      setPinError(message)
      setNotice({ message, error: true, data: null })
    }
  }

  const feeAmount = quote?.fee_amount
  const amountAfterFee = quote?.amount_after_fee
  const executionRate = quote?.execution_rate
  const amountOut = quote?.amount_out
  const successQuote = notice.data?.quote
  const successNgnWallet = notice.data?.ngn_wallet
  const canConvert = Boolean(quote) && !quoteLoading
  const showSuccess = Boolean(notice.message && !notice.error && notice.data)

  return (
    <View className="flex-1 bg-[#070A12] px-4">
      <KeyboardAvoidWrapper>
        <ScrollView
          className="flex-1 pt-10"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className={`${tunnelCard} overflow-hidden`}>
            <View className="absolute right-[-30] top-[-18] h-28 w-28 rounded-full bg-[#FF8A1F]/12" />
            <View className="absolute left-[-24] top-10 h-24 w-24 rounded-full bg-[#FFB347]/10" />
            <View className="px-5 pb-5 pt-6">
              <Text className="text-[11px] uppercase tracking-[2px] text-[#FFB347]/85">Tunnel FX</Text>
              <Text className="mt-2 text-[26px] font-semibold text-[#FFF7ED]">Convert USD to NGN</Text>
              <Text className="mt-2 text-[13px] leading-5 text-[#F6E7D2]">
                Move value from your global Tunnel rail back into your local Bridge rail with a live quote.
              </Text>

              <View className="mt-5 flex-row rounded-[18px] border border-[#4A3012] bg-[#120B04] p-1">
                <TouchableOpacity
                  onPress={() => router.replace('/convert-ngn-to-usd')}
                  className="flex-1 rounded-[14px] px-3 py-3"
                >
                  <Text className="text-center text-[13px] font-medium text-[#F3DFC1]">Bridge -&gt; Tunnel</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 rounded-[14px] bg-[#FF8A1F] px-3 py-3">
                  <Text className="text-center text-[13px] font-semibold text-[#FFF7ED]">Tunnel -&gt; Bridge</Text>
                </TouchableOpacity>
              </View>

              <View className="mt-4 flex-row gap-3">
                <View className={`${tunnelSoftPanel} flex-1 px-4 py-3`}>
                  <Text className="text-[11px] uppercase tracking-[1.4px] text-[#FFB347]/72">Source rail</Text>
                  <Text className="mt-2 text-[18px] font-semibold text-[#FFF7ED]">Tunnel</Text>
                  <Text className="mt-1 text-[12px] text-[#E8D7C1]">{sourceBalanceLabel}</Text>
                </View>
                <View className={`${tunnelSoftPanel} flex-1 px-4 py-3`}>
                  <Text className="text-[11px] uppercase tracking-[1.4px] text-[#FFB347]/72">Destination rail</Text>
                  <Text className="mt-2 text-[18px] font-semibold text-[#FFF7ED]">Bridge</Text>
                  <Text className="mt-1 text-[12px] text-[#E8D7C1]">
                    {moneyFormat(Number(bridgeWallet?.balance ?? bridgeWallet?.amount ?? 0), 'NGN')}
                  </Text>
                </View>
              </View>

              <View className={`${tunnelPanel} mt-4 px-4 py-4`}>
                <Text className="text-[12px] font-medium uppercase tracking-[1.5px] text-[#FFB347]/82">
                  Amount to convert
                </Text>
                <Text className="mt-1 text-[12px] leading-5 text-[#E8D7C1]">
                  Enter how much you want to move from Tunnel back into Bridge.
                </Text>

                <View className="mt-4">
                  <FormInput
                    label={undefined}
                    value={amountUsd}
                    name="amount_usd"
                    keyboardType="numeric"
                    onChangeText={(text: string) => setAmountUsd(text)}
                    placeHolder="0.00"
                    placeholderTextColor="#C8A26A"
                    selectionColor="#FFB347"
                    style={{ color: '#FFF7ED', backgroundColor: '#0E0803', borderColor: '#7A4D19' }}
                  />
                </View>

                <Text className="mt-2 text-[12px] text-[#F6E7D2]">Available in Tunnel: {sourceBalanceLabel}</Text>

                <View className="mt-4 border-t border-[#3A2610] pt-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-[11px] uppercase tracking-[1.8px] text-[#FFB347]/82">Live quote</Text>
                      <Text className="mt-2 text-[22px] font-semibold text-[#FFF7ED]">
                        {quoteLoading
                          ? 'Refreshing quote'
                          : quote
                            ? moneyFormat(Number(amountOut) || 0, 'NGN')
                            : 'You will receive NGN'}
                      </Text>
                      <Text className="mt-1 text-[13px] leading-5 text-[#F3E4CF]">
                        {quoteLoading
                          ? 'Fetching the latest execution rate.'
                          : quote
                            ? 'This is the live amount that will settle into your Bridge balance.'
                            : 'Enter a USD amount to generate a live quote before confirming.'}
                      </Text>
                    </View>
                    <View className="rounded-full border border-[#5B3A14] bg-[#FF8A1F]/10 px-3 py-2">
                      <Text className="text-[11px] font-medium text-[#FFB347]">USD -&gt; NGN</Text>
                    </View>
                  </View>

                  <View className={`${tunnelSoftPanel} mt-4 px-4 py-4`}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12px] text-[#E0BB86]">Fee</Text>
                      <Text className="text-[13px] font-medium text-[#FFF7ED]">
                        {moneyFormat(Number(feeAmount) || 0, 'USD')}
                      </Text>
                    </View>
                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-[12px] text-[#E0BB86]">Amount after fee</Text>
                      <Text className="text-[13px] font-medium text-[#FFF7ED]">
                        {moneyFormat(Number(amountAfterFee) || 0, 'USD')}
                      </Text>
                    </View>
                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-[12px] text-[#E0BB86]">Rate</Text>
                      <Text className="text-[13px] font-medium text-[#FFF7ED]">
                        1 USD = {Number(executionRate || 0).toFixed(2)} NGN
                      </Text>
                    </View>
                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-[12px] text-[#E0BB86]">Destination rail</Text>
                      <Text className="text-[13px] font-medium text-[#FFF7ED]">Bridge NGN</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const status = await getTransactionPinStatus()
                      const payload = status?.data ?? status
                      const hasPin =
                        payload?.has_pin === true ||
                        payload?.status === 'set' ||
                        payload?.pin_set === true
                      if (!hasPin) {
                        setNotice({ message: 'Set your transaction PIN to continue.', error: true, data: null })
                        router.push('/settings/pin/set')
                        return
                      }
                      setPinModalOpen(true)
                    } catch (error: any) {
                      await handleError(error)
                    }
                  }}
                  className={`${canConvert ? 'bg-[#FF8A1F]' : 'bg-[#5B3A14]'} mt-4 rounded-[18px] py-5`}
                  disabled={!canConvert}
                >
                  <Text className="text-center text-[15px] font-semibold text-[#FFF7ED]">
                    {quoteLoading ? 'Refreshing quote...' : 'Convert to NGN'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {notice.error ? (
            <View className="mt-4">
              <NotificationAlert message={notice.message} data={null} error={notice.error} />
            </View>
          ) : null}

          {showSuccess ? (
          <View className={`${tunnelCard} mt-5 px-5 py-5`}>
            <Text className="text-[11px] uppercase tracking-[2px] text-[#FFB347]/80">Conversion complete</Text>
            <Text className="mt-2 text-[24px] font-semibold text-[#FFF7ED]">
              {moneyFormat(Number(successQuote?.amount_out) || 0, 'NGN')}
            </Text>
            <Text className="mt-1 text-[13px] text-[#F3E4CF]">{notice.message}</Text>
              <View className={`${tunnelSoftPanel} mt-4 px-4 py-4`}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[12px] text-[#E0BB86]">Rate</Text>
                  <Text className="text-[13px] text-[#FFF7ED]">
                    1 USD = {Number(successQuote?.execution_rate || 0).toFixed(2)} NGN
                  </Text>
                </View>
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-[12px] text-[#E0BB86]">Fee</Text>
                  <Text className="text-[13px] text-[#FFF7ED]">
                    {moneyFormat(Number(successQuote?.fee_amount) || 0, 'USD')}
                  </Text>
                </View>
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-[12px] text-[#E0BB86]">Bridge balance</Text>
                  <Text className="text-[13px] text-[#FFF7ED]">
                    {moneyFormat(Number(successNgnWallet?.balance) || 0, 'NGN')}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidWrapper>

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handleConvert}
        onBiometricSubmit={handleBiometricSubmit}
        loading={loading}
        biometricLoading={transactionBiometrics.biometricLoading}
        biometricAvailable={transactionBiometrics.biometricAvailable}
        biometricEnabled={transactionBiometrics.biometricEnabled}
        errorMessage={pinError}
        title="Enter PIN to Convert"
      />

      <Loader open={loading} />
    </View>
  )
}

export default ConvertUsdToNgnScreen



