import { Text, View } from 'react-native'
import React from 'react'
import moneyFormat from '@/utils/moneyFormat'

const Summary = ({ data, applyCommission }: { data: any; applyCommission: boolean }) => {
  const serviceType = String(data?.service_type || '').toUpperCase()
  const isElectricity = serviceType === 'ELECTRICITY'
  const amount = Number(data?.amount) || 0
  const serviceCharge = isElectricity ? Number(data?.service_charge || 0) : 0
  const backendTotal = Number(data?.total_amount)
  const totalDebit =
    Number.isFinite(backendTotal) && backendTotal > 0 ? backendTotal : amount + serviceCharge

  const discountedAmount = Number(data?.bill_commission)
  const hasDiscount =
    Number.isFinite(discountedAmount) && discountedAmount >= 0 && discountedAmount <= amount
  const payableAmount = applyCommission && hasDiscount ? discountedAmount : amount

  return (
    <View className="space-y-3 overflow-hidden">
      <SummaryRow label="Service Type" value={data?.service_type || 'N/A'} />
      <SummaryRow
        label={`${data?.service_type == 'VTU' ? 'Phone Number' : 'Meter Number'}`}
        value={data?.meter_number || 'N/A'}
      />

      <SummaryRow label="Amount" value={moneyFormat(payableAmount) || 'N0.00'} />
      {applyCommission && hasDiscount && (
        <SummaryRow label="Original Amount" value={moneyFormat(amount) || 'N0.00'} strikeValue />
      )}

      {isElectricity && (
        <SummaryRow label="Service Charge" value={moneyFormat(serviceCharge) || 'N0.00'} />
      )}
      {isElectricity && (
        <SummaryRow label="Total Debit" value={moneyFormat(totalDebit) || 'N0.00'} strong />
      )}
      {isElectricity && (
        <SummaryRow
          label="Fee Policy"
          value="Service charge applies to electricity only"
          valueClassName="text-xs"
          multiline
        />
      )}

      <SummaryRow label="Description" value={data?.description || 'No description'} />
      {data?.name && <SummaryRow label="Name" value={data?.name || 'No description'} />}
      {data?.address && <SummaryRow label="Address" value={data?.address || 'No description'} />}
    </View>
  )
}

function SummaryRow({
  label,
  value,
  strikeValue = false,
  strong = false,
  multiline = false,
  valueClassName = '',
}: {
  label: string
  value: string
  strikeValue?: boolean
  strong?: boolean
  multiline?: boolean
  valueClassName?: string
}) {
  return (
    <View className="flex-row gap-4 justify-between items-start">
      <Text className="text-gray-100">{label}</Text>
      <Text
        ellipsizeMode="tail"
        numberOfLines={multiline ? 4 : 2}
        className={`${strong ? 'font-semibold' : 'font-medium'} text-gray-100 text-right ${valueClassName}`}
        style={{ textDecorationLine: strikeValue ? 'line-through' : 'none' }}
      >
        {value}
      </Text>
    </View>
  )
}

export default Summary
