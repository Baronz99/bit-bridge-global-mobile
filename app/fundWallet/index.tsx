import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { initiateMonnifyTransaction } from '@/api/transactions'
import { createFundingIntent, getFundingIntent, type FundingIntentResponse } from '@/api/funding'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'

type FundMethod = 'monnify' | 'anchor'

type AnchorIntentState = {
  id?: string
  paymentReference?: string
  bankName?: string
  accountNumber?: string
  accountName?: string
  instructions?: string
  expiryTime?: string | number
  status?: FundingIntentResponse['status']
  creditedTransactionId?: string | null
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
  const [anchorIntent, setAnchorIntent] = useState<AnchorIntentState | null>(null)
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

  const expiryDate = useMemo(() => resolveExpiryDate(anchorIntent?.expiryTime), [anchorIntent?.expiryTime])
  const countdown = useMemo(() => {
    if (!expiryDate) return null
    return formatCountdown(expiryDate.getTime() - now)
  }, [expiryDate, now])

  useEffect(() => {
    if (!expiryDate) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiryDate])

  useEffect(() => {
    const intentId = String(anchorIntent?.id || '').trim()
    const status = anchorIntent?.status
    if (!intentId || !status || !['pending', 'detected'].includes(status)) return

    const poller = setInterval(async () => {
      try {
        const latest = await getFundingIntent(intentId)
        setAnchorIntent((prev) => ({
          ...(prev || {}),
          id: latest.id,
          paymentReference: latest.reference,
          bankName: latest.account?.bank_name,
          accountName: latest.account?.account_name,
          accountNumber: latest.account?.account_number,
          instructions: latest.account?.instructions,
          expiryTime: latest.expires_at,
          status: latest.status,
          creditedTransactionId: latest.credited_transaction_id || null,
        }))

        if (latest.status === 'credited') {
          await loadProfile({ force: true })
          setNotice({ message: 'Wallet credited successfully.', error: false, data: null })
        }
      } catch {
        // silent poll retry
      }
    }, 10000)

    return () => clearInterval(poller)
  }, [anchorIntent?.id, anchorIntent?.status, loadProfile])

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

      const amountCents = Math.round(amount * 100)
      const response = await createFundingIntent({
        provider: 'anchor',
        amount_cents: amountCents,
      })

      setAnchorIntent({
        id: response.id,
        paymentReference: response.reference,
        bankName: response.account?.bank_name,
        accountNumber: response.account?.account_number,
        accountName: response.account?.account_name,
        instructions: response.account?.instructions,
        expiryTime: response.expires_at,
        status: response.status,
        creditedTransactionId: response.credited_transaction_id || null,
      })

      setNotice({ message: 'Transfer details generated. Complete transfer with the reference.', error: false, data: null })
    } catch (error: any) {
      setNotice({ message: error?.message || 'Something went wrong', error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyAccountNumber = async () => {
    const accountNumber = String(anchorIntent?.accountNumber || '').trim()
    if (!accountNumber) return

    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(accountNumber)
      Alert.alert('Copied', 'Account number copied')
    } catch {
      Alert.alert('Copy failed', 'Unable to copy account number')
    }
  }

  const handleCopyReference = async () => {
    const reference = String(anchorIntent?.paymentReference || '').trim()
    if (!reference) return

    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(reference)
      Alert.alert('Copied', 'Reference copied')
    } catch {
      Alert.alert('Copy failed', 'Unable to copy reference')
    }
  }

  const handleIHaveSentTransfer = async () => {
    const intentId = String(anchorIntent?.id || '').trim()
    if (!intentId) return

    setLoading(true)
    try {
      const latest = await getFundingIntent(intentId)
      setAnchorIntent((prev) => ({
        ...(prev || {}),
        id: latest.id,
        paymentReference: latest.reference,
        bankName: latest.account?.bank_name,
        accountName: latest.account?.account_name,
        accountNumber: latest.account?.account_number,
        instructions: latest.account?.instructions,
        expiryTime: latest.expires_at,
        status: latest.status,
        creditedTransactionId: latest.credited_transaction_id || null,
      }))

      await loadProfile({ force: true })

      if (latest.status === 'credited') {
        setNotice({ message: 'Payment received and wallet credited.', error: false, data: null })
      } else {
        setNotice({ message: `Current status: ${latest.status}. We will keep checking automatically.`, error: false, data: null })
      }
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
              <Text className="text-gray-300 text-xs mt-1">Use pooled transfer account</Text>
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
              {method === 'monnify' ? 'Continue to Checkout' : 'Generate Transfer Details'}
            </Text>
          </TouchableOpacity>

          {method === 'anchor' && anchorIntent?.accountNumber ? (
            <View className="border border-gray-700 rounded-xl p-4 mt-5">
              <Text className="text-white font-semibold mb-3">Anchor Transfer Details</Text>
              <Text className="text-gray-300">Bank: <Text className="text-white">{anchorIntent.bankName || '--'}</Text></Text>
              <Text className="text-gray-300 mt-1">Account Name: <Text className="text-white">{anchorIntent.accountName || '--'}</Text></Text>
              <Text className="text-gray-300 mt-1">Account Number: <Text className="text-white">{anchorIntent.accountNumber}</Text></Text>
              <Text className="text-gray-300 mt-1">Reference: <Text className="text-white">{anchorIntent.paymentReference || '--'}</Text></Text>
              <Text className="text-gray-300 mt-1">Status: <Text className="text-white">{anchorIntent.status || 'pending'}</Text></Text>
              {countdown ? (
                <Text className="text-gray-300 mt-1">Expires In: <Text className="text-white">{countdown}</Text></Text>
              ) : null}
              {anchorIntent.instructions ? (
                <Text className="text-gray-400 mt-2 text-xs">{anchorIntent.instructions}</Text>
              ) : null}

              <View className="flex-row gap-2 mt-4">
                <TouchableOpacity onPress={handleCopyAccountNumber} className="border border-theme-primary py-3 rounded-xl flex-1">
                  <Text className="text-theme-primary text-center font-medium">Copy Account</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleCopyReference} className="border border-theme-primary py-3 rounded-xl flex-1">
                  <Text className="text-theme-primary text-center font-medium">Copy Reference</Text>
                </TouchableOpacity>
              </View>

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
