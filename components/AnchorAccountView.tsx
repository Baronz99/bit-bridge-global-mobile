import React from 'react'
import { Feather, Ionicons } from '@expo/vector-icons'
import { Text, TouchableOpacity, View } from 'react-native'

export type AnchorAccountViewProps = {
  statusLabel?: string
  displayAccountNumber?: string | null
  rawAccountNumber?: string | null
  accountName?: string | null
  bankName?: string | null
  onCopyAccount?: () => void
  onShareDetails?: () => void
}

const formatAccountNumber = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return '----'
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

const AnchorAccountView = ({
  statusLabel = 'Deposit account ready',
  displayAccountNumber,
  rawAccountNumber,
  accountName,
  bankName,
  onCopyAccount,
  onShareDetails,
}: AnchorAccountViewProps) => {
  const accountNumber = formatAccountNumber(rawAccountNumber || displayAccountNumber)

  return (
    <View className="mt-6">
      <View className="overflow-hidden rounded-[30px] bg-[#0F1420] px-5 py-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[12px] uppercase tracking-[0.18em] text-slate-500">Bank</Text>
            <Text className="mt-3 text-[28px] font-semibold text-white" numberOfLines={2}>
              {bankName || '9 Payment Service Bank'}
            </Text>
            <View className="mt-3 self-start rounded-full bg-emerald-500/10 px-3 py-1.5">
              <Text className="text-[11px] font-semibold text-emerald-200">
                {String(statusLabel || 'Active').replace('Deposit account ', '')}
              </Text>
            </View>
          </View>
          <View className="mt-1 h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05]">
            <Ionicons name="business-outline" size={18} color="#CBD5E1" />
          </View>
        </View>

        <View className="mt-7">
          <Text className="text-[12px] uppercase tracking-[0.18em] text-slate-500">Account number</Text>
          <Text className="mt-3 text-[36px] font-semibold tracking-[0.08em] text-white">
            {accountNumber}
          </Text>
        </View>

        <View className="mt-7">
          <Text className="text-[12px] uppercase tracking-[0.18em] text-slate-500">Account name</Text>
          <Text className="mt-3 text-[16px] font-medium text-slate-200" numberOfLines={1}>
            {accountName || '--'}
          </Text>
        </View>

        <View className="mt-7 flex-row gap-3">
          <TouchableOpacity
            onPress={onCopyAccount}
            activeOpacity={0.88}
            className="flex-1 rounded-[18px] bg-white/[0.06] px-4 py-3.5"
          >
            <View className="flex-row items-center justify-center gap-2">
              <Feather name="copy" size={15} color="#E2E8F0" />
              <Text className="text-[13px] font-semibold text-white">Copy number</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onShareDetails}
            activeOpacity={0.85}
            className="flex-1 rounded-[18px] bg-white/[0.06] px-4 py-3.5"
          >
            <View className="flex-row items-center justify-center gap-2">
              <Feather name="share-2" size={15} color="#E2E8F0" />
              <Text className="text-[13px] font-semibold text-white">Share details</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text className="mt-5 text-[12px] text-slate-500">
          NGN deposits only  |  Credited to your BitBridge wallet
        </Text>
      </View>
    </View>
  )
}

export default AnchorAccountView
