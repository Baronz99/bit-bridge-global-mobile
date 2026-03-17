import React, { useEffect, useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import { convertTunnelUsdToNgn, quoteTunnelUsdToNgn } from '@/api/wallet'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { apiErrorMessage } from '@/utils/apiErrorMessage'
import { log } from '@/utils/logger'

const tunnelCard = 'rounded-[28px] border border-[#5B3A14] bg-[#1A0F05]'
const tunnelSubCard = 'rounded-[22px] border border-[#4A3012] bg-[#120B04]'

const ConvertUsdToNgnScreen = () => {
  const router = useRouter()
  const { onLogout, loadProfile } = useAuth()

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

  const amountValue = useMemo(() => Number(amountUsd), [amountUsd])
  const quote = quoteData

  const handleError = async (error: any, options?: { forPin?: boolean }) => {
    const status = error?.response?.status
    if (status === 401) {
      await onLogout().catch(() => {})
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

  const handleConvert = async (transactionPin: string) => {
    if (!quoteData) {
      setNotice({ message: 'Get a quote first.', error: true, data: null })
      return
    }

    setLoading(true)
    setPinError(null)
    try {
      log('[TunnelFX] convert USD->NGN start')
      const response = await convertTunnelUsdToNgn(amountValue, transactionPin, quote?.quote_token)
      setPinModalOpen(false)
      log('[TunnelFX] convert USD->NGN success')
      setNotice({
        message: response?.message || 'Conversion successful.',
        error: false,
        data: response?.data || null,
      })
      setQuoteData(null)
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
        <View className="flex-1 pt-10">
          <View className={`${tunnelCard} overflow-hidden`}>
            <View className="absolute right-[-30] top-[-18] h-28 w-28 rounded-full bg-[#FF8A1F]/12" />
            <View className="absolute left-[-24] top-10 h-24 w-24 rounded-full bg-[#FFB347]/10" />
            <View className="px-5 pb-5 pt-6">
              <Text className="text-[11px] uppercase tracking-[2px] text-[#FFB347]/80">Tunnel FX</Text>
              <Text className="mt-2 text-[26px] font-semibold text-[#FFF7ED]">Tunnel USD to Bridge NGN</Text>
              <Text className="mt-2 text-[13px] leading-5 text-[#FFF4E6]/75">
                Enter your USD amount and lock a live quote back into Bridge.
              </Text>

              <View className={`${tunnelSubCard} mt-5 px-4 py-4`}>
                <Text className="mb-2 text-[12px] font-medium uppercase tracking-[1.5px] text-[#FFB347]/75">
                  Amount to convert
                </Text>
                <FormInput
                  label={null}
                  value={amountUsd}
                  name="amount_usd"
                  keyboardType="numeric"
                  onChangeText={(text: string) => setAmountUsd(text)}
                  placeHolder="0.00"
                />
                <Text className="mt-1 text-[12px] text-[#FFF4E6]/65">Source rail: Tunnel USD balance</Text>
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
              <Text className="mt-1 text-[13px] text-[#FFF4E6]/80">{notice.message}</Text>
              <View className="mt-4 rounded-[20px] border border-[#4A3012] bg-[#120B04] px-4 py-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[12px] text-[#FFB347]/75">Rate</Text>
                  <Text className="text-[13px] text-[#FFF7ED]">
                    1 USD = {Number(successQuote?.execution_rate || 0).toFixed(2)} NGN
                  </Text>
                </View>
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-[12px] text-[#FFB347]/75">Fee</Text>
                  <Text className="text-[13px] text-[#FFF7ED]">
                    {moneyFormat(Number(successQuote?.fee_amount) || 0, 'USD')}
                  </Text>
                </View>
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-[12px] text-[#FFB347]/75">Bridge balance</Text>
                  <Text className="text-[13px] text-[#FFF7ED]">
                    {moneyFormat(Number(successNgnWallet?.balance) || 0, 'NGN')}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          <View className={`${tunnelCard} mt-5 px-5 py-5`}>
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="text-[11px] uppercase tracking-[2px] text-[#FFB347]/80">Live quote</Text>
                <Text className="mt-2 text-[22px] font-semibold text-[#FFF7ED]">
                  {quoteLoading
                    ? 'Refreshing quote'
                    : quote
                      ? moneyFormat(Number(amountOut) || 0, 'NGN')
                      : 'Convert back to NGN'}
                </Text>
                <Text className="mt-1 text-[13px] text-[#FFF4E6]/75">
                  {quoteLoading
                    ? 'Fetching the latest execution rate.'
                    : quote
                      ? 'Amount you will receive back in Bridge.'
                      : 'Enter a USD amount to fetch a live rate.'}
                </Text>
              </View>
              <View className="rounded-full border border-[#5B3A14] bg-[#FF8A1F]/10 px-3 py-2">
                <Text className="text-[11px] font-medium text-[#FFB347]">USD -> NGN</Text>
              </View>
            </View>

            <View className={`${tunnelSubCard} mt-5 px-4 py-4`}>
              <View className="flex-row items-center justify-between">
                <Text className="text-[12px] text-[#FFB347]/75">Fee</Text>
                <Text className="text-[13px] text-[#FFF7ED]">
                  {moneyFormat(Number(feeAmount) || 0, 'USD')}
                </Text>
              </View>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-[12px] text-[#FFB347]/75">Amount after fee</Text>
                <Text className="text-[13px] text-[#FFF7ED]">
                  {moneyFormat(Number(amountAfterFee) || 0, 'USD')}
                </Text>
              </View>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-[12px] text-[#FFB347]/75">Rate</Text>
                <Text className="text-[13px] text-[#FFF7ED]">
                  1 USD = {Number(executionRate || 0).toFixed(2)} NGN
                </Text>
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
            className={`${canConvert ? 'bg-[#FF8A1F]' : 'bg-[#5B3A14]'} mb-6 mt-5 rounded-[20px] py-5`}
            disabled={!canConvert}
          >
            <Text className="text-center text-[15px] font-semibold text-[#FFF7ED]">
              {quoteLoading ? 'Refreshing quote...' : 'Convert to NGN'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handleConvert}
        loading={loading}
        errorMessage={pinError}
        title="Enter PIN to Convert"
      />

      <Loader open={loading} />
    </View>
  )
}

export default ConvertUsdToNgnScreen



