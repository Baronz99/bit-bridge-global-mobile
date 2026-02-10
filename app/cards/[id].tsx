// CardDetail.tsx (MOBILE) — full copy/paste replacement
// ✅ Fixes Freeze button flip (uses unified displayStatus everywhere)
// ✅ Fixes "1970" created date by supporting seconds + ms + ISO
// ✅ PCI-safe receipt routing (no /transaction_records call)
// ✅ Keeps pull-to-refresh
// ✅ Keeps PIN-gated reveal/fund/unload
// ✅ Adds SAFE logs (no PAN/CVV, no PIN, no auth headers)
// ✅ Tightens: blocks fund/unload while frozen, clears stale notices, safer parsing

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import {
  freezeCard,
  fundCard,
  getCardBalance,
  getCardDetails,
  getCardHistory,
  getUserCards,
  revealCard,
  unfreezeCard,
  unloadCard,
} from '@/api/cards'
import moneyFormat from '@/utils/moneyFormat'
import FormInput from '@/components/FormInput'
import TransactionPinModal from '@/components/TransactionPinModal'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'

const DEBUG_CARDS =
  String(process.env.EXPO_PUBLIC_DEBUG_CARDS || '').toLowerCase() === 'true' || __DEV__ === true

type CardAction = 'fund' | 'unload' | 'reveal'
type Id = string | number

const safeStr = (v: any, fallback = '') => {
  const s = String(v ?? '').trim()
  return s || fallback
}

const isEncryptedValue = (value?: string | number | null) => {
  if (!value) return false
  return String(value).startsWith('ev:')
}

const parseAmount = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Handles:
 * - ISO strings: "2026-01-28T..."
 * - Unix seconds: 1700000000
 * - Unix ms: 1700000000000
 * - Numeric strings: "1700..."
 */
const formatMaybeDateTime = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '--'

  // numeric-like?
  const num = typeof value === 'number' ? value : Number(String(value))
  if (Number.isFinite(num)) {
    const ms = num < 1e12 ? num * 1000 : num // seconds -> ms
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
  }

  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
}

const formatHistoryLabel = (item: any) => {
  const raw = safeStr(item?.address || item?.description || item?.type, 'Card transaction')
  const lower = raw.toLowerCase()
  if (lower.includes('virtual card funding')) return 'Funding from Tunnel wallet'
  if (lower.includes('virtual card withdrawal')) return 'Withdrawal to Tunnel wallet'
  if (lower.includes('authorization')) return 'Card purchase'
  if (lower.includes('reversal')) return 'Card reversal'
  if (lower.includes('refund')) return 'Card refund'
  if (lower.includes('conversion')) return 'Card conversion'
  return raw
}

const CardDetail = () => {
  const { id } = useLocalSearchParams()
  const cardId = String(id || '')
  const router = useRouter()
  const { userProfileData } = useAuth()

  // ----------------------------
  // Fetchers
  // ----------------------------
  const fetchDetails = useCallback(() => getCardDetails(cardId), [cardId])
  const fetchBalance = useCallback(() => getCardBalance(cardId), [cardId])
  const fetchHistory = useCallback(() => getCardHistory(cardId), [cardId])
  const fetchCardMeta = useCallback(() => getUserCards(), [])

  const details = useFetch(fetchDetails)
  const balance = useFetch(fetchBalance)
  const history = useFetch(fetchHistory)
  const cardMetaFetch = useFetch(fetchCardMeta)

  // ----------------------------
  // Pull-to-refresh
  // ----------------------------
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.allSettled([details.refetch(), balance.refetch(), history.refetch(), cardMetaFetch.refetch()])
    } finally {
      setRefreshing(false)
    }
  }, [details, balance, history, cardMetaFetch])

  // ----------------------------
  // Normalized payloads
  // ----------------------------
  const detailPayload = useMemo(() => (details.data as any)?.data ?? details.data ?? {}, [details.data])

  const cardMetaPayload = useMemo(() => {
    const payload = (cardMetaFetch.data as any)?.data ?? cardMetaFetch.data
    if (Array.isArray(payload)) return payload
    if (payload?.card) return [payload.card]
    if (payload?.data) return [payload.data]
    if (payload?.card_id) return [payload]
    return []
  }, [cardMetaFetch.data])

  const cardMeta = useMemo(() => {
    if (!Array.isArray(cardMetaPayload) || cardMetaPayload.length === 0) return null
    return (
      cardMetaPayload.find((item: any) => String(item?.id) === cardId) ||
      cardMetaPayload.find((item: any) => String(item?.card_id) === String((detailPayload as any)?.card_id)) ||
      cardMetaPayload[0] ||
      null
    )
  }, [cardMetaPayload, cardId, detailPayload])

  const balancePayload = useMemo(() => (balance.data as any)?.data ?? balance.data ?? {}, [balance.data])

  const historyPayload = useMemo(() => {
    const payload = (history.data as any)?.data ?? history.data
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.history)) return payload.history
    return []
  }, [history.data])

  // ----------------------------
  // Derived fields
  // ----------------------------
  const last4 =
    (detailPayload as any)?.last4 ||
    (detailPayload as any)?.last_4 ||
    (detailPayload as any)?.card_last4 ||
    (detailPayload as any)?.cardLast4

  const bridgeCardId =
    (detailPayload as any)?.card_id ||
    (detailPayload as any)?.cardId ||
    (detailPayload as any)?.bridge_card_id ||
    (detailPayload as any)?.bridgeCardId ||
    null

  // Unified status source (IMPORTANT)
  const displayStatus = useMemo(() => {
    const s =
      (detailPayload as any)?.status ??
      (cardMeta as any)?.status ??
      (detailPayload as any)?.card_status ??
      (cardMeta as any)?.card_status ??
      'active'
    return String(s).toLowerCase()
  }, [detailPayload, cardMeta])

  const isFrozen = displayStatus === 'frozen'

  const statusLabel = isFrozen ? 'Frozen' : 'Active'
  const statusTone = isFrozen ? 'text-yellow-300' : 'text-emerald-300'

  const frozenBy = (cardMeta as any)?.frozen_by || (cardMeta as any)?.frozenBy || ''
  const frozenReason = (cardMeta as any)?.frozen_reason || (cardMeta as any)?.frozenReason || ''
  const cardholderKycStatus = String((cardMeta as any)?.meta_data?.cardholder_kyc_status || '').toLowerCase()
  const cardholderStatusUpdatedAt = (cardMeta as any)?.meta_data?.cardholder_status_updated_at || null
  const cardholderVerificationPending = ['pending_verification', 'manual_review'].includes(cardholderKycStatus)
  const cardholderVerificationFailed = cardholderKycStatus === 'failed'
  const cardholderVerificationBlocked = cardholderVerificationPending || cardholderVerificationFailed
  const cardholderStatusLabel =
    cardholderKycStatus === 'pending_verification'
      ? 'Pending verification'
      : cardholderKycStatus === 'manual_review'
      ? 'Manual review'
      : cardholderKycStatus === 'failed'
      ? 'Verification failed'
      : cardholderKycStatus === 'verified'
      ? 'Verified'
      : null

  const cardholderName = useMemo(() => {
    const profile = (userProfileData as any)?.data ?? userProfileData
    const u = profile?.user_profile ?? profile?.userProfile ?? profile
    return (
      [(detailPayload as any)?.first_name, (detailPayload as any)?.last_name].filter(Boolean).join(' ') ||
      [(cardMeta as any)?.first_name, (cardMeta as any)?.last_name].filter(Boolean).join(' ') ||
      [(u as any)?.first_name, (u as any)?.last_name].filter(Boolean).join(' ') ||
      '--'
    )
  }, [detailPayload, cardMeta, userProfileData])

  const currencyLabel = String((detailPayload as any)?.card_currency || 'USD').toUpperCase()
  const cardTypeLabel = String((detailPayload as any)?.card_type || 'virtual').toUpperCase()

  const normalizeUsdLimit = (value: any) => {
    if (value === null || value === undefined || value === '') return null
    const amount = Number(value)
    if (!Number.isFinite(amount)) return null
    return amount > 100000 ? amount / 100 : amount
  }

  const rawLimit =
    (detailPayload as any)?.card_limit_usd ??
    (detailPayload as any)?.card_limit ??
    (detailPayload as any)?.limit ??
    (cardMeta as any)?.card_limit_usd ??
    (cardMeta as any)?.card_limit ??
    (cardMeta as any)?.limit

  const limitValue = normalizeUsdLimit(rawLimit)
  const limitLabel = limitValue !== null ? moneyFormat(limitValue, currencyLabel) : '--'

  // ----------------------------
  // PIN-gated actions
  // ----------------------------
  const [amount, setAmount] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [action, setAction] = useState<CardAction>('fund')
  const [actionLoading, setActionLoading] = useState(false)

  // PCI reveal state (must not persist)
  const [cardReveal, setCardReveal] = useState<any | null>(null)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasKycAccess = useMemo(() => {
    const payload = (userProfileData as any)?.data ?? userProfileData
    const kycLevel = payload?.kyc_level || payload?.user_kyc?.kyc_level
    const phoneVerified = payload?.phone_verified === true || payload?.phone_verified_at
    if (!kycLevel && !phoneVerified) return false
    if (kycLevel && String(kycLevel).toLowerCase() === 'tier_0') return false
    return true
  }, [userProfileData])

  const clearTransientMessages = () => {
    setNotice(null)
    setPinError(null)
  }

  const formatStatusTime = (value?: string | null) => {
    if (!value) return '--'
    const d = new Date(String(value))
    return Number.isNaN(d.getTime()) ? '--' : d.toLocaleString()
  }

  const handlePinGate = async (nextAction: CardAction) => {
    clearTransientMessages()

    // Block money actions while frozen (this matches expected UX)
    if ((nextAction === 'fund' || nextAction === 'unload') && isFrozen) {
      setNotice('Card is frozen. Unfreeze to continue.')
      return
    }
    if ((nextAction === 'fund' || nextAction === 'unload') && cardholderVerificationBlocked) {
      setNotice(
        cardholderVerificationFailed
          ? 'Cardholder verification failed. Re-verify cardholder details before funding/unloading.'
          : 'Cardholder verification is in progress. Refresh and retry once verified.'
      )
      return
    }

    if (nextAction === 'fund' || nextAction === 'unload') {
      const amountValue = parseAmount(amount)
      if (!amountValue || Number.isNaN(amountValue) || amountValue <= 0) {
        setNotice('Enter a valid amount.')
        return
      }
      if (!bridgeCardId) {
        setNotice('Card ID not available yet. Try again in a moment.')
        return
      }
    }

    if (nextAction === 'reveal' && !cardId) {
      setNotice('Card not available yet. Try again in a moment.')
      return
    }

    try {
      const status = await getTransactionPinStatus()
      const payload = (status as any)?.data ?? status
      const hasPin = payload?.has_pin === true || payload?.status === 'set' || payload?.pin_set === true

      if (!hasPin) {
        setNotice('Set your transaction PIN to continue.')
        return
      }

      setAction(nextAction)
      setPinModalOpen(true)
    } catch (error: any) {
      setNotice(error?.message || 'Unable to check PIN status.')
    }
  }

  const handlePinSubmit = async (transactionPin: string) => {
    // Never log transactionPin.
    if (!transactionPin) return

    if (action === 'reveal') {
      setActionLoading(true)
      setPinError(null)
      try {
        // IMPORTANT: do not log reveal payload (PCI)
        const response = await revealCard(cardId, transactionPin)
        const payload = (response as any)?.data ?? response
        const revealPayload = payload?.data ?? payload

        setCardReveal(revealPayload || null)
        setNotice('Card details revealed.')

        if (revealTimer.current) clearTimeout(revealTimer.current)
        revealTimer.current = setTimeout(() => {
          setCardReveal(null)
        }, 30_000)

        setPinModalOpen(false)
      } catch (error: any) {
        setPinError(error?.message || 'Unable to reveal card.')
      } finally {
        setActionLoading(false)
      }
      return
    }

    // fund/unload
    const amountValue = parseAmount(amount)
    if (!bridgeCardId) {
      setNotice('Card ID not available yet. Try again in a moment.')
      return
    }
    if (!amountValue || Number.isNaN(amountValue) || amountValue <= 0) {
      setNotice('Enter a valid amount.')
      return
    }
    if (isFrozen) {
      setNotice('Card is frozen. Unfreeze to continue.')
      return
    }
    if (cardholderVerificationBlocked) {
      setNotice(
        cardholderVerificationFailed
          ? 'Cardholder verification failed. Re-verify cardholder details before funding/unloading.'
          : 'Cardholder verification is in progress. Refresh and retry once verified.'
      )
      return
    }

    setActionLoading(true)
    setPinError(null)

    try {
      if (action === 'fund') {
        await fundCard({ card_id: bridgeCardId, amount: amountValue, transaction_pin: transactionPin })
        setNotice('Card funded successfully.')
      } else {
        await unloadCard({ card_id: bridgeCardId, amount: amountValue, transaction_pin: transactionPin })
        setNotice('Card unloaded successfully.')
      }

      setPinModalOpen(false)
      setAmount('')

      await Promise.allSettled([balance.refetch(), history.refetch(), details.refetch(), cardMetaFetch.refetch()])
    } catch (error: any) {
      setPinError(error?.message || 'Unable to complete card action.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleFreezeToggle = async () => {
    clearTransientMessages()
    setActionLoading(true)
    try {
      // IMPORTANT: use unified status, not detailPayload-only
      const frozenNow = isFrozen

      if (DEBUG_CARDS) {
        console.log('[CARD] freeze toggle', { cardId, frozenNow })
      }

      if (frozenNow) {
        await unfreezeCard(cardId)
        setNotice('Card unfrozen.')
      } else {
        await freezeCard(cardId)
        setNotice('Card frozen.')
      }

      // refresh both sources that could hold status
      await Promise.allSettled([details.refetch(), cardMetaFetch.refetch()])
    } catch (error: any) {
      setNotice(error?.message || 'Unable to update card status.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleHideReveal = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current)
    revealTimer.current = null
    setCardReveal(null)
    setNotice('Card details hidden.')
  }

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current)
    }
  }, [])

  // ----------------------------
  // PCI-safe display values
  // ----------------------------
  const revealLast4 = cardReveal?.last_4 || cardReveal?.last4 || cardReveal?.last_four

  const maskedPanValue = useMemo(() => {
    // SAFE: only masked values (never decrypted)
    if ((detailPayload as any)?.masked_pan && !isEncryptedValue((detailPayload as any).masked_pan)) {
      return (detailPayload as any).masked_pan
    }
    if ((detailPayload as any)?.card_pan && !isEncryptedValue((detailPayload as any).card_pan)) {
      return (detailPayload as any).card_pan
    }
    if (last4) return `**** **** **** ${last4}`
    return null
  }, [detailPayload, last4])

  const revealPanValue = useMemo(() => {
    // Could contain PAN (only after PIN + short timer)
    if (cardReveal?.card_number && !isEncryptedValue(cardReveal.card_number)) return cardReveal.card_number
    if (cardReveal?.card_pan && !isEncryptedValue(cardReveal.card_pan)) return cardReveal.card_pan
    if (revealLast4) return `**** **** **** ${revealLast4}`
    if (last4) return `**** **** **** ${last4}`
    return null
  }, [cardReveal, revealLast4, last4])

  const revealExpiryValue = useMemo(() => {
    if (!cardReveal) return null
    const month = cardReveal.expiry_month || cardReveal.expiryMonth
    const year = cardReveal.expiry_year || cardReveal.expiryYear

    if (month && year && !isEncryptedValue(month) && !isEncryptedValue(year)) {
      const paddedMonth = String(month).padStart(2, '0')
      const shortYear = String(year).slice(-2)
      return `${paddedMonth}/${shortYear}`
    }

    const raw = cardReveal.expiry || cardReveal.expiry_date
    if (!raw || isEncryptedValue(raw)) return null

    const digits = String(raw).replace(/\D/g, '')
    if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    if (digits.length === 6) return `${digits.slice(0, 2)}/${digits.slice(4)}`
    return String(raw)
  }, [cardReveal])

  const revealCvvValue = useMemo(() => {
    if (!cardReveal?.cvv || isEncryptedValue(cardReveal.cvv)) return null
    return String(cardReveal.cvv)
  }, [cardReveal])

  const billingAddressLines = useMemo(() => {
    if (!cardReveal?.billing_address) return null
    const address = cardReveal.billing_address
    const line1 = address?.billing_address1 || address?.address || ''
    const line2 = address?.billing_address2 || ''
    const city = address?.billing_city || address?.city || ''
    const state = address?.state || ''
    const postal = address?.billing_zip_code || address?.postal || ''
    const country = address?.billing_country || address?.country || ''
    const parts = [line1, line2, [city, state].filter(Boolean).join(' '), [country, postal].filter(Boolean).join(' ')]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
    return parts.length ? parts : null
  }, [cardReveal])

  // Available balance display
  const availableBalanceLabel = useMemo(() => {
    const cents =
      (balancePayload as any)?.balance ??
      (balancePayload as any)?.available_balance ??
      (balancePayload as any)?.ledger_balance

    const amountVal =
      cents === null || cents === undefined ? Number((balancePayload as any)?.amount ?? 0) : Number(cents) / 100

    return moneyFormat(amountVal, 'USD')
  }, [balancePayload])

  // Created date (fixes 1970)
  const createdValue = useMemo(() => {
    const v =
      (detailPayload as any)?.created_at ||
      (detailPayload as any)?.createdAt ||
      (detailPayload as any)?.issued_at ||
      (detailPayload as any)?.issuedAt ||
      (detailPayload as any)?.created ||
      cardReveal?.created_at ||
      cardReveal?.createdAt ||
      cardReveal?.issued_at ||
      cardReveal?.issuedAt ||
      cardReveal?.created

    return formatMaybeDateTime(v)
  }, [detailPayload, cardReveal])

  // ----------------------------
  // PCI-safe receipt routing
  // ----------------------------
  const openCardReceipt = useCallback(
    (item: any, index: number) => {
      const reference = item?.transaction_reference || item?.reference || item?.id || `${cardId}-${index}`
      const createdAt = item?.created_at || item?.createdAt || ''
      const amountValue = Number(item?.amount ?? 0)
      const description = formatHistoryLabel(item)
      const status = String(item?.status || 'pending')
      const breakdown = item?.breakdown || {}

      // SAFE log only
      if (DEBUG_CARDS) {
        console.log('[CARD] open receipt', {
          cardId,
          reference: String(reference),
          amount: amountValue,
          status,
          hasBreakdown: !!breakdown && Object.keys(breakdown).length > 0,
        })
      }

      router.push({
        pathname: '/transaction/card-receipt',
        params: {
          cardId: String(cardId),
          reference: String(reference),
          amount: String(amountValue),
          currency: 'USD',
          status: String(status),
          description: String(description),
          created_at: String(createdAt),
          breakdown: JSON.stringify(breakdown || {}),
        },
      } as any)
    },
    [router, cardId]
  )

  // ----------------------------
  // Render
  // ----------------------------
  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white/70 text-xs tracking-widest uppercase">Virtual Card</Text>
          <Text className="text-white text-2xl font-semibold mt-2">Card Details</Text>
          <Text className="text-gray-400 text-sm mt-2">Manage your card, balance, and activity.</Text>
        </View>

        {details.loading || balance.loading ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : null}

        {details.error ? (
          <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
            <Text className="text-white font-semibold">Error</Text>
            <Text className="text-white/80">{(details.error as any)?.message || 'Failed to load card'}</Text>
          </View>
        ) : null}

        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-6 overflow-hidden">
          <View className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-app-primary/10" />
          <View className="absolute -left-10 -bottom-12 w-52 h-52 rounded-full bg-white/5" />

          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-white/70 text-xs tracking-widest uppercase">
                {cardTypeLabel} - {currencyLabel}
              </Text>
              <Text className="text-white text-xl font-semibold mt-2">
                {(detailPayload as any)?.card_brand || (detailPayload as any)?.brand || 'Virtual Card'}
              </Text>
            </View>

            <View className="bg-gray-950/60 border border-gray-800 px-3 py-1 rounded-full">
              <Text className={`text-xs font-semibold ${statusTone}`}>{statusLabel}</Text>
            </View>
          </View>

          <View className="mt-6">
            <Text className="text-gray-400 text-xs tracking-widest uppercase">Card Number</Text>
            <Text className="text-white text-lg font-semibold tracking-widest mt-2">
              {revealPanValue || maskedPanValue || `**** **** **** ${last4 || '----'}`}
            </Text>
            {cardReveal ? (
              <Text className="text-amber-200 text-[11px] mt-2">
                Revealed details will auto-hide in 30 seconds.
              </Text>
            ) : null}
          </View>

          <View className="flex-row justify-between mt-6">
            <View>
              <Text className="text-gray-400 text-xs uppercase tracking-widest">Cardholder</Text>
              <Text className="text-white text-sm mt-2">{cardholderName}</Text>
            </View>
            <View>
              <Text className="text-gray-400 text-xs uppercase tracking-widest text-right">Limit</Text>
              <Text className="text-white text-sm mt-2 text-right">{limitLabel}</Text>
            </View>
          </View>
        </View>

        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
          <Text className="text-white font-semibold">Available Balance</Text>
          <Text className="text-white mt-2 text-2xl font-semibold">{availableBalanceLabel}</Text>
          <Text className="text-gray-400 text-xs mt-1">USD tunnel wallet only.</Text>
        </View>

        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
          <Text className="text-white font-semibold">Card Controls</Text>

          {isFrozen ? (
            <View className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
              <Text className="text-red-100 text-xs font-semibold">Card frozen</Text>
              <Text className="text-red-200/90 text-[11px] mt-1">{frozenReason || 'Your card is temporarily frozen.'}</Text>
              {frozenBy ? <Text className="text-red-200/80 text-[11px] mt-1">Frozen by: {frozenBy}</Text> : null}
            </View>
          ) : null}
          {cardholderVerificationBlocked ? (
            <View className="mt-3 rounded-xl border border-sky-700/40 bg-sky-900/20 px-3 py-2">
              <Text className="text-sky-100 text-xs font-semibold">
                Cardholder status: {cardholderStatusLabel || 'In progress'}
              </Text>
              <Text className="text-sky-200/90 text-[11px] mt-1">
                {cardholderVerificationFailed
                  ? 'Verification failed. Re-submit cardholder details to continue.'
                  : 'Verification is processing. Funding and unload are enabled after provider confirmation webhook.'}
              </Text>
              {cardholderStatusUpdatedAt ? (
                <Text className="text-sky-200/80 text-[11px] mt-1">
                  Last update: {formatStatusTime(cardholderStatusUpdatedAt)}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={onRefresh}
                disabled={refreshing || actionLoading}
                className="mt-2 border border-sky-400/50 rounded-lg py-2"
              >
                <Text className="text-sky-100 text-center text-xs font-semibold">
                  {refreshing ? 'Refreshing...' : 'Refresh verification status'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <FormInput label="Amount" value={amount} keyboardType="numeric" onChangeText={(v: string) => setAmount(v)} />

          {notice ? <Text className="text-yellow-400 mt-2">{notice}</Text> : null}

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => handlePinGate('fund')}
              className="bg-app-primary py-3 rounded-xl flex-1"
              disabled={actionLoading || !hasKycAccess || isFrozen || cardholderVerificationBlocked}
            >
              <Text className="text-white text-center font-medium">Fund</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePinGate('unload')}
              className="bg-gray-900 border border-gray-800 py-3 rounded-xl flex-1"
              disabled={actionLoading || !hasKycAccess || isFrozen || cardholderVerificationBlocked}
            >
              <Text className="text-white text-center font-medium">Unload</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-3 mt-3">
            <TouchableOpacity
              onPress={handleFreezeToggle}
              className="bg-gray-900 border border-gray-800 py-3 rounded-xl flex-1"
              disabled={actionLoading}
            >
              <Text className="text-white text-center font-medium">{isFrozen ? 'Unfreeze' : 'Freeze'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={cardReveal ? handleHideReveal : () => handlePinGate('reveal')}
              className="bg-gray-900 border border-gray-800 py-3 rounded-xl flex-1"
              disabled={actionLoading}
            >
              <Text className="text-white text-center font-medium">{cardReveal ? 'Hide' : 'Reveal'}</Text>
            </TouchableOpacity>
          </View>

          {!hasKycAccess ? (
            <Text className="text-gray-400 text-xs mt-3">Complete verification to fund/unload cards.</Text>
          ) : null}
          {cardholderVerificationBlocked ? (
            <Text className="text-gray-400 text-xs mt-2">
              {cardholderVerificationFailed
                ? 'Cardholder verification failed. Re-verify before funding.'
                : 'Cardholder verification is pending. Funding/unload is disabled for now.'}
            </Text>
          ) : null}
          {isFrozen ? (
            <Text className="text-gray-400 text-xs mt-2">Card is frozen — fund/unload is disabled.</Text>
          ) : null}
        </View>

        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
          <Text className="text-white font-semibold">Card Details</Text>
          <View className="mt-3">
            <LabelText label="Card ID" value={String((detailPayload as any)?.card_id || (detailPayload as any)?.id || '--')} />
            <LabelText label="Currency" value={currencyLabel} />
            <LabelText label="Type" value={cardTypeLabel} />
            <LabelText label="Created" value={createdValue} />
            <LabelText label="Expiry" value={revealExpiryValue || 'Hidden'} />
            <LabelText label="CVV" value={revealCvvValue || 'Hidden'} />
            {billingAddressLines ? (
              <View className="py-2 border-b border-gray-800/60">
                <Text className="text-gray-400 text-xs uppercase tracking-widest">Billing address</Text>
                {billingAddressLines.map((line: string, idx: number) => (
                  <Text key={`${line}-${idx}`} className="text-white text-sm mt-1">
                    {line}
                  </Text>
                ))}
              </View>
            ) : (
              <LabelText label="Billing address" value="Hidden" />
            )}
          </View>
        </View>

        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
          <Text className="text-white font-semibold">Recent Activity</Text>

          {history.loading ? (
            <View className="py-4">
              <ActivityIndicator />
            </View>
          ) : null}

          {historyPayload.length === 0 && !history.loading ? (
            <Text className="text-gray-400 text-xs mt-2">No activity yet.</Text>
          ) : null}

          {historyPayload.slice(0, 5).map((item: any, index: number) => {
            const createdAt = item?.created_at || item?.createdAt || ''
            const amountValue = Number(item?.amount ?? 0)
            const description = formatHistoryLabel(item)
            const breakdown = item?.breakdown || {}

            return (
              <View key={String(item?.id ?? index)} className="mt-3 rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-2">
                <TouchableOpacity onPress={() => openCardReceipt(item, index)} className="py-1">
                  <View className="flex-row justify-between">
                    <Text className="text-gray-200 text-sm">{description}</Text>
                    <Text className="text-gray-300 text-sm">{moneyFormat(amountValue, 'USD')}</Text>
                  </View>

                  <Text className="text-gray-500 text-xs mt-1">{createdAt ? formatMaybeDateTime(createdAt) : '--'}</Text>

                  {item?.decline_reason === 'insufficient_balance' ? (
                    <Text className="text-amber-200 text-[11px] mt-2">
                      Insufficient USD balance to cover purchase + fees.
                    </Text>
                  ) : null}

                  {breakdown &&
                  (breakdown.total_debit_usd ||
                    breakdown.provider_fee_usd ||
                    breakdown.bitbridge_fee_usd ||
                    breakdown.fx_markup_usd) ? (
                    <View className="mt-2">
                      <LineItem label="Principal" value={moneyFormat(Number(breakdown.principal_usd || 0), 'USD')} />
                      <LineItem label="Provider fee" value={moneyFormat(Number(breakdown.provider_fee_usd || 0), 'USD')} />
                      <LineItem label="BitBridge fee" value={moneyFormat(Number(breakdown.bitbridge_fee_usd || 0), 'USD')} />
                      <LineItem label="FX markup" value={moneyFormat(Number(breakdown.fx_markup_usd || 0), 'USD')} />
                      <LineItem
                        label="Total debit"
                        value={moneyFormat(Number(breakdown.total_debit_usd || 0), 'USD')}
                        emphasis
                      />
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handlePinSubmit}
        loading={actionLoading}
        errorMessage={pinError}
        title={action === 'fund' ? 'Enter PIN to Fund' : action === 'unload' ? 'Enter PIN to Unload' : 'Enter PIN to Reveal'}
      />
    </View>
  )
}

export default CardDetail

const LabelText = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row justify-between items-center py-2 border-b border-gray-800/60">
    <Text className="text-gray-400 text-xs uppercase tracking-widest">{label}</Text>
    <Text className="text-white text-sm">{value}</Text>
  </View>
)

const LineItem = ({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) => (
  <View className="flex-row justify-between mt-1">
    <Text className={`text-[11px] ${emphasis ? 'text-gray-200 font-semibold' : 'text-gray-400'}`}>{label}</Text>
    <Text className={`text-[11px] ${emphasis ? 'text-gray-200 font-semibold' : 'text-gray-300'}`}>{value}</Text>
  </View>
)
