import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { initializeTransaction, initiateMonnifyTransaction } from '@/api/transactions'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'

type FundMethod = 'monnify' | 'anchor'

type AnchorInitState = {
  paymentReference?: string
  providerReference?: string
  bankName?: string
  accountNumber?: string
  accountName?: string
  expiryTime?: string | number
}

const resolveExpiryDate = (raw: string | number | undefined): Date | null => {
  if (raw === undefined || raw === null || raw === '') return null

  if (typeof raw === 'number') {
    if (raw > 1_000_000_000_000) return new Date(raw)
    if (raw > 1_000_000_000) return new Date(raw * 1000)
    if (raw > 0) return new Date(Date.now() + raw * 1000)
    return null
  }

  const asNumber = Number(raw)
  if (!Number.isNaN(asNumber)) {
    if (asNumber > 1_000_000_000_000) return new Date(asNumber)
    if (asNumber > 1_000_000_000) return new Date(asNumber * 1000)
    if (asNumber > 0) return new Date(Date.now() + asNumber * 1000)
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const formatCountdown = (ms: number) => {
  if (ms <= 0) return 'Expired'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const FundWalletScreen = () => {
  const router = useRouter()
  const { returnTo, orderId, id, intentId } = useLocalSearchParams()
  const { userProfileData, loadProfile } = useAuth()

  const [loading, setLoading] = useState(false)
  const [method, setMethod] = useState<FundMethod>('monnify')
  const [anchorInit, setAnchorInit] = useState<AnchorInitState | null>(null)
  const [now, setNow] = useState(Date.now())
  const [formData, setFormData] = useState({
    amount: '',
    coupon_code: '',
  })
  const [notice, setNotice] = useState<{ message: string | null; error: boolean; data: any }>({
    message: null,
    error: false,
    data: null,
  })

  const expiryDate = useMemo(() => resolveExpiryDate(anchorInit?.expiryTime), [anchorInit?.expiryTime])
  const countdown = useMemo(() => {
    if (!expiryDate) return null
    return formatCountdown(expiryDate.getTime() - now)
  }, [expiryDate, now])

  useEffect(() => {
    if (!expiryDate) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiryDate])

  const parseAmount = () => {
    const normalized = Number(String(formData.amount || '').replace(/,/g, '').trim())
    return Number.isFinite(normalized) ? normalized : 0
  }

  const handleSubmit = async () => {
    const amount = parseAmount()
    if (amount <= 0) {
      setNotice({ message: 'Enter a valid amount', error: true, data: null })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })

    try {
      const payload = {
        amount,
        coupon_code: formData.coupon_code,
        status: 'initialized',
        email: userProfileData?.email,
        transaction_type: 'deposit',
        customer_name: userProfileData?.email,
        description: 'fund wallet',
      }

      if (method === 'monnify') {
        const response = await initiateMonnifyTransaction({
          data: {
            ...payload,
            provider: 'monnify',
          },
        })

        const checkoutUrl = response?.responseBody?.checkoutUrl
        if (!checkoutUrl) throw new Error('Checkout URL was not returned by provider')

        setLoading(false)
        loadProfile({ force: true })
        await Linking.openURL(checkoutUrl)
        return
      }

      const response = await initializeTransaction({
        data: {
          ...payload,
          provider: 'anchor',
          expiry_time: 3600,
        },
      })

      const details = response?.responseBody || {}
      setAnchorInit({
        paymentReference: details.paymentReference,
        providerReference: details.providerReference,
        bankName: details.bankName,
        accountNumber: details.accountNumber,
        accountName: details.accountName,
        expiryTime: details.expiryTime,
      })

      loadProfile({ force: true })
      setNotice({ message: 'Transfer account generated. Complete transfer and refresh.', error: false, data: null })
    } catch (error: any) {
      setNotice({ message: error?.message || 'Something went wrong', error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyAccountNumber = async () => {
    const accountNumber = String(anchorInit?.accountNumber || '').trim()
    if (!accountNumber) return

    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(accountNumber)
      Alert.alert('Copied', 'Account number copied')
    } catch {
      Alert.alert('Copy failed', 'Unable to copy account number')
    }
  }

  const handleIHaveSentTransfer = async () => {
    setLoading(true)
    try {
      await loadProfile({ force: true })
      setNotice({ message: 'Wallet refreshed. Check timeline/wallet for settlement.', error: false, data: null })
    } catch (error: any) {
      setNotice({ message: error?.message || 'Unable to refresh status', error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-6 h-full">
          <Text className="text-white text-lg font-semibold mb-3">Choose Funding Method</Text>

          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity
              onPress={() => setMethod('monnify')}
              className={`flex-1 rounded-xl border p-3 ${method === 'monnify' ? 'border-theme-primary bg-[#0e1a33]' : 'border-gray-700'}`}
            >
              <Text className="text-white font-semibold">Card/Checkout (Monnify)</Text>
              <Text className="text-gray-300 text-xs mt-1">Redirect to secure checkout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMethod('anchor')}
              className={`flex-1 rounded-xl border p-3 ${method === 'anchor' ? 'border-theme-primary bg-[#0e1a33]' : 'border-gray-700'}`}
            >
              <Text className="text-white font-semibold">Bank Transfer (Anchor)</Text>
              <Text className="text-gray-300 text-xs mt-1">Get dedicated transfer account</Text>
            </TouchableOpacity>
          </View>

          <FormInput
            label="Amount"
            value={formData.amount}
            name="amount"
            keyboardType="numeric"
            onChangeText={(text: string) => setFormData({ ...formData, amount: text })}
          />

          <FormInput
            label="Coupon (optional)"
            name="coupon_code"
            value={formData.coupon_code}
            onChangeText={(text: string) => setFormData({ ...formData, coupon_code: text })}
          />

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <TouchableOpacity onPress={handleSubmit} className="bg-theme-primary py-4 mt-6 rounded-xl">
            <Text className="text-alt font-medium text-center">
              {method === 'monnify' ? 'Continue to Checkout' : 'Generate Transfer Account'}
            </Text>
          </TouchableOpacity>

          {method === 'anchor' && anchorInit?.accountNumber ? (
            <View className="border border-gray-700 rounded-xl p-4 mt-5">
              <Text className="text-white font-semibold mb-3">Anchor Transfer Details</Text>
              <Text className="text-gray-300">Bank: <Text className="text-white">{anchorInit.bankName || '--'}</Text></Text>
              <Text className="text-gray-300 mt-1">Account Name: <Text className="text-white">{anchorInit.accountName || '--'}</Text></Text>
              <Text className="text-gray-300 mt-1">Account Number: <Text className="text-white">{anchorInit.accountNumber}</Text></Text>
              <Text className="text-gray-300 mt-1">Reference: <Text className="text-white">{anchorInit.paymentReference || '--'}</Text></Text>
              {countdown ? (
                <Text className="text-gray-300 mt-1">Expires In: <Text className="text-white">{countdown}</Text></Text>
              ) : null}

              <TouchableOpacity onPress={handleCopyAccountNumber} className="border border-theme-primary py-3 rounded-xl mt-4">
                <Text className="text-theme-primary text-center font-medium">Copy Account Number</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleIHaveSentTransfer} className="bg-theme-primary py-3 rounded-xl mt-3">
                <Text className="text-alt text-center font-medium">I've sent the transfer</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {String(returnTo || '').trim() ? (
            <TouchableOpacity
              onPress={() =>
                router.replace({
                  pathname: String(returnTo) as any,
                  params: {
                    id: String(id || ''),
                    orderId: String(orderId || ''),
                    intentId: String(intentId || ''),
                    resume: '1',
                  },
                })
              }
              className="border border-gray-700 py-4 rounded-xl mt-6"
            >
              <Text className="text-gray-300 font-medium text-center">I have funded wallet, continue</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidWrapper>
      <Loader open={loading} />
    </View>
  )
}

export default FundWalletScreen
