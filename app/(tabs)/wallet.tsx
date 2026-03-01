import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  ScrollView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '@/services/useAuth'
import { useBalancePrivacy } from '@/services/useBalancePrivacy'
import moneyFormat from '@/utils/moneyFormat'
import useFetch from '@/services/useFetch'
import { getTransactions } from '@/api/transactions'
import { dateFormat } from '@/utils/dateFormat'
import { useRouter } from 'expo-router'
import { activateTunnel, getUserWallet } from '@/api/wallet'
import { normalizeAnchorOnboarding, useAnchorOnboarding } from '@/services/useAnchorOnboarding'
import AppModal from '@/components/modal/Modal'
import { isPrimaryTransaction as isPrimaryTransactionFromUtils } from '@/utils/timelineRefs'
import { getTierFromProfile, isTierEligibleForBankTransfer } from '@/utils/bankTransfer'
import { warn } from '@/utils/logger'
import { formatWalletHistoryPresentation } from '@/utils/walletHistoryPresentation'

const REFRESH_TIMEOUT_MS = 15000
const TX_PAGE_LIMIT = 30

const WalletScreen = () => {
  const { userProfileData } = useAuth()
  const { balancesHidden, toggleBalancesVisibility, maskFormattedAmount } = useBalancePrivacy()
  const router = useRouter()

  const [walletMode, setWalletMode] = useState<'bridge' | 'tunnel'>('bridge')
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'deposit' | 'withdraw'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'initialized' | 'failed'>(
    'all'
  )
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [listRefreshing, setListRefreshing] = useState(false)
  const [txLoading, setTxLoading] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)
  const [txRows, setTxRows] = useState<any[]>([])
  const [txNextCursor, setTxNextCursor] = useState<string | null>(null)
  const [txLoadingMore, setTxLoadingMore] = useState(false)

  const isTunnelMode = walletMode === 'tunnel'
  const expectedWalletType: 'ngn' | 'usd' = isTunnelMode ? 'usd' : 'ngn'

  const heroCardClass = 'rounded-3xl border p-5 overflow-hidden'
  const heroCardStyle = isTunnelMode
    ? { borderColor: 'rgba(245, 158, 11, 0.45)' }
    : { backgroundColor: 'rgba(17, 24, 39, 0.8)', borderColor: 'rgba(31, 41, 55, 1)' }

  const modeSwitchStyle = isTunnelMode
    ? { backgroundColor: 'rgba(9, 8, 6, 0.75)', borderColor: 'rgba(245, 158, 11, 0.4)' }
    : { backgroundColor: 'rgba(3, 7, 18, 0.7)', borderColor: 'rgba(31, 41, 55, 1)' }

  const bridgeActiveStyle = !isTunnelMode ? { backgroundColor: 'rgba(31, 41, 55, 0.95)' } : undefined
  const tunnelActiveStyle = isTunnelMode ? { backgroundColor: '#f59e0b' } : undefined
  const tunnelLabelClass = isTunnelMode ? 'text-orange-100' : 'text-white/70'
  const tunnelBalanceClass = isTunnelMode ? 'text-orange-50' : 'text-white'
  const hasLinearGradient = !!UIManager.getViewManagerConfig?.('ExpoLinearGradient')

  // ---------- helpers ----------
  const safeStr = (v: any, fallback = '') => {
    const s = String(v ?? '').trim()
    return s || fallback
  }

  const getItemWalletType = (item: any): 'ngn' | 'usd' | null => {
    // Try common fields first
    const explicit =
      item?.wallet_type ||
      item?.walletType ||
      item?.wallet?.wallet_type ||
      item?.wallet?.walletType ||
      item?.wallet_currency ||
      item?.currency

    const v = safeStr(explicit, '').toLowerCase()

    if (v === 'ngn' || v === 'naira') return 'ngn'
    if (v === 'usd' || v === 'dollar') return 'usd'

    // fallback heuristic: some backends tag "tunnel conversion" only
    // but we cannot safely infer wallet from that; return null
    return null
  }

  const parseTransactionsPayload = useCallback((payload: any) => {
    const list = payload?.data ?? payload?.transactions ?? payload
    const rows = Array.isArray(list) ? list : []
    const nextCursor = payload?.next_cursor ?? payload?.data?.next_cursor ?? null
    return { rows, nextCursor: nextCursor ? String(nextCursor) : null }
  }, [])

  const fetchTransactions = useCallback(
    async (cursor?: string, append = false) => {
      if (append) {
        setTxLoadingMore(true)
      } else {
        setTxLoading(true)
      }
      setTxError(null)
      try {
        const baseParams =
          transactionFilter === 'all'
            ? {}
            : {
                transaction_type: transactionFilter,
              }

        const payload = await getTransactions({
          params: {
            ...baseParams,
            wallet_type: expectedWalletType,
            limit: TX_PAGE_LIMIT,
            cursor,
          },
        })

        const { rows, nextCursor } = parseTransactionsPayload(payload)
        setTxNextCursor(nextCursor)
        setTxRows((prev) => {
          if (!append) return rows
          const merged = [...prev, ...rows]
          const seen = new Set<string>()
          return merged.filter((item) => {
            const key = String(item?.id ?? item?.reference ?? item?.transfer_reference ?? '')
            if (!key) return true
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
        })
      } catch (error: any) {
        setTxError(error?.message || 'Unable to load transactions.')
        if (!append) {
          setTxRows([])
          setTxNextCursor(null)
        }
      } finally {
        if (append) {
          setTxLoadingMore(false)
        } else {
          setTxLoading(false)
        }
      }
    },
    [expectedWalletType, parseTransactionsPayload, transactionFilter]
  )

  const loadMoreTransactions = useCallback(async () => {
    if (!txNextCursor || txLoading || txLoadingMore) return
    await fetchTransactions(txNextCursor, true)
  }, [fetchTransactions, txLoading, txLoadingMore, txNextCursor])

  const { data: walletData, refetch: refetchWallet } = useFetch(() => getUserWallet(), false)
  const canUseBankTransfer = useMemo(
    () => isTierEligibleForBankTransfer(getTierFromProfile(userProfileData)),
    [userProfileData]
  )
  const anchorState = useAnchorOnboarding({ autoFetchOnMount: false, autoFetchOnFocus: false })
  const anchorNormalized = useMemo(
    () => normalizeAnchorOnboarding(anchorState.detailResponse, anchorState.userAccountsResponse),
    [anchorState.detailResponse, anchorState.userAccountsResponse]
  )

  const [tunnelLoading, setTunnelLoading] = useState(false)
  const [tunnelNotice, setTunnelNotice] = useState<string | null>(null)

  const isPrimaryTransactionSafe = useCallback((item: any) => {
    if (typeof isPrimaryTransactionFromUtils === 'function') {
      return isPrimaryTransactionFromUtils(item)
    }
    warn('[WalletScreen] isPrimaryTransaction missing/invalid; using fallback')
    return item?.show_in_primary_feed !== false
  }, [])

  const refreshWalletFetches = useCallback(async () => {
    setListRefreshing(true)
    try {
      const withTimeout = <T,>(promise: Promise<T>, label: string) =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label}_timeout`)), REFRESH_TIMEOUT_MS)
          ),
        ])

      await Promise.allSettled([
        withTimeout(fetchTransactions(undefined, false), 'transactions_refresh'),
        withTimeout(refetchWallet(), 'wallet_refresh'),
        withTimeout(anchorState.refresh({ force: true }), 'anchor_onboarding_refresh'),
      ])
    } finally {
      setListRefreshing(false)
    }
  }, [anchorState.refresh, fetchTransactions, refetchWallet])

  const walletBalance =
    walletData?.data?.bridge?.balance ??
    walletData?.data?.bridge?.amount ??
    userProfileData?.wallet?.balance

  const walletBalanceValue = Number(walletBalance ?? 0)

  const tunnelWallet = walletData?.data?.tunnel
  const tunnelBalanceValue = Number(tunnelWallet?.balance ?? tunnelWallet?.amount ?? 0)
  const bridgeBalanceLabel = moneyFormat(Number.isFinite(walletBalanceValue) ? walletBalanceValue : 0)
  const tunnelBalanceLabel = moneyFormat(
    Number.isFinite(tunnelBalanceValue) ? tunnelBalanceValue : 0,
    'USD'
  )
  const bridgeBalanceDisplay = balancesHidden
    ? maskFormattedAmount(bridgeBalanceLabel)
    : bridgeBalanceLabel
  const tunnelBalanceDisplay = balancesHidden
    ? maskFormattedAmount(tunnelBalanceLabel)
    : tunnelBalanceLabel


  // Refetch when switching wallets or changing filters
  useEffect(() => {
    void refreshWalletFetches()
  }, [refreshWalletFetches, transactionFilter, walletMode])

  // âœ… HARD FILTER by wallet type so NGN cannot leak into USD (or vice versa)
  const walletScopedTransactions = useMemo(() => {
    return txRows.filter((item: any) => {
      const t = getItemWalletType(item)
      if (!t) return true // if backend doesn't provide type, keep (but ideally backend should)
      return t === expectedWalletType
    })
  }, [txRows, expectedWalletType])

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const now = Date.now()

    const parseDate = (value: string, endOfDay: boolean) => {
      const trimmed = value.trim()
      if (!trimmed) return null
      const suffix = endOfDay ? 'T23:59:59' : 'T00:00:00'
      const parsed = new Date(`${trimmed}${suffix}`)
      return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
    }

    const start = parseDate(startDate, false)
    const end = parseDate(endDate, true)
    const cutoff =
      start || end
        ? null
        : dateRange === '7d'
          ? now - 7 * 24 * 60 * 60 * 1000
          : dateRange === '30d'
            ? now - 30 * 24 * 60 * 60 * 1000
            : null

    return walletScopedTransactions.filter((item: any) => {
      if (!isPrimaryTransactionSafe(item)) return false

      const filterStatus = statusFilterValue(item)
      if (statusFilter !== 'all' && filterStatus !== statusFilter) return false

      if (start || end) {
        const createdAt = item?.created_at || item?.createdAt
        const timestamp = createdAt ? new Date(createdAt).getTime() : NaN
        if (!Number.isNaN(timestamp)) {
          if (start && timestamp < start) return false
          if (end && timestamp > end) return false
        }
      }

      if (cutoff) {
        const createdAt = item?.created_at || item?.createdAt
        const timestamp = createdAt ? new Date(createdAt).getTime() : NaN
        if (!Number.isNaN(timestamp) && timestamp < cutoff) return false
      }

      if (!normalizedSearch) return true

      const haystack = [
        item?.display_message,
        item?.description,
        item?.reference,
        item?.transfer_reference,
        item?.transaction_type,
        item?.type,
        item?.lifecycle_state,
        item?.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [walletScopedTransactions, statusFilter, dateRange, searchTerm, startDate, endDate, isPrimaryTransactionSafe])

  const statusTone = (status: string) => {
    if (status === 'approved' || status === 'completed') return 'text-green-400'
    if (status === 'initialized' || status === 'pending' || status === 'reserved') return 'text-yellow-400'
    if (status === 'released') return 'text-sky-300'
    return 'text-red-400'
  }

  function transactionState(item: any) {
    return String(item?.lifecycle_state || item?.status || 'pending').toLowerCase()
  }

  function statusFilterValue(item: any) {
    const state = transactionState(item)
    if (state === 'completed') return 'approved'
    if (state === 'reserved') return 'initialized'
    if (state === 'released') return 'failed'
    return state
  }

  const displayAmount = (item: any) =>
    Number(item?.display_total ?? item?.display_amount ?? item?.amount ?? 0)

  const getWalletDescription = (item: any) => {
    const address = String(item?.address || item?.description || '').toLowerCase()
    const txType = String(item?.transaction_type || item?.type || '').toLowerCase()

    if (address.includes('tunnel conversion') || address.includes('conversion')) {
      if (isTunnelMode) return txType === 'withdrawal' ? 'Convert USD â†’ NGN' : 'Convert NGN â†’ USD'
      return txType === 'withdrawal' ? 'Convert NGN â†’ USD' : 'Convert USD â†’ NGN'
    }

    if (address.includes('virtual card funding')) return 'Card funding'
    if (address.includes('virtual card withdrawal')) return 'Card withdrawal'
    if (address.includes('transfer')) return 'Transfer'

    return item?.transaction_type || item?.type || 'transaction'
  }

  const transactionOptions = useMemo(
    () => [
      { label: 'All types', value: 'all' },
      { label: 'Deposits', value: 'deposit' },
      { label: 'Withdrawals', value: 'withdraw' },
    ],
    []
  )

  const statusOptions = useMemo(
    () => [
      { label: 'All status', value: 'all' },
      { label: 'Approved', value: 'approved' },
      { label: 'Initialized', value: 'initialized' },
      { label: 'Failed', value: 'failed' },
    ],
    []
  )

  const dateRangeOptions = useMemo(
    () => [
      { label: 'All time', value: 'all' },
      { label: 'Last 7 days', value: '7d' },
      { label: 'Last 30 days', value: '30d' },
    ],
    []
  )

  const renderOptionGroup = (
    label: string,
    value: string,
    options: { label: string; value: string }[],
    onChange: (next: string) => void
  ) => (
    <View className="mt-4">
      <Text className="text-white text-xs font-semibold mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              className={`px-3 py-2 rounded-full border ${
                active ? 'bg-app-primary border-app-primary' : 'bg-gray-950 border-gray-800'
              }`}
            >
              <Text className={`text-xs ${active ? 'text-black' : 'text-white'}`}>
                {option.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )

  const handleActivateTunnel = async () => {
    setTunnelLoading(true)
    setTunnelNotice(null)
    try {
      await activateTunnel()
      await refreshWalletFetches()
      setWalletMode('tunnel')
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'Unable to activate Tunnel wallet.'
      setTunnelNotice(message)
    } finally {
      setTunnelLoading(false)
    }
  }

  // âœ… Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshWalletFetches()
    } finally {
      setRefreshing(false)
    }
  }, [refreshWalletFetches])

  const heroContent = (
    <>
      <View className="flex-row items-center gap-2 rounded-2xl border p-1" style={modeSwitchStyle}>
        <TouchableOpacity
          onPress={() => setWalletMode('bridge')}
          className={`flex-1 rounded-xl px-3 py-2 ${!isTunnelMode ? 'bg-gray-800' : 'bg-transparent'}`}
          style={bridgeActiveStyle}
        >
          <Text className="text-xs text-center text-white font-semibold">Bridge (NGN)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setWalletMode('tunnel')}
          className={`flex-1 rounded-xl px-3 py-2 ${isTunnelMode ? 'bg-orange-500' : 'bg-transparent'}`}
          style={tunnelActiveStyle}
        >
          <Text className={`text-xs text-center font-semibold ${isTunnelMode ? 'text-black' : 'text-white'}`}>
            Tunnel (USD)
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mt-3 flex-row justify-end">
        <TouchableOpacity
          onPress={() => {
            void toggleBalancesVisibility()
          }}
          className="gap-2 items-center rounded-full flex-row py-1.5 px-3 bg-black/30 border border-white/15"
        >
          <Feather name={balancesHidden ? 'eye-off' : 'eye'} size={12} color="white" />
          <Text className="text-white text-xs">{balancesHidden ? 'Show balances' : 'Hide balances'}</Text>
        </TouchableOpacity>
      </View>

      {!isTunnelMode ? (
        <>
          <Text className="text-white/70 text-xs tracking-widest uppercase mt-4">Bridge Wallet</Text>
          <Text className="text-white text-3xl font-semibold mt-2">
            {bridgeBalanceDisplay}
          </Text>
          {balancesHidden ? (
            <Text className="text-white/50 text-xs mt-1">Balances hidden</Text>
          ) : null}

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => router.push('/fundWallet')}
              className="bg-app-primary rounded-xl flex-1 py-3 items-center"
            >
              <Text className="text-white text-xs font-semibold">Fund Wallet</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity
              onPress={() => setSendOpen(true)}
              className="bg-gray-900 border border-gray-800 py-3 flex-1 rounded-xl"
            >
              <Text className="text-white text-center text-xs">Send Money</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/convert-ngn-to-usd')}
              className="bg-gray-900 border border-gray-800 py-3 flex-1 rounded-xl"
            >
              <Text className="text-white text-center text-xs">Convert NGN â†’ USD</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <Text className="text-white text-sm font-semibold">Bridge account (NGN)</Text>
            <Text className="text-gray-400 text-xs mt-1">Receive NGN deposits here.</Text>

            {anchorNormalized.hasAccountNumber ? (
              <View className="mt-3">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-gray-400 text-xs">Account number</Text>
                    <Text className="text-white text-lg font-semibold mt-1">
                      {anchorNormalized.displayAccountNumber || '----'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={async () => {
                      const raw = anchorNormalized.rawAccountNumber
                      if (!raw) {
                        Alert.alert(
                          'Account number hidden',
                          'Open Virtual Accounts to view the full number.'
                        )
                        return
                      }
                      try {
                        const Clipboard = await import('expo-clipboard')
                        await Clipboard.setStringAsync(String(raw))
                        Alert.alert('Copied', 'Account number copied.')
                      } catch {
                        Alert.alert('Account number', String(raw))
                      }
                    }}
                    className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full"
                  >
                    <Text className="text-white text-xs">Copy</Text>
                  </TouchableOpacity>
                </View>

                {anchorNormalized.accountName ? (
                  <Text className="text-gray-300 text-xs mt-2">
                    Account Name: {anchorNormalized.accountName}
                  </Text>
                ) : null}
                {anchorNormalized.bankName ? (
                  <Text className="text-gray-500 text-xs mt-1">
                    Bank: {anchorNormalized.bankName}
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={() => router.push('/anchor-account')}
                  className="bg-gray-950 border border-gray-800 py-3 rounded-xl mt-3 items-center"
                >
                  <Text className="text-white text-xs font-semibold">View deposit account</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="mt-3">
                <Text className="text-gray-300 text-xs">
                  Set up a virtual account to receive NGN deposits.
                </Text>

                <TouchableOpacity
                  onPress={() => router.push('/anchor-account')}
                  className="bg-gray-950 border border-gray-800 py-3 rounded-xl mt-3 items-center"
                >
                  <Text className="text-white text-xs font-semibold">Set up deposit account</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <Text className={`text-xs tracking-widest uppercase mt-4 ${tunnelLabelClass}`}>Tunnel Wallet</Text>

          {tunnelWallet ? (
            <>
              <Text className={`text-3xl font-semibold mt-2 ${tunnelBalanceClass}`}>
                {tunnelBalanceDisplay}
              </Text>
              {balancesHidden ? (
                <Text className="text-orange-200/70 text-xs mt-1">Balances hidden</Text>
              ) : null}

              <View className="flex-row gap-2 mt-4">
                <TouchableOpacity
                  onPress={() => router.push('/convert-usd-to-ngn')}
                  className="border py-3 flex-1 rounded-xl"
                  style={{ backgroundColor: 'rgba(9, 8, 6, 0.7)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                >
                  <Text className="text-white text-center text-xs">Convert USD â†’ NGN</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/cards')}
                  className="border py-3 flex-1 rounded-xl"
                  style={{ backgroundColor: 'rgba(9, 8, 6, 0.7)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                >
                  <Text className="text-white text-center text-xs">Virtual Cards</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text className="text-gray-300 text-sm mt-2">Activate Tunnel to unlock USD wallet and conversions.</Text>
              {tunnelNotice ? <Text className="text-yellow-400 text-xs mt-2">{tunnelNotice}</Text> : null}

              <TouchableOpacity
                onPress={handleActivateTunnel}
                className="border py-2 rounded-full mt-3"
                style={{ backgroundColor: 'rgba(9, 8, 6, 0.7)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                disabled={tunnelLoading}
              >
                <Text className="text-white text-center text-xs">
                  {tunnelLoading ? 'Activating...' : 'Activate Tunnel'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </>
  )

  return (
    <>
      <ScrollView
        className="flex-1 bg-primary"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4">
          {isTunnelMode && hasLinearGradient ? (
            <LinearGradient
              colors={['rgba(255, 140, 0, 0.4)', 'rgba(11, 17, 32, 0.96)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className={heroCardClass}
              style={heroCardStyle}
            >
              {heroContent}
            </LinearGradient>
          ) : (
            <View className={heroCardClass} style={heroCardStyle}>
              {heroContent}
            </View>
          )}

          <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-white text-sm font-semibold">Filters</Text>
                <Text className="text-gray-400 text-xs mt-1">
                  {transactionFilter === 'all' ? 'All types' : transactionFilter} |{' '}
                  {statusFilter === 'all' ? 'All status' : statusFilter} |{' '}
                  {dateRange === 'all' ? 'All time' : dateRange}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setFiltersOpen(true)}
                className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full"
              >
                <Text className="text-white text-xs">Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-6">
            {((txLoading || listRefreshing) && filteredTransactions.length < 1) ? (
              <ActivityIndicator className="mt-10" size={'large'} />
            ) : txError ? (
              <View className="rounded-2xl border border-red-500/40 bg-red-900/20 px-4 py-4">
                <Text className="text-center text-red-200 text-sm">
                  Unable to load transactions right now.
                </Text>
                <TouchableOpacity
                  onPress={() => void refreshWalletFetches()}
                  className="mt-3 rounded-xl border border-red-400/40 bg-red-950/40 py-2"
                >
                  <Text className="text-center text-red-100 text-xs font-semibold">Retry</Text>
                </TouchableOpacity>
              </View>
            ) : filteredTransactions.length < 1 ? (
              <View className="rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-4">
                <Text className="text-center text-white">No transaction</Text>
              </View>
            ) : (
              filteredTransactions.map((item: any, index: number) => {
                const reference = item?.reference ?? item?.transfer_reference ?? item?.id
                const status = transactionState(item)
                const currency = isTunnelMode ? 'USD' : 'NGN'
                const presentation = formatWalletHistoryPresentation(item)

	                return (
	                  <TouchableOpacity
	                    key={`${item?.id ?? reference ?? item?.created_at}-${index}`}
	                    onPress={() => {
                      const rawRef = String(reference ?? '').trim()
                      const canonicalReference = /^[0-9a-f-]{36}$/i.test(rawRef)
                        ? `wallet-tx-${String(item?.id ?? '').trim()}`
                        : rawRef || `wallet-tx-${String(item?.id ?? '').trim()}`
	                      router.push({
	                        pathname: '/transaction/receipt',
	                        params: {
	                          reference: canonicalReference,
	                        },
	                      })
	                    }}
	                    className="mb-3 rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-4"
	                  >
                    <View className="flex-row justify-between items-start">
                          <View className="flex-1 pr-3">
                            <Text className="text-white font-semibold">{presentation.title}</Text>
                            <Text className="text-gray-500 text-xs mt-1">{presentation.subtitle}</Text>
                          </View>

                          <View className="items-end">
                            <Text className="text-white font-semibold">
                              {moneyFormat(displayAmount(item), currency)}
                            </Text>
                            <Text className={`text-xs mt-1 ${statusTone(status)}`}>{status}</Text>
                          </View>
                    </View>

                    <Text className="text-gray-500 text-xs mt-2">{dateFormat(item.created_at)}</Text>
                  </TouchableOpacity>
                )
              })
            )}
            {filteredTransactions.length > 0 && txNextCursor ? (
              <View className="mt-2 mb-4 items-center">
                <TouchableOpacity
                  onPress={() => void loadMoreTransactions()}
                  disabled={txLoadingMore}
                  className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-full"
                >
                  {txLoadingMore ? (
                    <ActivityIndicator size="small" color="#f59e0b" />
                  ) : (
                    <Text className="text-white text-xs font-semibold">Load more</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <AppModal open={filtersOpen} onclose={() => setFiltersOpen(false)}>
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
          <Text className="text-white text-xl font-semibold text-center mb-2">Filters</Text>
          <Text className="text-gray-400 text-center text-xs mb-5">Refine your wallet activity.</Text>

          {/* Type */}
          <View className="mt-4">
            <Text className="text-white text-xs font-semibold mb-2">Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {transactionOptions.map((o) => {
                const active = transactionFilter === o.value
                return (
                  <TouchableOpacity
                    key={o.value}
                    onPress={() => setTransactionFilter(o.value as any)}
                    className={`px-3 py-2 rounded-full border ${
                      active ? 'bg-app-primary border-app-primary' : 'bg-gray-950 border-gray-800'
                    }`}
                  >
                    <Text className={`text-xs ${active ? 'text-black' : 'text-white'}`}>{o.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Status */}
          <View className="mt-4">
            <Text className="text-white text-xs font-semibold mb-2">Status</Text>
            <View className="flex-row flex-wrap gap-2">
              {statusOptions.map((o) => {
                const active = statusFilter === o.value
                return (
                  <TouchableOpacity
                    key={o.value}
                    onPress={() => setStatusFilter(o.value as any)}
                    className={`px-3 py-2 rounded-full border ${
                      active ? 'bg-app-primary border-app-primary' : 'bg-gray-950 border-gray-800'
                    }`}
                  >
                    <Text className={`text-xs ${active ? 'text-black' : 'text-white'}`}>{o.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Date range */}
          <View className="mt-4">
            <Text className="text-white text-xs font-semibold mb-2">Date range</Text>
            <View className="flex-row flex-wrap gap-2">
              {dateRangeOptions.map((o) => {
                const active = dateRange === o.value
                return (
                  <TouchableOpacity
                    key={o.value}
                    onPress={() => setDateRange(o.value as any)}
                    className={`px-3 py-2 rounded-full border ${
                      active ? 'bg-app-primary border-app-primary' : 'bg-gray-950 border-gray-800'
                    }`}
                  >
                    <Text className={`text-xs ${active ? 'text-black' : 'text-white'}`}>{o.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View className="mt-3 flex-row gap-2">
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="Start YYYY-MM-DD"
              placeholderTextColor="gray"
              className="flex-1 border border-gray-800 rounded-xl px-4 py-3 text-white bg-gray-950"
            />
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="End YYYY-MM-DD"
              placeholderTextColor="gray"
              className="flex-1 border border-gray-800 rounded-xl px-4 py-3 text-white bg-gray-950"
            />
          </View>

          <View className="mt-3">
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search by ref, status, or note"
              placeholderTextColor="gray"
              className="border border-gray-800 rounded-xl px-4 py-3 text-white bg-gray-950"
            />
          </View>

          <TouchableOpacity
            onPress={() => setFiltersOpen(false)}
            className="bg-app-primary py-3 rounded-xl items-center mt-5"
          >
            <Text className="text-black text-sm font-semibold">Apply filters</Text>
          </TouchableOpacity>
        </View>
      </AppModal>

      <AppModal open={sendOpen} onclose={() => setSendOpen(false)}>
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
          <Text className="text-white text-xl font-semibold text-center mb-2">Send money</Text>
          <Text className="text-gray-400 text-center text-xs mb-5">Choose how you want to send your funds.</Text>

          <TouchableOpacity
            onPress={() => {
              setSendOpen(false)
              router.push('/send-money')
            }}
            className="bg-gray-950 border border-gray-800 py-3 rounded-xl items-center"
          >
            <Text className="text-white text-sm font-semibold">Send to BitBridge user</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSendOpen(false)
              if (canUseBankTransfer) {
                router.push('/bank-transfer')
              } else {
                router.push('/bank-transfer/locked')
              }
            }}
            className={`border py-3 rounded-xl items-center mt-3 ${
              canUseBankTransfer ? 'bg-gray-950 border-gray-800' : 'bg-gray-900 border-gray-700'
            }`}
          >
            <Text className="text-white text-sm font-semibold">Bank transfer</Text>
          </TouchableOpacity>
          {!canUseBankTransfer ? (
            <Text className="text-gray-400 text-xs mt-2 text-center">
              Bank transfer requires Tier 2 verification.
            </Text>
          ) : null}
        </View>
      </AppModal>
    </>
  )
}

export default WalletScreen

