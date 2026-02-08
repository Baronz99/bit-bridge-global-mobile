import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, ActivityIndicator, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import moneyFormat from '@/utils/moneyFormat'
import BankReceiptCard from '@/components/receipt/BankReceiptCard'
import client from '@/api/client'
import { isValidReceiptReference } from '../../src/navigation/receiptNav'

type ReceiptParams = { reference?: string; timelineId?: string }

type ReceiptDTO = {
  reference: string
  kind: string
  event: string
  status: string
  amount: number
  currency: string
  fees?: { label: string; amount: number; currency?: string }[]
  net_amount?: number
  occurred_at?: string
  title?: string
  subtitle?: string
  parties?: Record<string, any>
  provider?: Record<string, any>
  meta?: Record<string, any>
  legacy?: any
  value_amount?: number
  wallet_amount_charged?: number
  reward_applied?: number
  total_display?: number
  total_amount?: number
  commission_used?: number
  reason?: string
  message?: string
  error?: string
  timeline?: {
    step_key?: string
    label?: string
    description?: string
    state?: string
    occurred_at?: string
    source?: string
    sequence?: number
  }[]
}

const cleanText = (value?: any) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const lower = text.toLowerCase()
  if (lower === 'undefined' || lower === 'null') return ''
  return text
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const normalizeReceiptReference = (value?: string) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (UUID_REGEX.test(raw)) return `bill-${raw}`
  return raw
}

const ReceiptScreen = () => {
  const { reference, timelineId } = useLocalSearchParams<ReceiptParams>()

  const [loading, setLoading] = useState(true)
  const [raw, setRaw] = useState<ReceiptDTO | null>(null)
  const [invalidRef, setInvalidRef] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    const ref0 = normalizeReceiptReference(String(reference ?? timelineId ?? '').trim())

    setLoading(true)
    setInvalidRef(false)
    setNotFound(false)
    setError(false)
    setRaw(null)

    if (!ref0 || !isValidReceiptReference(ref0)) {
      setInvalidRef(true)
      setLoading(false)
      return
    }

    try {
      const res = await client.get(`/receipts/${encodeURIComponent(ref0)}`)
      const payload = (res as any)?.data?.data ?? (res as any)?.data ?? res
      setRaw(payload as ReceiptDTO)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404) {
        setNotFound(true)
      } else {
        setError(true)
      }
      setRaw(null)
    } finally {
      setLoading(false)
    }
  }, [reference, timelineId])

  useEffect(() => {
    load()
  }, [load])

  const receipt = useMemo<ReceiptDTO | null>(() => {
    if (!raw) return null

    const statusRaw = String(raw.status || 'pending').toLowerCase()
    const isSuccess = ['success', 'completed'].includes(statusRaw)
    const rewardAmount = Number(raw.reward_applied ?? raw.commission_used ?? 0)
    const baseAmount = Number(raw.amount ?? 0)
    const computedValue =
      raw.value_amount ?? (rewardAmount > 0 ? baseAmount + rewardAmount : baseAmount)
    const walletAmount = raw.wallet_amount_charged ?? (isSuccess ? baseAmount : 0)
    const failReason =
      cleanText((raw.meta && (raw.meta['reason'] || raw.meta['message'])) as string) ||
      cleanText(raw.reason as string) ||
      cleanText(raw.message as string) ||
      cleanText(raw.error as string)
    const serviceType = String(
      raw?.meta?.service_type || raw?.parties?.service_type || raw?.event || ''
    )
      .trim()
      .toUpperCase()
    const feeArray = Array.isArray(raw.fees) ? raw.fees : []
    const serviceChargeFromMeta = Number(raw?.meta?.service_charge ?? 0)
    const derivedFees =
      feeArray.length > 0
        ? feeArray
        : serviceType === 'ELECTRICITY' && Number.isFinite(serviceChargeFromMeta) && serviceChargeFromMeta > 0
          ? [{ label: 'service charge', amount: serviceChargeFromMeta, currency: raw.currency || 'NGN' }]
          : []

    return {
      reference: raw.reference || String(reference || timelineId || '--'),
      kind: raw.kind,
      event: raw.event,
      status: raw.status || 'pending',
      amount: Number(raw.amount || 0),
      currency: raw.currency || 'NGN',
      fees: derivedFees,
      net_amount: raw.net_amount,
      occurred_at: raw.occurred_at,
      title: raw.title || raw.event || raw.kind || 'Transaction receipt',
      subtitle: raw.subtitle,
      parties: raw.parties,
      provider: raw.provider,
      meta: raw.meta,
      legacy: raw.legacy,
      value_amount: raw.value_amount ?? computedValue,
      wallet_amount_charged: raw.wallet_amount_charged ?? walletAmount,
      reward_applied: raw.reward_applied ?? rewardAmount,
      total_display: raw.total_display ?? computedValue,
      commission_used: raw.commission_used,
      reason: failReason,
      timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    } as ReceiptDTO
  }, [raw, reference, timelineId])

  const uiTitle = useMemo(() => {
    if (!receipt) return 'Transaction receipt'
    const baseTitle = receipt.title || receipt.event || receipt.kind || ''
    const normalized = baseTitle.toLowerCase()
    if (normalized.includes('webhook') || normalized.includes('monnify')) {
      return 'Wallet Funding'
    }
    if (!baseTitle.trim()) return 'Transaction receipt'
    return baseTitle
  }, [receipt])

  const handleCopyReference = async () => {
    if (!receipt) return
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(receipt.reference || ''))
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', String(receipt.reference || ''))
    }
  }

  const handleShare = async () => {
    if (!receipt) return
    try {
      const feesTotal =
        Array.isArray(receipt.fees) && receipt.fees.length
          ? receipt.fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
          : 0
      const net =
        typeof receipt.net_amount === 'number'
          ? receipt.net_amount
          : feesTotal > 0
            ? Math.max(0, receipt.amount - feesTotal)
            : undefined

      await Share.share({
        message:
          `BitBridge Receipt\n` +
          `Title: ${uiTitle}\n` +
          `Amount: ${moneyFormat(receipt.amount, receipt.currency)}\n` +
          (receipt.fees && receipt.fees.length
            ? `Fees: ${receipt.fees.map((f) => `${f.label || 'fee'} ${moneyFormat(f.amount, f.currency || receipt.currency)}`).join(', ')}\n`
            : '') +
          (typeof net === 'number' ? `Net: ${moneyFormat(net, receipt.currency)}\n` : '') +
          `Status: ${receipt.status}\n` +
          `Reference: ${receipt.reference}\n` +
          `Date: ${receipt.occurred_at ?? '--'}`,
      })
    } catch {
      // no-op
    }
  }

  return (
      <View className="flex-1 bg-primary px-4">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#f59e0b" />
          </View>
        ) : invalidRef ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-white text-base">Invalid receipt reference.</Text>
          </View>
        ) : notFound ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-white text-base">Receipt not found.</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-white text-base text-center mb-3">
              Unable to load receipt. Please try again.
            </Text>
            <TouchableOpacity onPress={load} className="px-6 py-3 rounded-xl bg-theme-primary">
              <Text className="text-black font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : receipt ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View className="pt-6">
              <Text className="text-white text-2xl font-semibold">Receipt</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Reference: {receipt.reference || reference || '--'}
              </Text>
            </View>

            <View className="mt-6">
            <BankReceiptCard
              title={uiTitle}
              createdAt={receipt.occurred_at || '--'}
              status={receipt.status as any}
              amount={receipt.amount}
              currency={receipt.currency}
              reference={receipt.reference}
              fees={receipt.fees}
                netAmount={receipt.net_amount}
                meta={receipt.meta}
                parties={receipt.parties}
                provider={receipt.provider}
                event={receipt.event}
                kind={receipt.kind}
                subtitle={receipt.subtitle}
                valueAmount={
                  receipt.value_amount ??
                  (typeof receipt.total_amount === 'number'
                    ? receipt.total_amount + Number(receipt.reward_applied ?? 0)
                    : undefined)
                }
                walletAmount={receipt.wallet_amount_charged ?? receipt.total_amount ?? receipt.amount}
                rewardAmount={receipt.reward_applied}
                reason={receipt.reason}
                timeline={receipt.timeline}
              />
            </View>

            <View className="mt-5">
              <TouchableOpacity onPress={handleShare} className="bg-app-primary py-3 rounded-xl items-center">
                <Text className="text-black text-sm font-semibold">Share receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleCopyReference} className="bg-gray-900 py-3 rounded-xl items-center mt-3">
                <Text className="text-white text-sm">Copy reference</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-white text-base">Receipt not available.</Text>
          </View>
        )}
      </View>
    )
  }

export default ReceiptScreen
