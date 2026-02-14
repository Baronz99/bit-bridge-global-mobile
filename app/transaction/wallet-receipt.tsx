import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { getTransactions } from '@/api/transactions'
import moneyFormat from '@/utils/moneyFormat'
import BankReceiptCard from '@/components/receipt/BankReceiptCard'

type WalletReceiptParams = {
  id?: string
  reference?: string
  amount?: string
  currency?: string
  status?: string
  description?: string
  created_at?: string
  wallet_type?: string
  transaction_type?: string
  address?: string

  // Optional (future-safe)
  fees?: string
}

const safeStr = (v: unknown, fallback = '') => {
  const s = String(v ?? '').trim()
  return s || fallback
}

const safeNum = (v: unknown, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const normalizeStatus = (value: unknown) => safeStr(value, 'pending').toLowerCase()

const toReceiptStatus = (raw: string): 'successful' | 'pending' | 'failed' | 'timed_out' => {
  const s = normalizeStatus(raw)
  if (s.includes('success') || s.includes('complete') || s.includes('approved')) return 'successful'
  if (s.includes('timedout') || s.includes('timed_out') || s.includes('timeout')) return 'timed_out'
  if (s.includes('fail') || s.includes('declin') || s.includes('revers')) return 'failed'
  return 'pending'
}

const isTunnelConversion = (address: unknown) =>
  safeStr(address).toLowerCase().includes('tunnel conversion')

const WalletReceiptScreen = () => {
  const params = useLocalSearchParams<WalletReceiptParams>()

  const reference = useMemo(() => safeStr(params.reference || params.id, '--'), [params.id, params.reference])
  const amount = useMemo(() => safeNum(params.amount, 0), [params.amount])
  const currency = useMemo(() => safeStr(params.currency, 'NGN'), [params.currency])
  const status = useMemo(() => toReceiptStatus(safeStr(params.status, 'pending')), [params.status])
  const description = useMemo(() => safeStr(params.description, 'Wallet transaction'), [params.description])
  const createdAt = useMemo(() => safeStr(params.created_at, '--'), [params.created_at])
  const walletType = useMemo(() => safeStr(params.wallet_type, 'ngn').toLowerCase(), [params.wallet_type])
  const txType = useMemo(() => safeStr(params.transaction_type, ''), [params.transaction_type])
  const address = useMemo(() => safeStr(params.address, ''), [params.address])
  const fees = useMemo(() => {
    const f = safeNum(params.fees, 0)
    return f > 0 ? f : undefined
  }, [params.fees])

  const isConversion = useMemo(() => isTunnelConversion(address), [address])

  // --- Pairing logic (for conversion receipts)
  const [pairLoading, setPairLoading] = useState(false)
  const [pairedAmount, setPairedAmount] = useState<number | null>(null)
  const didFetchPair = useRef(false)

  const fetchPair = useCallback(async () => {
    if (!isConversion) return
    if (!createdAt || createdAt === '--') return
    if (didFetchPair.current) return // bank-grade: avoid repeated calls from rerenders

    didFetchPair.current = true
    setPairLoading(true)

    try {
      const oppositeWallet = walletType === 'ngn' ? 'usd' : 'ngn'
      const res = await getTransactions({ params: { wallet_type: oppositeWallet } })
      const payload = (res as any)?.data ?? res

      const list = payload?.data ?? payload?.transactions ?? payload
      if (!Array.isArray(list)) return

      const currentTime = new Date(createdAt).getTime()
      if (!Number.isFinite(currentTime)) return

      // Find a “pair” within a time window and same address marker
      // Use a slightly larger window than 2 mins to be robust across clock drift/webhooks
      const WINDOW_MS = 5 * 60 * 1000

      const match = list.find((item: any) => {
        const itemTime = new Date(item?.created_at || item?.createdAt || '').getTime()
        if (!Number.isFinite(itemTime)) return false

        const delta = Math.abs(itemTime - currentTime)

        const sameAddress = isTunnelConversion(item?.address)
        const oppositeType =
          safeStr(item?.transaction_type, '').toLowerCase() !== safeStr(txType, '').toLowerCase()

        return sameAddress && oppositeType && delta <= WINDOW_MS
      })

      if (match) {
        const m = safeNum(match?.amount, NaN)
        if (Number.isFinite(m)) setPairedAmount(m)
      }
    } catch {
      // No-op: pairing is best-effort and must never block receipt display
    } finally {
      setPairLoading(false)
    }
  }, [createdAt, isConversion, txType, walletType])

  useEffect(() => {
    fetchPair()
  }, [fetchPair])

  const tendered = useMemo(() => {
    if (!isConversion) return null
    if (safeStr(txType).toLowerCase() === 'withdrawal') return amount
    return pairedAmount
  }, [amount, isConversion, pairedAmount, txType])

  const received = useMemo(() => {
    if (!isConversion) return null
    if (safeStr(txType).toLowerCase() === 'deposit') return amount
    return pairedAmount
  }, [amount, isConversion, pairedAmount, txType])

  const tenderedCurrency = useMemo(() => {
    // If current tx is withdrawal, it’s the tendered currency.
    if (safeStr(txType).toLowerCase() === 'withdrawal') return currency
    // Otherwise tendered is the opposite wallet
    return walletType === 'ngn' ? 'USD' : 'NGN'
  }, [currency, txType, walletType])

  const receivedCurrency = useMemo(() => {
    // If current tx is deposit, it’s the received currency.
    if (safeStr(txType).toLowerCase() === 'deposit') return currency
    // Otherwise received is the opposite wallet
    return walletType === 'ngn' ? 'USD' : 'NGN'
  }, [currency, txType, walletType])

  const handleCopyReference = async () => {
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(reference))
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', String(reference))
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="pt-6">
          <Text className="text-white text-2xl font-semibold">Receipt</Text>
          <Text className="text-gray-400 text-xs mt-1">Wallet transaction summary</Text>
        </View>

        <View className="mt-6">
          <BankReceiptCard
            title={description}
            createdAt={createdAt}
            status={status}
            amount={amount}
            currency={currency}
            reference={reference}
            fees={fees}
            meta={{
              channel: isConversion ? 'Tunnel conversion' : 'Wallet',
              beneficiary: undefined,
              bankName: undefined,
              accountNumber: undefined,
              providerReference: undefined,
              sessionId: undefined,
            }}
          />
        </View>

        {isConversion ? (
          <View className="mt-5 bg-gray-900/80 border border-gray-800 rounded-2xl p-4">
            <Text className="text-white text-sm font-semibold">Conversion details</Text>

            {pairLoading ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#f59e0b" />
                <Text className="text-gray-400 text-xs mt-2">Matching conversion pair…</Text>
              </View>
            ) : (
              <>
                <View className="mt-3">
                  <Text className="text-gray-400 text-xs">Amount tendered</Text>
                  <Text className="text-white text-sm mt-1">
                    {tendered !== null ? moneyFormat(tendered, tenderedCurrency) : '--'}
                  </Text>
                </View>

                <View className="mt-3">
                  <Text className="text-gray-400 text-xs">Amount received</Text>
                  <Text className="text-white text-sm mt-1">
                    {received !== null ? moneyFormat(received, receivedCurrency) : '--'}
                  </Text>
                </View>

                <View className="mt-3">
                  <Text className="text-gray-400 text-xs">Fee</Text>
                  <Text className="text-white text-sm mt-1">{fees ? moneyFormat(fees, currency) : '0'}</Text>
                </View>

                {!pairedAmount && (
                  <Text className="text-gray-500 text-[11px] mt-4">
                    Pairing is best-effort. If you don’t see conversion details, it may still be syncing.
                  </Text>
                )}
              </>
            )}
          </View>
        ) : null}

        <View className="mt-5">
          <TouchableOpacity onPress={handleCopyReference} className="bg-app-primary py-3 rounded-xl items-center">
            <Text className="text-black text-sm font-semibold">Copy reference</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

export default WalletReceiptScreen

