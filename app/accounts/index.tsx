import React, { useMemo } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Link } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getAccounts, getUserAccountDetail } from '@/api/account'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type AnyObj = Record<string, any>

const asObj = (v: unknown): AnyObj => (v && typeof v === 'object' ? (v as AnyObj) : {})
const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : [])

const extractAccountsList = (raw: unknown): any[] => {
  const root = asObj(raw)
  const payload = root?.data ?? root

  // common list containers
  if (Array.isArray(payload)) return payload

  const p = asObj(payload)

  // try common keys
  const candidates = [
    p.accounts,
    p.items,
    p.results,
    p.data, // sometimes nested
    p.user_accounts,
  ]

  for (const c of candidates) {
    if (Array.isArray(c)) return c
  }

  // sometimes: { data: { items: [...] } }
  const nested = asObj(p.data)
  const nestedCandidates = [nested.items, nested.accounts, nested.results]
  for (const c of nestedCandidates) {
    if (Array.isArray(c)) return c
  }

  return []
}

const extractAccountDetail = (raw: unknown): AnyObj | null => {
  const root = asObj(raw)
  const payload = root?.data ?? root
  if (!payload) return null

  // sometimes API returns the detail object directly
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    const p = asObj(payload)

    // common keys for "primary account"
    const candidate =
      p.account ??
      p.detail ??
      p.details ??
      p.primary ??
      p.primary_account ??
      p.user_account ??
      p.data // sometimes nested

    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const c = asObj(candidate)
      // if it looks like a detail object
      if (c.account_number || c.account_name || c.bank_name || c.bank) return c
    }

    // if payload itself looks like a detail object
    if (p.account_number || p.account_name || p.bank_name || p.bank) return p
  }

  return null
}

const AccountsScreen = () => {
  const accountsFetch = useFetch(() => getAccounts())
  const detailsFetch = useFetch(() => getUserAccountDetail())

  const accounts = useMemo(() => extractAccountsList(accountsFetch.data), [accountsFetch.data])

  const accountDetail = useMemo(
    () => extractAccountDetail(detailsFetch.data),
    [detailsFetch.data]
  )

  const hasError = Boolean(accountsFetch.error || detailsFetch.error)

  const errorMessage = useMemo(() => {
    if (!hasError) return null

    return (
      accountsFetch.error?.message ||
      detailsFetch.error?.message ||
      buildApiErrorMessage({
        status: accountsFetch.error?.response?.status || detailsFetch.error?.response?.status,
        data: accountsFetch.error?.response?.data || detailsFetch.error?.response?.data,
        fallback: 'Something went wrong',
      })
    )
  }, [hasError, accountsFetch.error, detailsFetch.error])

  const loading = Boolean(accountsFetch.loading || detailsFetch.loading)

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

        {accountDetail ? (
          <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-6">
            <Text className="text-white font-semibold">Primary Account</Text>
            {accountDetail?.account_number ? (
              <Text className="text-gray-300 mt-2">
                Account Number: {accountDetail.account_number}
              </Text>
            ) : null}
            {accountDetail?.account_name ? (
              <Text className="text-gray-300">Account Name: {accountDetail.account_name}</Text>
            ) : null}
            {accountDetail?.bank_name || accountDetail?.bank ? (
              <Text className="text-gray-300">
                Bank: {accountDetail.bank_name || accountDetail.bank}
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
          <Link href="/accounts/create" asChild>
            <TouchableOpacity className="bg-app-primary py-4 rounded-xl">
              <Text className="text-white text-center font-medium">Create Deposit Account</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/anchor-account" asChild>
            <TouchableOpacity className="bg-gray-900 border border-gray-800 py-4 rounded-xl">
              <Text className="text-white text-center font-medium">View Anchor Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </View>
  )
}

export default AccountsScreen
