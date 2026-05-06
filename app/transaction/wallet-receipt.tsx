import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { getTransactionsForAccount } from '@/api/transactions'
import moneyFormat from '@/utils/moneyFormat'
import CompletionPanel from '@/components/finance/CompletionPanel'
import FinancialSummaryCard from '@/components/finance/FinancialSummaryCard'
import type { FinanceSummaryRow, TransactionStatusTone, WalletReceiptDTO, WalletTransaction } from '@/components/finance/types'
import { resolveTransferLifecycle } from '@/utils/transferLifecycle'
import { useActiveAccount } from '@/services/useActiveAccount'

type WalletReceiptParams = {
  id?: string
  reference?: string
  amount?: string
  currency?: string
  status?: string
  lifecycle_state?: string
  display_message?: string
  description?: string
  created_at?: string
  wallet_type?: string
  transaction_type?: string
  address?: string
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

const SAFE_SEPARATOR = ' | '

const isTunnelConversion = (address: unknown) => safeStr(address).toLowerCase().includes('tunnel conversion')

const formatReceiptTimestamp = (value?: string) => {
  if (!value || value === '--') return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  try {
    const dateLabel = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date)

    const timeLabel = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
      .format(date)
      .replace(/\s+/g, ' ')
      .trim()

    return `${dateLabel}${SAFE_SEPARATOR}${timeLabel} WAT`
  } catch {
    return value
  }
}

const formatStatusLabel = (value?: string) => {
  const raw = safeStr(value, 'pending').toLowerCase()
  if (/success|complete|approved|paid/.test(raw)) return 'Completed'
  if (/fail|declin|error|revers/.test(raw)) return 'Failed'
  if (/pending|initialized|processing/.test(raw)) return 'Pending'
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Pending'
}

type WalletReceiptSemantics = {
  headerTitle: string
  panelTitle: string
  primaryLabel: string
}

const getWalletReceiptSemantics = (receipt: WalletReceiptDTO, isConversion: boolean): WalletReceiptSemantics => {
  const txType = safeStr(receipt.transaction_type).toLowerCase()
  const description = safeStr(receipt.description).toLowerCase()

  if (isConversion) {
    return { headerTitle: 'Conversion receipt', panelTitle: 'Conversion details', primaryLabel: 'Amount' }
  }
  if (txType === 'deposit' || description.includes('fund')) {
    return { headerTitle: 'Wallet funding receipt', panelTitle: 'Funding details', primaryLabel: 'Amount funded' }
  }
  if (txType === 'withdrawal' || description.includes('withdraw')) {
    return { headerTitle: 'Withdrawal receipt', panelTitle: 'Withdrawal details', primaryLabel: 'Amount withdrawn' }
  }
  return { headerTitle: 'Wallet receipt', panelTitle: receipt.description || 'Wallet details', primaryLabel: 'Amount' }
}

const WalletReceiptScreen = () => {
  const params = useLocalSearchParams<WalletReceiptParams>()
  const { activeAccount } = useActiveAccount()

  const receipt = useMemo<WalletReceiptDTO>(
    () => ({
      reference: safeStr(params.reference || params.id, '--'),
      amount: safeNum(params.amount, 0),
      currency: safeStr(params.currency, 'NGN'),
      status: safeStr(params.status, 'pending'),
      lifecycle_state: safeStr(params.lifecycle_state),
      display_message: safeStr(params.display_message),
      description: safeStr(params.description, 'Wallet transaction'),
      created_at: safeStr(params.created_at, '--'),
      wallet_type: safeStr(params.wallet_type, 'ngn').toLowerCase(),
      transaction_type: safeStr(params.transaction_type),
      address: safeStr(params.address),
      fees: (() => {
        const value = safeNum(params.fees, 0)
        return value > 0 ? value : undefined
      })(),
    }),
    [params]
  )

  const lifecycle = useMemo(
    () =>
      resolveTransferLifecycle({
        lifecycle_state: receipt.lifecycle_state,
        status: receipt.status,
        display_message: receipt.display_message,
      }),
    [receipt.display_message, receipt.lifecycle_state, receipt.status]
  )

  const statusLabel = useMemo(() => formatStatusLabel(lifecycle.shortLabel || receipt.status), [lifecycle.shortLabel, receipt.status])
  const formattedTimestamp = useMemo(() => formatReceiptTimestamp(receipt.created_at), [receipt.created_at])

  const statusTone: TransactionStatusTone = lifecycle.state === 'approved'
    ? 'success'
    : lifecycle.state === 'failed'
      ? 'failed'
      : lifecycle.state === 'initialized' || lifecycle.state === 'pending_provider'
        ? 'pending'
        : 'info'

  const isConversion = useMemo(() => isTunnelConversion(receipt.address), [receipt.address])
  const [pairLoading, setPairLoading] = useState(false)
  const [pairedAmount, setPairedAmount] = useState<number | null>(null)
  const didFetchPair = useRef(false)

  const fetchPair = useCallback(async () => {
    if (!isConversion) return
    if (!receipt.created_at || receipt.created_at === '--') return
    if (didFetchPair.current) return

    didFetchPair.current = true
    setPairLoading(true)

    try {
      const oppositeWallet = receipt.wallet_type === 'ngn' ? 'usd' : 'ngn'
      const res = await getTransactionsForAccount(activeAccount, { params: { wallet_type: oppositeWallet } })
      const payload = (res as { data?: unknown })?.data ?? res
      const list = (payload as { data?: WalletTransaction[]; transactions?: WalletTransaction[] })?.data ??
        (payload as { transactions?: WalletTransaction[] })?.transactions ??
        (Array.isArray(payload) ? (payload as WalletTransaction[]) : [])
      if (!Array.isArray(list)) return

      const currentTime = new Date(receipt.created_at).getTime()
      if (!Number.isFinite(currentTime)) return

      const WINDOW_MS = 5 * 60 * 1000
      const match = list.find((item) => {
        const itemTime = new Date(item?.created_at || item?.createdAt || '').getTime()
        if (!Number.isFinite(itemTime)) return false

        const delta = Math.abs(itemTime - currentTime)
        const sameAddress = isTunnelConversion(item?.address)
        const oppositeType =
          safeStr(item?.transaction_type, '').toLowerCase() !== safeStr(receipt.transaction_type, '').toLowerCase()

        return sameAddress && oppositeType && delta <= WINDOW_MS
      })

      if (match) {
        const amount = safeNum(match.amount, Number.NaN)
        if (Number.isFinite(amount)) setPairedAmount(amount)
      }
    } catch {
      // best effort only
    } finally {
      setPairLoading(false)
    }
  }, [activeAccount, isConversion, receipt.created_at, receipt.transaction_type, receipt.wallet_type])

  useEffect(() => {
    void fetchPair()
  }, [fetchPair])

  const tendered = useMemo(() => {
    if (!isConversion) return null
    if (safeStr(receipt.transaction_type).toLowerCase() === 'withdrawal') return receipt.amount
    return pairedAmount
  }, [isConversion, pairedAmount, receipt.amount, receipt.transaction_type])

  const received = useMemo(() => {
    if (!isConversion) return null
    if (safeStr(receipt.transaction_type).toLowerCase() === 'deposit') return receipt.amount
    return pairedAmount
  }, [isConversion, pairedAmount, receipt.amount, receipt.transaction_type])

  const tenderedCurrency = useMemo(() => {
    if (safeStr(receipt.transaction_type).toLowerCase() === 'withdrawal') return receipt.currency
    return receipt.wallet_type === 'ngn' ? 'USD' : 'NGN'
  }, [receipt.currency, receipt.transaction_type, receipt.wallet_type])

  const receivedCurrency = useMemo(() => {
    if (safeStr(receipt.transaction_type).toLowerCase() === 'deposit') return receipt.currency
    return receipt.wallet_type === 'ngn' ? 'USD' : 'NGN'
  }, [receipt.currency, receipt.transaction_type, receipt.wallet_type])

  const semantics = useMemo(() => getWalletReceiptSemantics(receipt, isConversion), [isConversion, receipt])

  const summaryRows = useMemo<FinanceSummaryRow[]>(() => {
    return [
      { label: 'Transaction ID', value: receipt.reference, mono: true, emphasis: true },
      { label: 'Status', value: lifecycle.shortLabel || receipt.status },
      { label: 'Timestamp', value: receipt.created_at || '--' },
      { label: 'Amount', value: moneyFormat(receipt.amount, receipt.currency) },
      receipt.fees ? { label: 'Fee', value: moneyFormat(receipt.fees, receipt.currency) } : null,
      { label: 'Wallet', value: receipt.wallet_type?.toUpperCase() || '--' },
      receipt.transaction_type ? { label: 'Type', value: receipt.transaction_type } : null,
    ].filter(Boolean) as FinanceSummaryRow[]
  }, [formattedTimestamp, receipt, statusLabel])

  const conversionRows = useMemo<FinanceSummaryRow[]>(() => {
    return [
      { label: 'You paid', value: tendered !== null ? moneyFormat(tendered, tenderedCurrency) : '--', emphasis: true },
      { label: 'You received', value: received !== null ? moneyFormat(received, receivedCurrency) : '--', emphasis: true },
      { label: 'Fee', value: receipt.fees ? moneyFormat(receipt.fees, receipt.currency) : moneyFormat(0, receipt.currency) },
    ]
  }, [receipt.currency, receipt.fees, received, receivedCurrency, tendered, tenderedCurrency])

  const handleCopyReference = async () => {
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(receipt.reference))
      Alert.alert('Copied', 'Reference copied to clipboard.')
    } catch {
      Alert.alert('Reference', String(receipt.reference))
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="pt-6 gap-4">
          <View>
            <Text className="text-white text-2xl font-semibold">{semantics.headerTitle}</Text>
            <Text className="text-[#A9AFB8] text-sm mt-2">Final amount, status, and identifiers confirmed below.</Text>
            <Text className="text-gray-400 text-xs mt-2">Reference: {receipt.reference}</Text>
          </View>

          <CompletionPanel
            eyebrow="Wallet transaction"
            title={receipt.description || 'Wallet receipt'}
            supportingText={receipt.display_message || 'Transaction details confirmed below.'}
            primaryLabel="Amount"
            primaryValue={moneyFormat(receipt.amount, receipt.currency)}
            statusLabel={statusLabel}
            statusTone={statusTone}
            summaryTitle="Receipt summary"
            summaryRows={summaryRows}
          />

          {isConversion ? (
            <FinancialSummaryCard
              title="Conversion breakdown"
              rows={conversionRows}
              footer={
                pairLoading
                  ? 'Matching the paired wallet movement.'
                  : !pairedAmount
                    ? 'Pairing is best-effort. If a leg is missing here, it may still be syncing.'
                    : 'Both legs of the conversion have been summarized.'
              }
            />
          ) : null}

          {pairLoading ? (
            <View className="items-center py-3">
              <ActivityIndicator size="small" color="#f59e0b" />
            </View>
          ) : null}

          <TouchableOpacity onPress={handleCopyReference} className="bg-theme-primary py-4 rounded-[18px] items-center mt-2">
            <Text className="text-alt text-sm font-semibold">Copy transaction ID</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

export default WalletReceiptScreen
