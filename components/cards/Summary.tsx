import { Text, View } from 'react-native'
import React from 'react'
import moneyFormat from '@/utils/moneyFormat'

const Summary = ({ data , applyCommission}: {data: any; applyCommission: boolean}) => {
  return (
    <View className="space-y-3 overflow-hidden">
      <SummaryRow label="Service Type" value={data?.service_type || 'N/A'} />
      <SummaryRow
        label={`${data?.service_type == 'VTU' ? 'Phone Number' : 'Meter Number'}`}
        value={data?.meter_number || 'N/A'}
      />
      <SummaryRow label="Amount" applyCommission={applyCommission} value={moneyFormat(data?.amount) || '₦0.00'} commission={moneyFormat(data?.bill_commission)} />
      <SummaryRow label="Description" value={data?.description || 'No description'} />
      {data?.name && <SummaryRow label="Name" value={data?.name || 'No description'} />}
      {data?.address && <SummaryRow label="Address" value={data?.address || 'No description'} />}
    </View>
  )
}

function SummaryRow({ label, value, commission, applyCommission = false }: { label: string; value: string; commission?: string;  applyCommission?: boolean  }) {
  return (
    <View className="flex-row gap-4 justify-between items-center">
      <Text className="text-gray-100 ">{label}</Text>
      <View className=' flex-row gap-4'>
      {applyCommission && 
      <Text ellipsizeMode="tail" numberOfLines={2} className="font-medium text-alt " style={{textDecorationColor: 'line-through'}}>
      {commission} 
      </Text>}
       <Text ellipsizeMode="tail" numberOfLines={2} className="font-medium text-gray-100" style={{textDecorationLine: applyCommission ?  'line-through' : "none"}} >
        {value}
      </Text>
      </View>
    </View>
  )
}
export default Summary
