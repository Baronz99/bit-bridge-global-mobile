import React, { useEffect, useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import { convertTunnelNgnToUsd, quoteTunnelNgnToUsd } from '@/api/wallet'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { apiErrorMessage } from '@/utils/apiErrorMessage'

const ConvertNgnToUsdScreen = () => {
  const router = useRouter()
  const { onLogout, loadProfile } = useAuth()

  const [loading, setLoading] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [amountNgn, setAmountNgn] = useState('')
  const [quoteData, setQuoteData] = useState<any | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  type NoticeState = { message: string | null; error: boolean; data: any | null }
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  const amountValue = useMemo(() => Number(amountNgn), [amountNgn])
  const quote = quoteData

  const handleError = async (error: any, options?: { forPin?: boolean }) => {
    const status = error?.response?.status
    if (status === 401) {
      await onLogout()
      router.replace('/login')
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
    const value = Number(amountNgn)
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
        console.log('[TunnelFX] quote NGN->USD start')
        const response = await quoteTunnelNgnToUsd(value)
        if (!active) return
        setQuoteData(response)
        console.log('[TunnelFX] quote NGN->USD success')
        setNotice({ message: null, error: false, data: null })
      } catch (error: any) {
        if (!active) return
        console.log('[TunnelFX] quote NGN->USD failed', {
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
  }, [amountNgn])

  const handleConvert = async (transactionPin: string) => {
    if (!quoteData) {
      setNotice({ message: 'Get a quote first.', error: true, data: null })
      return
    }

    setLoading(true)
    setPinError(null)
    try {
      console.log('[TunnelFX] convert NGN->USD start')
      const response = await convertTunnelNgnToUsd(amountValue, transactionPin, quote?.quote_token)
      setPinModalOpen(false)
      console.log('[TunnelFX] convert NGN->USD success')
      setNotice({
        message: response?.message || 'Conversion successful.',
        error: false,
        data: response?.data || null,
      })
      setQuoteData(null)
      loadProfile({ force: true })
    } catch (error: any) {
      console.log('[TunnelFX] convert NGN->USD failed', {
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

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-10">
          <FormInput
            label="Amount (NGN)"
            value={amountNgn}
            name="amount_ngn"
            keyboardType="numeric"
            onChangeText={(text: string) => setAmountNgn(text)}
          />

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <View className="bg-gray-900 rounded-xl p-4 mt-4">
            <Text className="text-white mb-2">Live quote</Text>
            {quoteLoading ? (
              <Text className="text-gray-400">Fetching live rate...</Text>
            ) : quote ? (
              <>
                <Text className="text-gray-300">
                  Conversion fee (1%): - {moneyFormat(Number(feeAmount) || 0, 'NGN')}
                </Text>
                <Text className="text-gray-300">
                  Amount we&apos;ll convert: = {moneyFormat(Number(amountAfterFee) || 0, 'NGN')}
                </Text>
                <Text className="text-gray-300">
                  Today&apos;s rate: 1 USD = {Number(executionRate || 0).toFixed(2)} NGN
                </Text>
                <Text className="text-alt">
                  Amount you&apos;ll receive: {moneyFormat(Number(amountOut) || 0, 'USD')}
                </Text>
              </>
            ) : (
              <Text className="text-gray-400">Enter an amount to see the quote.</Text>
            )}
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
            className={`${quote ? 'bg-gray-900' : 'bg-gray-700'} py-6 mt-4 rounded-xl`}
            disabled={!quote}
          >
            <Text className="text-white font-medium text-center">Convert to USD</Text>
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

export default ConvertNgnToUsdScreen
