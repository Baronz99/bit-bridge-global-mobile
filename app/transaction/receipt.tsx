import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, Share, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import moneyFormat from '@/utils/moneyFormat'
import BankReceiptCard from '@/components/receipt/BankReceiptCard'
import client from '@/api/client'

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
}

const ReceiptScreen = () => {
  const { reference, timelineId } = useLocalSearchParams<ReceiptParams>()

  const [loading, setLoading] = useState(true)
  const [raw, setRaw] = useState<ReceiptDTO | null>(null)

  const load = useCallback(async () => {
    const ref0 = String(reference ?? timelineId ?? '').trim()

    setLoading(true)

    try {
      if (!ref0) {
        setRaw(null)
        return
      }

      const res = await client.get(`/receipts/${encodeURIComponent(ref0)}`)
      const payload = (res as any)?.data?.data ?? (res as any)?.data ?? res
      setRaw(payload as ReceiptDTO)
    } finally {
      setLoading(false)
    }
  }, [reference, timelineId])

  useEffect(() => {
    load()
  }, [load])

  const receipt = useMemo(() => {
    if (!raw) {
      return {
        reference: String(reference || timelineId || '--'),
        kind: 'wallet',
        event: 'wallet_transaction',
        currency: 'NGN',
        amount: 0,
        fees: [],
        net_amount: 0,
        status: 'pending',
        title: 'Transaction receipt',
        occurred_at: '--',
        meta: {},
      } as ReceiptDTO
    }

    return {
      reference: raw.reference || String(reference || timelineId || '--'),
      kind: raw.kind,
      event: raw.event,
      status: raw.status || 'pending',
      amount: Number(raw.amount || 0),
      currency: raw.currency || 'NGN',
      fees: Array.isArray(raw.fees) ? raw.fees : [],
      net_amount: raw.net_amount,
      occurred_at: raw.occurred_at,
      title: raw.title || raw.event || raw.kind || 'Transaction receipt',
      subtitle: raw.subtitle,
      parties: raw.parties,
      provider: raw.provider,
      meta: raw.meta,
      legacy: raw.legacy,
    } as ReceiptDTO
  }, [raw, reference, timelineId])

  const handleCopyReference = async () => {
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(receipt.reference || ''))
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', String(receipt.reference || ''))
    }
  }

  const handleShare = async () => {
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
          `Title: ${receipt.title ?? 'Transaction receipt'}\n` +
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
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="pt-6">
          <Text className="text-white text-2xl font-semibold">Receipt</Text>
          <Text className="text-gray-400 text-xs mt-1">Transaction summary</Text>
        </View>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text className="text-gray-400 text-xs mt-3">Loading receipt...</Text>
          </View>
        ) : !raw ? (
          <View className="py-10 items-center">
            <Text className="text-gray-400 text-sm">Receipt not found.</Text>
          </View>
        ) : (
          <>
            <View className="mt-6">
              <BankReceiptCard
                title={receipt.title || receipt.event || receipt.kind || 'Transaction receipt'}
                createdAt={receipt.occurred_at || '--'}
                status={receipt.status as any}
                amount={receipt.amount}
                currency={receipt.currency}
                reference={receipt.reference}
                fees={receipt.fees as any}
                meta={receipt.meta}
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
          </>
        )}
      </ScrollView>
    </View>
  )
}

export default ReceiptScreen
