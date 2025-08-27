import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import moneyFormat from '@/utils/moneyFormat'

const Summary = ({ data }: any) => {
  return (
    <View className="space-y-3 overflow-hidden">
      <SummaryRow label="Service Type" value={data?.service_type || 'N/A'} />
      <SummaryRow
        label={`${data?.service_type == 'VTU' ? 'Phone Number' : 'Meter Number'}`}
        value={data?.meter_number || 'N/A'}
      />
      <SummaryRow label="Amount" value={moneyFormat(data?.amount) || '₦0.00'} />
      <SummaryRow label="Description" value={data?.description || 'No description'} />
      {data?.name && <SummaryRow label="Name" value={data?.name || 'No description'} />}
      {data?.address && <SummaryRow label="Address" value={data?.address || 'No description'} />}
    </View>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row gap-4 justify-between items-center">
      <Text className="text-gray-100 ">{label}</Text>
      <Text ellipsizeMode="tail" numberOfLines={2} className="font-medium text-gray-100">
        {value}
      </Text>
    </View>
  )
}
export default Summary
