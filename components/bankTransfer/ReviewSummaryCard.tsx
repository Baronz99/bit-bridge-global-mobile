import React from 'react'
import { Text, View } from 'react-native'
import { formatNaira, maskAccountNumber } from '@/utils/bankTransfer'

type ReviewSummaryCardProps = {
  recipientName: string
  bankName: string
  accountNumber: string
  amount: number
  fee: number
  totalDebit: number
  description?: string
  dailyRemainingAfter: number
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row items-start justify-between py-2 border-b border-gray-800">
    <Text className="text-gray-400 text-xs">{label}</Text>
    <Text className="text-white text-sm text-right max-w-[70%]">{value}</Text>
  </View>
)

const ReviewSummaryCard = ({
  recipientName,
  bankName,
  accountNumber,
  amount,
  fee,
  totalDebit,
  description,
  dailyRemainingAfter,
}: ReviewSummaryCardProps) => (
  <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
    <Text className="text-white text-base font-semibold mb-2">Transfer summary</Text>
    <Row label="From" value="BitBridge NGN Wallet" />
    <Row label="To" value={recipientName} />
    <Row label="Bank" value={bankName} />
    <Row label="Account" value={maskAccountNumber(accountNumber)} />
    <Row label="Amount" value={formatNaira(amount)} />
    <Row label="Fee" value={formatNaira(fee)} />
    <Row label="Total Debit" value={formatNaira(totalDebit)} />
    {description ? <Row label="Narration" value={description} /> : null}
    <Row label="Daily Remaining after transfer" value={formatNaira(dailyRemainingAfter)} />
  </View>
)

export default ReviewSummaryCard
