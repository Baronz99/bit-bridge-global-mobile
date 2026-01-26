import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TouchableOpacity,
  TextInput,
  UIManager,
  View,
} from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '@/services/useAuth'
import moneyFormat from '@/utils/moneyFormat'
import { icons } from '@/constants/icons'
import useFetch from '@/services/useFetch'
import { getTransactions } from '@/api/transactions'
import { dateFormat } from '@/utils/dateFormat'
import { useRouter } from 'expo-router'
import { activateTunnel, getUserWallet } from '@/api/wallet'
import { getUserAnchorAccountDetail } from '@/api/account'
import AppModal from '@/components/modal/Modal'
import ScreenContainer from '@/components/ScreenContainer'

const wallet = () => {
  const { userProfileData } = useAuth()
  const router = useRouter()

  const [walletMode, setWalletMode] = useState<'bridge' | 'tunnel'>('bridge')
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'deposit' | 'withdraw'>(
    'all'
  )
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'initialized' | 'failed'>(
    'all'
  )
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)

  const isTunnelMode = walletMode === 'tunnel'
  const heroCardClass = 'rounded-3xl border p-5 overflow-hidden'
  const heroCardStyle = isTunnelMode
    ? { borderColor: 'rgba(245, 158, 11, 0.45)' }
    : { backgroundColor: 'rgba(17, 24, 39, 0.8)', borderColor: 'rgba(31, 41, 55, 1)' }
  const modeSwitchClass = 'flex-row items-center gap-2 rounded-2xl border p-1'
  const modeSwitchStyle = isTunnelMode
    ? { backgroundColor: 'rgba(9, 8, 6, 0.75)', borderColor: 'rgba(245, 158, 11, 0.4)' }
    : { backgroundColor: 'rgba(3, 7, 18, 0.7)', borderColor: 'rgba(31, 41, 55, 1)' }
  const bridgeActiveStyle = !isTunnelMode ? { backgroundColor: 'rgba(31, 41, 55, 0.95)' } : undefined
  const tunnelActiveStyle = isTunnelMode ? { backgroundColor: '#f59e0b' } : undefined
  const tunnelActiveClass = 'bg-orange-500'
  const tunnelInactiveClass = 'bg-transparent'
  const tunnelLabelClass = isTunnelMode ? 'text-orange-100' : 'text-white/70'
  const tunnelBalanceClass = isTunnelMode ? 'text-orange-50' : 'text-white'
  const hasLinearGradient = !!UIManager.getViewManagerConfig?.('ExpoLinearGradient')

  const fetchTransactions = useCallback(() => {
    const baseParams =
      transactionFilter === 'all'
        ? {}
        : {
            transaction_type: transactionFilter,
          }
    return getTransactions({
      params: {
        ...baseParams,
        wallet_type: isTunnelMode ? 'usd' : 'ngn',
      },
    })
  }, [transactionFilter, isTunnelMode])

  const { data, loading, refetch } = useFetch(fetchTransactions)
  const { data: walletData, refetch: refetchWallet } = useFetch(() => getUserWallet())
  const { data: anchorStatus, loading: anchorLoading } = useFetch(() =>
    getUserAnchorAccountDetail()
  )
  const [tunnelLoading, setTunnelLoading] = useState(false)
  const [tunnelNotice, setTunnelNotice] = useState<string | null>(null)

  const walletBalance =
    walletData?.data?.bridge?.balance ??
    walletData?.data?.bridge?.amount ??
    userProfileData?.wallet?.balance
  const walletBalanceValue = Number(walletBalance ?? 0)

  const tunnelWallet = walletData?.data?.tunnel
  const tunnelBalanceValue = Number(tunnelWallet?.balance ?? tunnelWallet?.amount ?? 0)
  const hasAnchorAccount = anchorStatus?.has_anchor_account === true
  const anchorData = anchorStatus?.data ?? null
  const accountNumber = anchorData?.account_number ?? anchorData?.accountNumber
  const accountName = anchorData?.account_name ?? anchorData?.accountName ?? anchorData?.name
  const bankName = anchorData?.bank_name ?? anchorData?.bankName ?? anchorData?.bank

  useEffect(() => {
    refetch()
  }, [refetch, transactionFilter])

  const transactions = useMemo(() => {
    const payload = data?.data ?? data
    const list = payload?.data ?? payload?.transactions ?? payload
    return Array.isArray(list) ? list : []
  }, [data])

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

    return transactions.filter((item: any) => {
      const status = String(item?.status || '').toLowerCase()
      if (statusFilter !== 'all' && status !== statusFilter) return false

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
        item?.description,
        item?.reference,
        item?.id,
        item?.transaction_type,
        item?.type,
        item?.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [transactions, statusFilter, dateRange, searchTerm, startDate, endDate])

  const statusTone = (status: string) => {
    if (status === 'approved') return 'text-green-400'
    if (status === 'initialized') return 'text-yellow-400'
    return 'text-red-400'
  }

  const getWalletDescription = (item: any) => {
    const address = String(item?.address || item?.description || '').toLowerCase()
    const txType = String(item?.transaction_type || item?.type || '').toLowerCase()
    if (address.includes('tunnel conversion') || address.includes('conversion')) {
      if (isTunnelMode) {
        return txType === 'withdrawal' ? 'Convert USD → NGN' : 'Convert NGN → USD'
      }
      return txType === 'withdrawal' ? 'Convert NGN → USD' : 'Convert USD → NGN'
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
      await refetchWallet()
      setWalletMode('tunnel')
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Unable to activate Tunnel wallet.'
      setTunnelNotice(message)
    } finally {
      setTunnelLoading(false)
    }
  }

  const heroContent = (
    <>
      {isTunnelMode ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -60,
              right: -40,
              height: 160,
              width: 160,
              borderRadius: 999,
              backgroundColor: 'rgba(245, 158, 11, 0.22)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -40,
              left: -30,
              height: 140,
              width: 140,
              borderRadius: 999,
              backgroundColor: 'rgba(251, 191, 36, 0.16)',
            }}
          />
        </>
      ) : null}
      <View className={modeSwitchClass} style={modeSwitchStyle}>
        <TouchableOpacity
          onPress={() => setWalletMode('bridge')}
          className={`flex-1 rounded-xl px-3 py-2 ${!isTunnelMode ? 'bg-gray-800' : 'bg-transparent'}`}
          style={bridgeActiveStyle}
        >
          <Text className="text-xs text-center text-white font-semibold">Bridge (NGN)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setWalletMode('tunnel')}
          className={`flex-1 rounded-xl px-3 py-2 ${isTunnelMode ? tunnelActiveClass : tunnelInactiveClass}`}
          style={tunnelActiveStyle}
        >
          <Text className={`text-xs text-center font-semibold ${isTunnelMode ? 'text-black' : 'text-white'}`}>
            Tunnel (USD)
          </Text>
        </TouchableOpacity>
      </View>

      {!isTunnelMode ? (
        <>
          <Text className="text-white/70 text-xs tracking-widest uppercase mt-4">
            Bridge Wallet
          </Text>
          <Text className="text-white text-3xl font-semibold mt-2">
            {moneyFormat(Number.isFinite(walletBalanceValue) ? walletBalanceValue : 0)}
          </Text>

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
              <Text className="text-white text-center text-xs">Convert NGN → USD</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <Text className="text-white text-sm font-semibold">Bridge account (NGN)</Text>
            <Text className="text-gray-400 text-xs mt-1">
              Use this virtual account for Naira deposits.
            </Text>

            {anchorLoading ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#f59e0b" />
              </View>
            ) : hasAnchorAccount && accountNumber ? (
              <View className="mt-3">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-gray-400 text-xs">Account number</Text>
                    <Text className="text-white text-lg font-semibold mt-1">
                      {accountNumber}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        const Clipboard = await import('expo-clipboard')
                        await Clipboard.setStringAsync(String(accountNumber))
                        Alert.alert('Copied', 'Account number copied.')
                      } catch {
                        Alert.alert('Account number', String(accountNumber))
                      }
                    }}
                    className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full"
                  >
                    <Text className="text-white text-xs">Copy</Text>
                  </TouchableOpacity>
                </View>

                {accountName ? (
                  <Text className="text-gray-300 text-xs mt-2">{accountName}</Text>
                ) : null}
                {bankName ? (
                  <Text className="text-gray-500 text-xs mt-1">{bankName}</Text>
                ) : null}
              </View>
            ) : (
              <View className="mt-3">
                <Text className="text-gray-300 text-xs">
                  Create your Bridge account after completing the required profile and KYC checks.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/anchor-account')}
                  className="bg-gray-950 border border-gray-800 py-3 rounded-xl mt-3 items-center"
                >
                  <Text className="text-white text-xs font-semibold">Create NGN account</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <Text className={`text-xs tracking-widest uppercase mt-4 ${tunnelLabelClass}`}>
            Tunnel Wallet
          </Text>
          {tunnelWallet ? (
            <>
              <Text className={`text-3xl font-semibold mt-2 ${tunnelBalanceClass}`}>
                {moneyFormat(
                  Number.isFinite(tunnelBalanceValue) ? tunnelBalanceValue : 0,
                  'USD'
                )}
              </Text>
              <View className="flex-row gap-2 mt-4">
                <TouchableOpacity
                  onPress={() => router.push('/convert-usd-to-ngn')}
                  className="border py-3 flex-1 rounded-xl"
                  style={{
                    backgroundColor: 'rgba(9, 8, 6, 0.7)',
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                  }}
                >
                  <Text className="text-white text-center text-xs">Convert USD → NGN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/cards')}
                  className="border py-3 flex-1 rounded-xl"
                  style={{
                    backgroundColor: 'rgba(9, 8, 6, 0.7)',
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                  }}
                >
                  <Text className="text-white text-center text-xs">Virtual Cards</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text className="text-gray-300 text-sm mt-2">
                Activate Tunnel to unlock USD wallet and conversions.
              </Text>
              {tunnelNotice ? (
                <Text className="text-yellow-400 text-xs mt-2">{tunnelNotice}</Text>
              ) : null}
              <TouchableOpacity
                onPress={handleActivateTunnel}
                className="border py-2 rounded-full mt-3"
                style={{
                  backgroundColor: 'rgba(9, 8, 6, 0.7)',
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                }}
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
      <ScreenContainer>
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
          {loading ? (
            <ActivityIndicator className="mt-10" size={'large'} />
          ) : filteredTransactions.length < 1 ? (
            <View className="rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-4">
              <Text className="text-center text-white">No transaction</Text>
            </View>
          ) : (
            filteredTransactions.map((item: any, index: number) => {
              const reference = item?.reference ?? item?.id
              const status = String(item?.status || 'pending').toLowerCase()
              const description = getWalletDescription(item)
              const currency = isTunnelMode ? 'USD' : 'NGN'
              return (
                <TouchableOpacity
                  key={`${item?.id ?? reference ?? item?.created_at}-${index}`}
                  onPress={() => {
                    router.push({
                      pathname: '/transaction/wallet-receipt',
                      params: {
                        id: String(item?.id ?? ''),
                        reference: String(reference ?? ''),
                        amount: String(item?.amount ?? 0),
                        currency,
                        status: String(status),
                        description: String(description),
                        created_at: String(item?.created_at ?? ''),
                        wallet_type: isTunnelMode ? 'usd' : 'ngn',
                        transaction_type: String(item?.transaction_type || item?.type || ''),
                        address: String(item?.address || ''),
                      },
                    })
                  }}
                  className="mb-3 rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-4"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-3">
                      <Text className="text-white font-semibold">{description}</Text>
                      <Text className="text-gray-500 text-xs mt-1">
                        Ref {reference || 'pending'}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-white font-semibold">
                        {moneyFormat(item.amount, currency)}
                      </Text>
                      <Text className={`text-xs mt-1 ${statusTone(status)}`}>{status}</Text>
                    </View>
                  </View>
                  <Text className="text-gray-500 text-xs mt-2">{dateFormat(item.created_at)}</Text>
                </TouchableOpacity>
              )
            })
          )}
        </View>
      </ScreenContainer>

      <AppModal open={filtersOpen} onclose={() => setFiltersOpen(false)}>
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
          <Text className="text-white text-xl font-semibold text-center mb-2">Filters</Text>
          <Text className="text-gray-400 text-center text-xs mb-5">
            Refine your wallet activity.
          </Text>

          {renderOptionGroup(
            'Type',
            transactionFilter,
            transactionOptions,
            (value) => setTransactionFilter(value as 'all' | 'deposit' | 'withdraw')
          )}
          {renderOptionGroup(
            'Status',
            statusFilter,
            statusOptions,
            (value) => setStatusFilter(value as 'all' | 'approved' | 'initialized' | 'failed')
          )}
          {renderOptionGroup(
            'Date range',
            dateRange,
            dateRangeOptions,
            (value) => setDateRange(value as 'all' | '7d' | '30d')
          )}

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
          <Text className="text-gray-400 text-center text-xs mb-5">
            Choose how you want to send your funds.
          </Text>

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
              router.push('/bank-transfer')
            }}
            className="bg-gray-950 border border-gray-800 py-3 rounded-xl items-center mt-3"
          >
            <Text className="text-white text-sm font-semibold">Bank transfer</Text>
          </TouchableOpacity>
        </View>
      </AppModal>
    </>
  )
}

export default wallet
