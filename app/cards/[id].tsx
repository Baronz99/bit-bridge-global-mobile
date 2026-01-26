import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
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

const CardDetail = () => {
  const { id } = useLocalSearchParams()
  const cardId = String(id || '')
  const router = useRouter()
  const { userProfileData } = useAuth()

  const fetchDetails = useCallback(() => getCardDetails(cardId), [cardId])
  const fetchBalance = useCallback(() => getCardBalance(cardId), [cardId])
  const fetchHistory = useCallback(() => getCardHistory(cardId), [cardId])
  const fetchCardMeta = useCallback(() => getUserCards(), [])

  const details = useFetch(fetchDetails)
  const balance = useFetch(fetchBalance)
  const history = useFetch(fetchHistory)
  const cardMetaFetch = useFetch(fetchCardMeta)

  const detailPayload = useMemo(() => details.data?.data ?? details.data, [details.data])
  const cardMetaPayload = useMemo(() => {
    const payload = cardMetaFetch.data?.data ?? cardMetaFetch.data
    if (Array.isArray(payload)) return payload
    if (payload?.card) return [payload.card]
    if (payload?.data) return [payload.data]
    if (payload?.card_id) return [payload]
    return []
  }, [cardMetaFetch.data])
  const cardMeta = useMemo(() => {
    if (!Array.isArray(cardMetaPayload)) return null
    return (
      cardMetaPayload.find((item: any) => String(item?.id) === cardId) ||
      cardMetaPayload.find((item: any) => String(item?.card_id) === String(detailPayload?.card_id)) ||
      cardMetaPayload[0] ||
      null
    )
  }, [cardMetaPayload, cardId, detailPayload?.card_id])
  const balancePayload = useMemo(() => balance.data?.data ?? balance.data, [balance.data])
  const historyPayload = useMemo(() => {
    const payload = history.data?.data ?? history.data
    return Array.isArray(payload) ? payload : payload?.history ?? []
  }, [history.data])

  const last4 = detailPayload?.last4 || detailPayload?.last_4 || detailPayload?.card_last4
  const bridgeCardId =
    detailPayload?.card_id ||
    detailPayload?.cardId ||
    detailPayload?.bridge_card_id ||
    detailPayload?.bridgeCardId ||
    null

  const [amount, setAmount] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [cardReveal, setCardReveal] = useState<any | null>(null)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  // ✅ Only change: allow reveal to reuse same modal without breaking fund/unload
  const [action, setAction] = useState<'fund' | 'unload' | 'reveal'>('fund')
  const [actionLoading, setActionLoading] = useState(false)

  const hasKycAccess = useMemo(() => {
    const payload = userProfileData?.data ?? userProfileData
    const kycLevel = payload?.kyc_level || payload?.user_kyc?.kyc_level
    const phoneVerified = payload?.phone_verified === true || payload?.phone_verified_at
    if (!kycLevel && !phoneVerified) return false
    if (kycLevel && String(kycLevel).toLowerCase() === 'tier_0') return false
    return true
  }, [userProfileData])

  const handlePinGate = async (nextAction: 'fund' | 'unload' | 'reveal') => {
  // Only fund/unload requires an amount
  if (nextAction === 'fund' || nextAction === 'unload') {
    const amountValue = Number(amount)
    if (!amountValue || Number.isNaN(amountValue) || amountValue <= 0) {
      setNotice('Enter a valid amount.')
      return
    }
    if (!bridgeCardId) {
      setNotice('Card ID not available yet. Try again in a moment.')
      return
    }
  }

  // Reveal needs card record id (route param) – not bridgeCardId
  if (nextAction === 'reveal' && !cardId) {
    setNotice('Card not available yet. Try again in a moment.')
    return
  }

  try {
    const status = await getTransactionPinStatus()
    const payload = status?.data ?? status
    const hasPin =
      payload?.has_pin === true ||
      payload?.status === 'set' ||
      payload?.pin_set === true

    if (!hasPin) {
      setNotice('Set your transaction PIN to continue.')
      return
    }

    setAction(nextAction)
    setPinError(null)
    setPinModalOpen(true)
  } catch (error: any) {
    setNotice(error?.message || 'Unable to check PIN status.')
  }
}



  const handlePinSubmit = async (transactionPin: string) => {
    // ✅ Route by action; fund/unload logic stays same
    if (action === 'reveal') {
  setActionLoading(true)
  setPinError(null)
  try {
    const response = await revealCard(cardId, transactionPin)
    const payload = response?.data ?? response
    const revealPayload = payload?.data ?? payload

    setCardReveal(revealPayload || null)
    setNotice('Card details revealed.')

    if (revealTimer.current) clearTimeout(revealTimer.current as any)
    revealTimer.current = setTimeout(() => setCardReveal(null), 30000) as any

    setPinModalOpen(false)
  } catch (error: any) {
    setPinError(error?.message || 'Unable to reveal card.')
  } finally {
    setActionLoading(false)
  }
  return
}



    // existing fund/unload flow (unchanged)
    const amountValue = Number(amount)
    if (!bridgeCardId) {
      setNotice('Card ID not available yet. Try again in a moment.')
      return
    }
    setActionLoading(true)
    setPinError(null)
    try {
      if (action === 'fund') {
        await fundCard({
          card_id: bridgeCardId,
          amount: amountValue,
          transaction_pin: transactionPin,
        })
        setNotice('Card funded successfully.')
      } else {
        await unloadCard({
          card_id: bridgeCardId,
          amount: amountValue,
          transaction_pin: transactionPin,
        })
        setNotice('Card unloaded successfully.')
      }
      setPinModalOpen(false)
      balance.refetch()
      history.refetch()
    } catch (error: any) {
      setPinError(error?.message || 'Unable to complete card action.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleFreezeToggle = async () => {
    setActionLoading(true)
    try {
      const isFrozen = detailPayload?.status === 'frozen'
      if (isFrozen) {
        await unfreezeCard(cardId)
        setNotice('Card unfrozen.')
      } else {
        await freezeCard(cardId)
        setNotice('Card frozen.')
      }
      details.refetch()
    } catch (error: any) {
      setNotice(error?.message || 'Unable to update card status.')
    } finally {
      setActionLoading(false)
    }
  }

  // ✅ Keep hide logic exactly the same
  const handleHideReveal = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current)
    setCardReveal(null)
    setNotice('Card details hidden.')
  }

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current)
    }
  }, [])

  const isEncryptedValue = (value?: string | number | null) => {
    if (!value) return false
    return String(value).startsWith('ev:')
  }

  const revealLast4 = cardReveal?.last_4 || cardReveal?.last4 || cardReveal?.last_four
  const maskedPanValue = useMemo(() => {
    if (detailPayload?.masked_pan && !isEncryptedValue(detailPayload.masked_pan))
      return detailPayload.masked_pan
    if (detailPayload?.card_pan && !isEncryptedValue(detailPayload.card_pan)) return detailPayload.card_pan
    if (last4) return `**** **** **** ${last4}`
    return null
  }, [detailPayload, last4])

  const revealPanValue = useMemo(() => {
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
    if (isEncryptedValue(raw)) return null
    if (!raw) return null
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
    const parts = [
      line1,
      line2,
      [city, state].filter(Boolean).join(' '),
      [country, postal].filter(Boolean).join(' '),
    ]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
    return parts.length ? parts : null
  }, [cardReveal])

  const displayStatus = String(detailPayload?.status || cardMeta?.status || 'active').toLowerCase()
  const statusLabel = displayStatus === 'frozen' ? 'Frozen' : 'Active'
  const statusTone = displayStatus === 'frozen' ? 'text-yellow-300' : 'text-emerald-300'
  const frozenBy = cardMeta?.frozen_by || cardMeta?.frozenBy || ''
  const frozenReason = cardMeta?.frozen_reason || cardMeta?.frozenReason || ''
  const cardholderName =
    [detailPayload?.first_name, detailPayload?.last_name].filter(Boolean).join(' ') ||
    [cardMeta?.first_name, cardMeta?.last_name].filter(Boolean).join(' ') ||
    cardReveal?.cardholder_name ||
    cardReveal?.cardholderName ||
    [userProfileData?.user_profile?.first_name, userProfileData?.user_profile?.last_name]
      .filter(Boolean)
      .join(' ')
  const currencyLabel = String(detailPayload?.card_currency || 'USD').toUpperCase()
  const cardTypeLabel = String(detailPayload?.card_type || 'virtual').toUpperCase()
  const normalizeUsdLimit = (value: any) => {
    if (value === null || value === undefined || value === '') return null
    const amount = Number(value)
    if (!Number.isFinite(amount)) return null
    return amount > 100000 ? amount / 100 : amount
  }
  const rawLimit =
    detailPayload?.card_limit_usd ??
    detailPayload?.card_limit ??
    detailPayload?.limit ??
    cardMeta?.card_limit_usd ??
    cardMeta?.card_limit ??
    cardMeta?.limit ??
    cardReveal?.card_limit ??
    cardReveal?.limit
  const limitValue = normalizeUsdLimit(rawLimit)
  const limitLabel = limitValue !== null ? moneyFormat(limitValue, currencyLabel) : null

  const formatMaybeDateTime = (value?: string | null) => {
    if (!value) return '--'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleString()
  }

  const formatHistoryLabel = (item: any) => {
    const raw = String(item?.address || item?.description || item?.type || 'Card transaction')
    const lower = raw.toLowerCase()
    if (lower.includes('virtual card funding')) return 'Funding from Tunnel wallet'
    if (lower.includes('virtual card withdrawal')) return 'Withdrawal to Tunnel wallet'
    if (lower.includes('authorization')) return 'Card purchase'
    if (lower.includes('reversal')) return 'Card reversal'
    if (lower.includes('refund')) return 'Card refund'
    if (lower.includes('conversion')) return 'Card conversion'
    return raw
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
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
            <Text className="text-white/80">{details.error?.message || 'Failed to load card'}</Text>
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
                {detailPayload?.card_brand || detailPayload?.brand || 'Virtual Card'}
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
          </View>

          <View className="flex-row justify-between mt-6">
            <View>
              <Text className="text-gray-400 text-xs uppercase tracking-widest">Cardholder</Text>
              <Text className="text-white text-sm mt-2">{cardholderName || '--'}</Text>
            </View>
            <View>
              <Text className="text-gray-400 text-xs uppercase tracking-widest text-right">
                Limit
              </Text>
              <Text className="text-white text-sm mt-2 text-right">{limitLabel || '--'}</Text>
            </View>
          </View>
        </View>

        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
          <Text className="text-white font-semibold">Available Balance</Text>
          <Text className="text-white mt-2 text-2xl font-semibold">
            {(() => {
              const cents =
                balancePayload?.balance ??
                balancePayload?.available_balance ??
                balancePayload?.ledger_balance
              const amount =
                cents === null || cents === undefined
                  ? Number(balancePayload?.amount ?? 0)
                  : Number(cents) / 100
              return moneyFormat(amount, 'USD')
            })()}
          </Text>
          <Text className="text-gray-400 text-xs mt-1">USD tunnel wallet only.</Text>
        </View>

        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
          <Text className="text-white font-semibold">Card Controls</Text>
          {displayStatus === 'frozen' ? (
            <View className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
              <Text className="text-red-100 text-xs font-semibold">Card frozen</Text>
              <Text className="text-red-200/90 text-[11px] mt-1">
                {frozenReason || 'Your card is temporarily frozen.'}
              </Text>
              {frozenBy ? (
                <Text className="text-red-200/80 text-[11px] mt-1">Frozen by: {frozenBy}</Text>
              ) : null}
            </View>
          ) : null}
          <FormInput
            label="Amount"
            value={amount}
            keyboardType="numeric"
            onChangeText={(value: string) => setAmount(value)}
          />
          {notice ? <Text className="text-yellow-400 mt-2">{notice}</Text> : null}

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => handlePinGate('fund')}
              className="bg-app-primary py-3 rounded-xl flex-1"
              disabled={actionLoading}
            >
              <Text className="text-white text-center font-medium">Fund</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handlePinGate('unload')}
              className="bg-gray-900 border border-gray-800 py-3 rounded-xl flex-1"
              disabled={actionLoading}
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
              <Text className="text-white text-center font-medium">
                {detailPayload?.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
              </Text>
            </TouchableOpacity>

            {/* ✅ Only change: Reveal now goes through PIN modal; Hide remains immediate */}
            <TouchableOpacity
              onPress={cardReveal ? handleHideReveal : () => handlePinGate('reveal')}
              className="bg-gray-900 border border-gray-800 py-3 rounded-xl flex-1"
              disabled={actionLoading}
            >
              <Text className="text-white text-center font-medium">
                {cardReveal ? 'Hide' : 'Reveal'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
          <Text className="text-white font-semibold">Card Details</Text>
          <View className="mt-3">
            <LabelText label="Card ID" value={detailPayload?.card_id || detailPayload?.id || '--'} />
            <LabelText label="Currency" value={currencyLabel} />
            <LabelText label="Type" value={cardTypeLabel} />
            <LabelText
              label="Created"
              value={formatMaybeDateTime(
                detailPayload?.created_at ||
                  detailPayload?.createdAt ||
                  detailPayload?.issued_at ||
                  detailPayload?.issuedAt ||
                  detailPayload?.created ||
                  cardReveal?.created_at ||
                  cardReveal?.createdAt ||
                  cardReveal?.issued_at ||
                  cardReveal?.issuedAt ||
                  cardReveal?.created
              )}
            />
            <LabelText label="Expiry" value={revealExpiryValue || 'Hidden'} />
            <LabelText label="CVV" value={revealCvvValue || 'Hidden'} />
            {billingAddressLines ? (
              <View className="py-2 border-b border-gray-800/60">
                <Text className="text-gray-400 text-xs uppercase tracking-widest">Billing address</Text>
                {billingAddressLines.map((line, idx) => (
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
            const reference =
              item?.transaction_reference || item?.reference || item?.id || `${cardId}-${index}`
            const createdAt = item?.created_at || item?.createdAt || ''
            const amountValue = Number(item?.amount ?? 0)
            const description = formatHistoryLabel(item)
            const status = String(item?.status || 'pending')
            const breakdown = item?.breakdown || {}
            return (
              <View
                key={String(item?.id ?? index)}
                className="mt-3 rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-2"
              >
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/receipt',
                      params: {
                        reference: String(reference),
                        amount: String(amountValue),
                        currency: 'USD',
                        status: String(status),
                        description: String(description),
                        created_at: String(createdAt),
                      },
                    })
                  }
                  className="py-1"
                >
                  <View className="flex-row justify-between">
                    <Text className="text-gray-200 text-sm">{description}</Text>
                    <Text className="text-gray-300 text-sm">{moneyFormat(amountValue, 'USD')}</Text>
                  </View>
                  <Text className="text-gray-500 text-xs mt-1">{createdAt}</Text>
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
        title={
          action === 'fund'
            ? 'Enter PIN to Fund'
            : action === 'unload'
              ? 'Enter PIN to Unload'
              : 'Enter PIN to Reveal'
        }
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

const LineItem = ({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) => (
  <View className="flex-row justify-between mt-1">
    <Text className={`text-[11px] ${emphasis ? 'text-gray-200 font-semibold' : 'text-gray-400'}`}>
      {label}
    </Text>
    <Text className={`text-[11px] ${emphasis ? 'text-gray-200 font-semibold' : 'text-gray-300'}`}>
      {value}
    </Text>
  </View>
)
