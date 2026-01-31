import React, { useMemo } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Link } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getAccounts } from '@/api/account'
import { useAnchorOnboarding } from '@/services/useAnchorOnboarding'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type AnyObj = Record<string, any>

const asObj = (v: unknown): AnyObj => (v && typeof v === 'object' ? (v as AnyObj) : {})

const extractAccountsList = (raw: unknown): any[] => {
  const root = asObj(raw)
  const payload = root?.data ?? root

  if (Array.isArray(payload)) return payload

  const p = asObj(payload)
  const candidates = [p.accounts, p.items, p.results, p.data, p.user_accounts]

  for (const c of candidates) {
    if (Array.isArray(c)) return c
  }

  const nested = asObj(p.data)
  const nestedCandidates = [nested.items, nested.accounts, nested.results]
  for (const c of nestedCandidates) {
    if (Array.isArray(c)) return c
  }

  return []
}

const hasAccountNumber = (account: AnyObj | null): boolean => {
  if (!account) return false
  const number = String(account.account_number ?? account.number ?? '').trim()
  return Boolean(number)
}

const AccountsScreen = () => {
  const accountsFetch = useFetch(() => getAccounts())
  const anchorState = useAnchorOnboarding({ autoFetchOnMount: false, autoFetchOnFocus: false })

  const accounts = useMemo(() => extractAccountsList(accountsFetch.data), [accountsFetch.data])

  const primaryAccount = useMemo(
    () => accounts.find((account) => hasAccountNumber(account as AnyObj)) || null,
    [accounts]
  )

  const hasDepositAccount = useMemo(() => {
    if (anchorState.hasAccountNumber) return true
    return accounts.some((account) => hasAccountNumber(account as AnyObj))
  }, [anchorState.hasAccountNumber, accounts])

  const hasError = Boolean(accountsFetch.error || anchorState.error)

  const errorMessage = useMemo(() => {
    if (!hasError) return null

    return (
      accountsFetch.error?.message ||
      anchorState.error?.message ||
      buildApiErrorMessage({
        status: accountsFetch.error?.response?.status || anchorState.error?.response?.status,
        data: accountsFetch.error?.response?.data || anchorState.error?.response?.data,
        fallback: 'Something went wrong',
      })
    )
  }, [hasError, accountsFetch.error, anchorState.error])

  const loading = Boolean(accountsFetch.loading || anchorState.loading)
  const showCreate =
    anchorState.isHydrated &&
    anchorState.hasAnchorAccount &&
    anchorState.kycState === 'verified' &&
    !anchorState.hasAccountNumber

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white/70 text-xs tracking-widest uppercase">Accounts</Text>
          <Text className="text-white text-2xl font-semibold mt-2">Virtual Accounts</Text>
          <Text className="text-gray-400 mt-2 text-sm">
            Use these accounts to fund your wallet instantly.
          </Text>
        </View>

        {loading ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : null}

        {errorMessage ? (
          <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
            <Text className="text-white font-semibold">Error</Text>
            <Text className="text-white/80">{errorMessage}</Text>
          </View>
        ) : null}

        {anchorState.accountNumber || primaryAccount ? (
          <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-6">
            <Text className="text-white font-semibold">Primary Account</Text>
            {anchorState.accountNumber ? (
              <Text className="text-gray-300 mt-2">
                Account Number: {anchorState.accountNumber}
              </Text>
            ) : primaryAccount?.account_number ? (
              <Text className="text-gray-300 mt-2">
                Account Number: {primaryAccount.account_number}
              </Text>
            ) : null}
            {anchorState.accountName ? (
              <Text className="text-gray-300">Account Name: {anchorState.accountName}</Text>
            ) : primaryAccount?.account_name ? (
              <Text className="text-gray-300">Account Name: {primaryAccount.account_name}</Text>
            ) : null}
            {anchorState.bankName ? (
              <Text className="text-gray-300">Bank: {anchorState.bankName}</Text>
            ) : primaryAccount?.bank_name || primaryAccount?.bank ? (
              <Text className="text-gray-300">
                Bank: {primaryAccount.bank_name || primaryAccount.bank}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="mt-6 gap-3">
          {!loading && accounts.length === 0 ? (
            <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <Text className="text-gray-300 text-center">No virtual accounts yet.</Text>
            </View>
          ) : null}

          {accounts.map((account: any, index: number) => (
            <View
              key={String(account?.id ?? account?.account_number ?? index)}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
            >
              <Text className="text-white font-semibold">
                {account?.bank_name || account?.bank || 'Bank Account'}
              </Text>
              <Text className="text-gray-300 text-xs mt-1">
                {account?.account_number || account?.number || '----'}
              </Text>
              {account?.account_name ? (
                <Text className="text-gray-400 text-xs mt-1">{account.account_name}</Text>
              ) : null}
            </View>
          ))}
        </View>

        <View className="mt-8 gap-3">
          {showCreate ? (
            <Link href="/accounts/create" asChild>
              <TouchableOpacity className="bg-app-primary py-4 rounded-xl">
                <Text className="text-white text-center font-medium">Create Deposit Account</Text>
              </TouchableOpacity>
            </Link>
          ) : null}
          <Link href="/anchor-account" asChild>
            <TouchableOpacity className="bg-gray-900 border border-gray-800 py-4 rounded-xl">
              <Text className="text-white text-center font-medium">Manage Anchor Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </View>
  )
}

export default AccountsScreen
