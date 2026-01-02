import React, { useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import { convertTunnelNgnToUsd, quoteTunnelNgnToUsd } from '@/api/wallet'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { apiErrorMessage } from '@/utils/apiErrorMessage'

const ConvertNgnToUsdScreen = () => {
  const router = useRouter()
  const { onLogout, loadProfile } = useAuth()

  const [loading, setLoading] = useState(false)
  const [amountNgn, setAmountNgn] = useState('')
  const [quoteData, setQuoteData] = useState<any | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [notice, setNotice] = useState({
    message: null,
    error: false,
    data: null,
  })

  const amountValue = useMemo(() => Number(amountNgn), [amountNgn])
  const quote = quoteData?.data ?? quoteData

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

  const handleQuote = async () => {
    if (!amountValue || Number.isNaN(amountValue) || amountValue <= 0) {
      setNotice({ message: 'Enter a valid NGN amount.', error: true, data: null })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    setPinError(null)

    try {
      const response = await quoteTunnelNgnToUsd(amountValue)
      setQuoteData(response)
      setNotice({
        message: response?.message || 'Quote ready.',
        error: false,
        data: response?.data || null,
      })
    } catch (error: any) {
      await handleError(error)
    } finally {
      setLoading(false)
    }
  }

  const handleConvert = async (pin: string) => {
    if (!quoteData) {
      setNotice({ message: 'Get a quote first.', error: true, data: null })
      return
    }

    setLoading(true)
    setPinError(null)
    try {
      const response = await convertTunnelNgnToUsd(amountValue, pin)
      setPinModalOpen(false)
      setNotice({
        message: response?.message || 'Conversion successful.',
        error: false,
        data: response?.data || null,
      })
      setQuoteData(null)
      loadProfile({ force: true })
    } catch (error: any) {
      await handleError(error, { forPin: true })
    } finally {
      setLoading(false)
    }
  }

  const amountUsd =
    quote?.amount_usd ?? quote?.usd_amount ?? quote?.converted_amount ?? quote?.amount
  const rate = quote?.rate ?? quote?.exchange_rate
  const fee = quote?.fee ?? quote?.fees

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

          {!!quote && (
            <View className="bg-gray-900 rounded-xl p-4 mt-4">
              <Text className="text-white mb-2">Quote Preview</Text>
              <Text className="text-gray-300">
                You pay: {moneyFormat(amountValue || 0, 'NGN')}
              </Text>
              {amountUsd !== undefined && amountUsd !== null && (
                <Text className="text-alt">
                  You receive: {moneyFormat(Number(amountUsd) || 0, 'USD')}
                </Text>
              )}
              {rate !== undefined && rate !== null && (
                <Text className="text-gray-300">Rate: {rate}</Text>
              )}
              {fee !== undefined && fee !== null && (
                <Text className="text-gray-300">Fee: {fee}</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            onPress={handleQuote}
            className="bg-theme-primary py-6 mt-8 rounded-xl"
          >
            <Text className="text-alt font-medium text-center">Get Quote</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPinModalOpen(true)}
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
