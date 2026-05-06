import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import TransactionPinModal from '@/components/TransactionPinModal'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import {
  convertTunnelNgnToUsd,
  convertTunnelUsdToNgn,
  getWallet,
  quoteTunnelNgnToUsd,
  quoteTunnelUsdToNgn,
} from '@/api/wallet'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import { useActiveAccount } from '@/services/useActiveAccount'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'
import useFetch from '@/services/useFetch'
import moneyFormat from '@/utils/moneyFormat'
import { apiErrorMessage } from '@/utils/apiErrorMessage'
import { error as logError, log } from '@/utils/logger'
import FXActivationState from './components/FXActivationState'
import FXAmountInput from './components/FXAmountInput'
import FXConfirmSheet from './components/FXConfirmSheet'
import FXQuoteCard from './components/FXQuoteCard'
import FXRailHeader from './components/FXRailHeader'
import FXSuccessReceipt from './components/FXSuccessReceipt'
import { Direction, WalletShape, directionConfig, fxCardClass, resolveDirection } from '@/utils/fxConfig'

type NoticeState = {
  message: string | null
  error: boolean
  data: any | null
}

export default function FXScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ direction?: string }>()
  const initialDirection = useMemo(() => resolveDirection(params.direction), [params.direction])
  const [direction, setDirection] = useState<Direction>(initialDirection)

  useEffect(() => {
    setDirection(initialDirection)
  }, [initialDirection])

  const { loadProfile, userProfileData } = useAuth()
  const { activeAccount } = useActiveAccount()
  const isCircleAccount = activeAccount?.type === 'circle'
  const isBusinessAccount = activeAccount?.type === 'business'
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))

  const [loading, setLoading] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [quoteData, setQuoteData] = useState<any | null>(null)
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<number | null>(null)
  const [quoteClock, setQuoteClock] = useState(Date.now())
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
  const { data: walletData, loading: walletLoading, error: walletError } = useFetch(() => getWallet(activeAccount), {
    autoFetch: true,
    queryKey: ['wallet', activeAccount],
  })

  const switchAnim = useRef(new Animated.Value(0)).current
  const heroFade = useRef(new Animated.Value(0)).current
  const quotePulse = useRef(new Animated.Value(0.985)).current

  useEffect(() => {
    Animated.timing(heroFade, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start()
  }, [heroFade])

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(switchAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(switchAnim, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [switchAnim])

  useEffect(() => {
    Animated.sequence([
      Animated.timing(quotePulse, { toValue: 1.01, duration: 160, useNativeDriver: true }),
      Animated.timing(quotePulse, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start()
  }, [quotePulse, quoteData])

  useEffect(() => {
    if (!quoteUpdatedAt) return
    const interval = setInterval(() => setQuoteClock(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [quoteUpdatedAt])

  const copy = directionConfig[direction]
  const amountValue = useMemo(() => Number(amountInput), [amountInput])
  const quote = quoteData
  const walletPayload = (walletData as WalletShape | null | undefined)?.data ?? (walletData as WalletShape | null | undefined)
  const bridgeWallet = walletPayload?.bridge ?? walletPayload?.data?.bridge ?? null
  const tunnelWallet = walletPayload?.tunnel ?? walletPayload?.data?.tunnel ?? null
  const tunnelActivated = Boolean(tunnelWallet)
  const bridgeBalanceValue = Number(bridgeWallet?.balance ?? bridgeWallet?.amount ?? 0)
  const tunnelBalanceValue = Number(tunnelWallet?.balance ?? tunnelWallet?.amount ?? 0)
  const sourceBalanceValue = direction === 'ngn_to_usd' ? bridgeBalanceValue : tunnelBalanceValue
  const destinationBalanceValue = direction === 'ngn_to_usd' ? tunnelBalanceValue : bridgeBalanceValue
  const sourceBalanceLabel = moneyFormat(sourceBalanceValue, copy.sourceCurrency)
  const destinationBalanceLabel = tunnelActivated
    ? moneyFormat(destinationBalanceValue, copy.destinationCurrency)
    : direction === 'ngn_to_usd'
      ? 'Activate Tunnel to receive USD'
      : 'Activate Tunnel to move USD'
  const walletErrorMessage = walletError
    ? apiErrorMessage({
        status: (walletError as any)?.response?.status,
        data: (walletError as any)?.response?.data,
        fallback: (walletError as any)?.message || 'Unable to load wallet balances.',
      })
    : null

  const receiveAmountLabel = quote ? moneyFormat(Number(quote?.amount_out) || 0, copy.destinationCurrency) : null
  const payAmountLabel = amountValue > 0 ? moneyFormat(amountValue, copy.sourceCurrency) : moneyFormat(0, copy.sourceCurrency)
  const freshnessSeconds = quoteUpdatedAt ? Math.max(0, Math.floor((quoteClock - quoteUpdatedAt) / 1000)) : null
  const freshnessLabel = quote && freshnessSeconds !== null ? `Live rate • updated ${freshnessSeconds}s ago` : null

  const handleError = async (error: any, options?: { forPin?: boolean }) => {
    const status = error?.response?.status
    if (status === 401) return

    const data = error?.response?.data
    const message = apiErrorMessage({
      status,
      data,
      fallback: error?.message || 'Something went wrong',
    })

    if (options?.forPin) setPinError(message)
    else setNotice({ message, error: true, data: null })
  }

  useEffect(() => {
    const value = Number(amountInput)
    if (!value || Number.isNaN(value) || value <= 0 || !tunnelActivated) {
      setQuoteData(null)
      setQuoteLoading(false)
      setQuoteUpdatedAt(null)
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setQuoteLoading(true)
      setPinError(null)
      try {
        log('[TunnelFX] quote start', { direction })
        const response =
          direction === 'ngn_to_usd'
            ? await quoteTunnelNgnToUsd(value)
            : await quoteTunnelUsdToNgn(value)
        if (!active) return
        setQuoteData(response)
        setQuoteUpdatedAt(Date.now())
        log('[TunnelFX] quote success', { direction })
        setNotice({ message: null, error: false, data: null })
      } catch (error: any) {
        if (!active) return
        log('[TunnelFX] quote failed', { direction, status: error?.response?.status })
        await handleError(error)
      } finally {
        if (active) setQuoteLoading(false)
      }
    }, 450)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [amountInput, direction, tunnelActivated])

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
      log('[TunnelFX] convert start', { direction })
      const response =
        direction === 'ngn_to_usd'
          ? await convertTunnelNgnToUsd(
              amountValue,
              String(credential.transaction_pin || credential.biometric_approval_token || ''),
              quote?.quote_token
            )
          : await convertTunnelUsdToNgn(
              amountValue,
              String(credential.transaction_pin || credential.biometric_approval_token || ''),
              quote?.quote_token
            )
      setPinModalOpen(false)
      setConfirmOpen(false)
      log('[TunnelFX] convert success', { direction })
      setNotice({
        message: response?.message || 'Conversion successful.',
        error: false,
        data: response?.data || null,
      })
      setQuoteData(null)
      setQuoteUpdatedAt(null)
      if (credential.transaction_pin) {
        try {
          const enrollmentResult = await transactionBiometrics.maybeEnrollAfterPinSuccess(credential.transaction_pin)
          if (enrollmentResult.status === 'enrolled') {
            setNotice({
              message: 'Conversion successful. Face ID / Fingerprint is now enabled for future transfer confirmations on this device.',
              error: false,
              data: response?.data || null,
            })
          } else if (enrollmentResult.status === 'skipped') {
            setNotice({
              message: 'Conversion successful. Set up device biometrics to enable faster transfer confirmations next time.',
              error: false,
              data: response?.data || null,
            })
          }
        } catch (enrollmentError: any) {
          logError('[TUNNEL_FX][BIOMETRIC] enrollment failed after success', enrollmentError)
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
      log('[TunnelFX] convert failed', { direction, status: error?.response?.status })
      await handleError(error, { forPin: true })
    } finally {
      setLoading(false)
    }
  }

  const handleConvert = async (transactionPin: string) => handleConvertWithCredential({ transaction_pin: transactionPin })

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

  const openPinStep = async () => {
    try {
      const status = await getTransactionPinStatus()
      const payload = status?.data ?? status
      const hasPin = payload?.has_pin === true || payload?.status === 'set' || payload?.pin_set === true
      if (!hasPin) {
        setNotice({ message: 'Set your transaction PIN to continue.', error: true, data: null })
        setConfirmOpen(false)
        router.push('/settings/pin/set')
        return
      }
      setConfirmOpen(false)
      setPinModalOpen(true)
    } catch (error: any) {
      await handleError(error)
    }
  }

  const feeAmount = quote?.fee_amount
  const amountAfterFee = quote?.amount_after_fee
  const executionRate = quote?.execution_rate
  const successQuote = notice.data?.quote
  const successWallet = direction === 'ngn_to_usd' ? notice.data?.usd_wallet : notice.data?.ngn_wallet
  const canConvert = Boolean(quote) && !quoteLoading && tunnelActivated
  const showSuccess = Boolean(notice.message && !notice.error && notice.data)
  const showActivationState = !tunnelActivated
  const quoteState = showActivationState ? 'activation_required' : quoteLoading ? 'loading' : quote ? 'ready' : 'idle'
  const receiptReference = String(
    notice.data?.reference ?? notice.data?.transaction_reference ?? notice.data?.transfer_reference ?? ''
  ).trim() || null

  const handleSwitch = () => {
    Animated.sequence([
      Animated.timing(switchAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(switchAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setDirection((current) => (current === 'ngn_to_usd' ? 'usd_to_ngn' : 'ngn_to_usd'))
      setAmountInput('')
      setQuoteData(null)
      setQuoteUpdatedAt(null)
      setNotice({ message: null, error: false, data: null })
      setPinError(null)
      setConfirmOpen(false)
    })
  }

  const arrowTranslate = switchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] })
  const arrowOpacity = switchAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] })

  if (isBusinessAccount) {
    return (
      <View className="flex-1 bg-[#070A12] px-4">
        <KeyboardAvoidWrapper>
          <ScrollView className="flex-1 pt-10" contentContainerStyle={{ paddingBottom: 24 }}>
            <View className={`${fxCardClass} overflow-hidden px-5 pb-5 pt-6`}>
              <Text className="text-[11px] uppercase tracking-[2px] text-[#FFB347]/85">Tunnel FX</Text>
              <Text className="mt-2 text-[26px] font-semibold text-[#FFF7ED]">FX conversion is available in personal context</Text>
              <Text className="mt-3 text-[13px] leading-5 text-[#F6E7D2]">
                Tunnel currently belongs to your personal layer. Keep using Business for payroll, approvals, and payouts, then switch to Personal when you want USD conversion or cards.
              </Text>
              <View className="mt-5 flex-row gap-3">
                <TouchableOpacity
                  onPress={() => router.replace('/business')}
                  className="flex-1 rounded-[18px] bg-[#FF8A1F] py-5"
                >
                  <Text className="text-center text-[15px] font-semibold text-[#FFF7ED]">Open business home</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.replace('/(tabs)/wallet')}
                  className="flex-1 rounded-[18px] bg-[#24170C] py-5"
                >
                  <Text className="text-center text-[15px] font-semibold text-[#FFF7ED]">Open Bridge wallet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidWrapper>
      </View>
    )
  }

  if (isCircleAccount) {
    return (
      <View className="flex-1 bg-[#070A12] px-4">
        <KeyboardAvoidWrapper>
          <ScrollView className="flex-1 pt-10" contentContainerStyle={{ paddingBottom: 24 }}>
            <View className={`${fxCardClass} overflow-hidden px-5 pb-5 pt-6`}>
              <Text className="text-[11px] uppercase tracking-[2px] text-[#FFB347]/85">Tunnel FX</Text>
              <Text className="mt-2 text-[26px] font-semibold text-[#FFF7ED]">Conversion is unavailable in circle context</Text>
              <Text className="mt-3 text-[13px] leading-5 text-[#F6E7D2]">
                FX conversion remains a personal or business wallet action. Use the circle account for funding, dues, and activity.
              </Text>
              <TouchableOpacity
                onPress={() => router.replace(`/circles/${activeAccount.circleId}` as any)}
                className="mt-5 rounded-[18px] bg-[#FF8A1F] py-5"
              >
                <Text className="text-center text-[15px] font-semibold text-[#FFF7ED]">Open circle</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidWrapper>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#070A12] px-4">
      <KeyboardAvoidWrapper>
        <ScrollView
          className="flex-1 pt-10"
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{ opacity: heroFade, transform: [{ scale: quotePulse }] }}
            className={`${fxCardClass} overflow-hidden`}
          >
            <View className="absolute right-[-38] top-[-18] h-32 w-32 rounded-full bg-[#FF8A1F]/10" />
            <View className="absolute left-[-26] top-12 h-28 w-28 rounded-full bg-[#FFB347]/8" />
            <View className="px-5 pb-6 pt-6">
              <Text className="text-[11px] uppercase tracking-[2px] text-[#FFB347]/85">Tunnel FX</Text>
              <Text className="mt-2 text-[30px] font-semibold text-[#FFF8F0]">{copy.title}</Text>
              <Text className="mt-2 text-[14px] leading-6 text-[#E9D7BF]">{copy.body}</Text>
              <Text className="mt-2 text-[12px] text-[#C8AA7D]">Live rate. Final amount confirmed before execution.</Text>

              <FXRailHeader
                copy={copy}
                sourceBalanceLabel={sourceBalanceLabel}
                destinationBalanceLabel={destinationBalanceLabel}
                onSwap={handleSwitch}
                arrowTranslate={arrowTranslate}
                arrowOpacity={arrowOpacity}
              />

              {walletErrorMessage ? (
                <View className="mt-5">
                  <NotificationAlert message={walletErrorMessage} data={null} error />
                </View>
              ) : null}

              {showActivationState ? (
                <FXActivationState copy={copy} />
              ) : showSuccess ? (
                <FXSuccessReceipt
                  copy={copy}
                  message={notice.message || 'Conversion complete.'}
                  receivedAmountLabel={moneyFormat(Number(successQuote?.amount_out) || 0, copy.destinationCurrency)}
                  payAmountLabel={moneyFormat(Number(successQuote?.amount_in) || amountValue || 0, copy.sourceCurrency)}
                  feeAmount={successQuote?.fee_amount}
                  executionRate={successQuote?.execution_rate}
                  receiptReference={receiptReference}
                  successBalanceLabel={copy.successBalanceLabel}
                  successBalanceValue={Number(successWallet?.balance) || 0}
                  onDone={() => router.replace('/(tabs)/tunnel')}
                  onViewReceipt={receiptReference ? () => router.push({ pathname: '/transaction/receipt', params: { reference: receiptReference } } as any) : undefined}
                />
              ) : (
                <View className="mt-5 gap-5">
                  <FXQuoteCard
                    copy={copy}
                    quoteState={quoteState}
                    receiveAmountLabel={receiveAmountLabel}
                    payAmountLabel={payAmountLabel}
                    feeAmount={feeAmount}
                    amountAfterFee={amountAfterFee}
                    executionRate={executionRate}
                    freshnessLabel={freshnessLabel}
                  />

                  <FXAmountInput
                    copy={copy}
                    amountInput={amountInput}
                    onChangeAmount={setAmountInput}
                    sourceBalanceLabel={sourceBalanceLabel}
                    sourceBalanceValue={sourceBalanceValue}
                    onSelectAmount={setAmountInput}
                  />

                  <TouchableOpacity
                    onPress={() => setConfirmOpen(true)}
                    className={`${canConvert ? 'bg-[#FF8A1F]' : 'bg-[#5B3A14]'} rounded-[20px] py-5`}
                    disabled={!canConvert}
                    activeOpacity={0.88}
                  >
                    <Text className="text-center text-[15px] font-semibold text-[#FFF8F0]">
                      {quoteLoading ? 'Refreshing quote...' : copy.convertButton}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>

          {notice.error ? (
            <View className="mt-4">
              <NotificationAlert message={notice.message} data={null} error={notice.error} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidWrapper>

      <FXConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onContinue={openPinStep}
        copy={copy}
        payAmountLabel={payAmountLabel}
        receiveAmountLabel={receiveAmountLabel}
        feeAmount={feeAmount}
        executionRate={executionRate}
      />

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
        title={copy.pinTitle}
      />

      <Loader open={loading || walletLoading} />
    </View>
  )
}
