import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { initiateMonnifyTransaction } from '@/api/transactions'
import { createFundingIntent, getFundingIntent, type FundingIntentResponse } from '@/api/funding'
import Loader from '@/components/Loader'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { useAnchorOnboarding } from '@/services/useAnchorOnboarding'
import ScreenContainer from '@/components/ScreenContainer'

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
  const anchorState = useAnchorOnboarding({ autoFetchOnMount: true, autoFetchOnFocus: false })

  const [loading, setLoading] = useState(false)
  const [method, setMethod] = useState<FundMethod>('monnify')
  const [anchorIntent, setAnchorIntent] = useState<AnchorIntentState | null>(null)
  const [now, setNow] = useState(Date.now())
  const [formData, setFormData] = useState({
    amount: '',
    coupon_code: '',
  })
  const creditedNavigatedRef = useRef(false)
  const [notice, setNotice] = useState<{ message: string | null; error: boolean; data: unknown }>({
    message: null,
    error: false,
    data: null,
  })
  const shouldBypassPooledFunding = anchorState.isHydrated && (anchorState.depositReady || anchorState.hasAccountNumber)

  const expiryDate = useMemo(() => resolveExpiryDate(anchorIntent?.expiryTime), [anchorIntent?.expiryTime])
  const countdown = useMemo(() => {
    if (!expiryDate) return null
    return formatCountdown(expiryDate.getTime() - now)
  }, [expiryDate, now])

  const anchorStatus = String(anchorIntent?.status || '').toLowerCase() as FundingIntentResponse['status'] | ''
  const hasActiveAnchorIntent = method === 'anchor' && !!anchorIntent?.id && !!anchorIntent?.accountNumber
  const isAnchorWaiting = hasActiveAnchorIntent && ['pending', 'detected'].includes(anchorStatus)
  const isAnchorCredited = hasActiveAnchorIntent && anchorStatus === 'credited'
  const isAnchorExpired = hasActiveAnchorIntent && ['expired', 'cancelled'].includes(anchorStatus)
  const lockAnchorForm = hasActiveAnchorIntent && !isAnchorExpired

  useEffect(() => {
    if (!expiryDate) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiryDate])

  useEffect(() => {
    if (!shouldBypassPooledFunding) return
    router.replace('/anchor-account')
  }, [router, shouldBypassPooledFunding])

  useEffect(() => {
    const currentIntentId = String(anchorIntent?.id || '').trim()
    const status = anchorIntent?.status
    if (!currentIntentId || !status || !['pending', 'detected'].includes(status)) return

    const poller = setInterval(async () => {
      try {
        const latest = await getFundingIntent(currentIntentId)
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

  useEffect(() => {
    if (!isAnchorCredited || creditedNavigatedRef.current) return
    const reference = String(anchorIntent?.paymentReference || '').trim()
    if (!reference) return

    creditedNavigatedRef.current = true
    router.push({ pathname: '/transaction/receipt', params: { reference } } as never)
  }, [anchorIntent?.paymentReference, isAnchorCredited, router])

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

      creditedNavigatedRef.current = false
      setNotice({ message: 'Transfer details generated. Complete transfer with the reference.', error: false, data: null })
    } catch (error: unknown) {
      setNotice({ message: (error instanceof Error && error.message) || 'Something went wrong', error: true, data: null })
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
    const currentIntentId = String(anchorIntent?.id || '').trim()
    if (!currentIntentId) return

    setLoading(true)
    try {
      const latest = await getFundingIntent(currentIntentId)
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
    } catch (error: unknown) {
      setNotice({ message: (error instanceof Error && error.message) || 'Unable to refresh status', error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  const statusToneClass = notice.error ? 'border-red-500 bg-red-950' : 'border-green-500 bg-green-950'

  if (!anchorState.isHydrated || anchorState.loading) {
    return <Loader />
  }

  if (shouldBypassPooledFunding) {
    return <Loader />
  }

  return (
    <ScreenContainer
      scroll={false}
      includeTopInset={false}
      includeTabBarPadding={false}
      horizontalPadding={16}
      topPadding={0}
      bottomPadding={16}
      className="flex-1 bg-primary"
    >
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-6 h-full">
          <Text className="text-white text-lg font-semibold mb-3">Choose Funding Method</Text>

          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity
              disabled={lockAnchorForm}
              onPress={() => setMethod('monnify')}
              className={`flex-1 rounded-xl border p-3 ${method === 'monnify' ? 'border-theme-primary bg-[#0e1a33]' : 'border-gray-700'} ${lockAnchorForm ? 'opacity-60' : ''}`}
            >
              <Text className="text-white font-semibold">Card/Checkout (Monnify)</Text>
              <Text className="text-gray-300 text-xs mt-1">Redirect to secure checkout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={lockAnchorForm}
              onPress={() => setMethod('anchor')}
              className={`flex-1 rounded-xl border p-3 ${method === 'anchor' ? 'border-theme-primary bg-[#0e1a33]' : 'border-gray-700'} ${lockAnchorForm ? 'opacity-60' : ''}`}
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
            editable={!lockAnchorForm}
            onChangeText={(text: string) => setFormData({ ...formData, amount: text })}
          />

          <FormInput
            label="Coupon (optional)"
            name="coupon_code"
            value={formData.coupon_code}
            editable={!lockAnchorForm}
            onChangeText={(text: string) => setFormData({ ...formData, coupon_code: text })}
          />

          {notice.message ? (
            <View className={`mt-4 rounded-xl border p-3 ${statusToneClass}`}>
              <Text className={`${notice.error ? 'text-red-200' : 'text-green-100'} text-center`}>{notice.message}</Text>
            </View>
          ) : null}

          {method === 'monnify' ? (
            <TouchableOpacity onPress={handleSubmit} className="bg-theme-primary py-4 mt-6 rounded-xl">
              <Text className="text-alt font-medium text-center">Continue to Checkout</Text>
            </TouchableOpacity>
          ) : null}

          {method === 'anchor' && !hasActiveAnchorIntent ? (
            <TouchableOpacity onPress={handleSubmit} className="bg-theme-primary py-4 mt-6 rounded-xl">
              <Text className="text-alt font-medium text-center">Generate Transfer Details</Text>
            </TouchableOpacity>
          ) : null}

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

              {isAnchorWaiting ? (
                <TouchableOpacity onPress={handleIHaveSentTransfer} className="bg-theme-primary py-3 rounded-xl mt-3">
                  <Text className="text-alt text-center font-medium">I&apos;ve sent the transfer</Text>
                </TouchableOpacity>
              ) : null}

              {isAnchorCredited ? (
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/receipt',
                      params: { reference: String(anchorIntent.paymentReference || '') },
                    } as never)
                  }
                  className="bg-green-600 py-3 rounded-xl mt-3"
                >
                  <Text className="text-white text-center font-medium">View Receipt</Text>
                </TouchableOpacity>
              ) : null}

              {isAnchorExpired ? (
                <TouchableOpacity
                  onPress={() => {
                    setAnchorIntent(null)
                    creditedNavigatedRef.current = false
                    setNotice({ message: 'Reference expired. Generate a new transfer reference.', error: true, data: null })
                  }}
                  className="border border-theme-primary py-3 rounded-xl mt-3"
                >
                  <Text className="text-theme-primary text-center font-medium">Generate New Reference</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {String(returnTo || '').trim() ? (
            <TouchableOpacity
              onPress={() =>
                router.replace({
                  pathname: String(returnTo) as never,
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
    </ScreenContainer>
  )
}

export default FundWalletScreen


