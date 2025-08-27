import { Image, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { useLocalSearchParams, useSearchParams } from 'expo-router/build/hooks'
import useFetch from '@/services/useFetch'
import { useAuth } from '@/services/useAuth'
import { getPurchaseOrder, getUserOrders } from '@/api/billOrder'
import { icons } from '@/constants/icons'
import moneyFormat from '@/utils/moneyFormat'
import { dateFormat } from '@/utils/dateFormat'

const OrderDetails = () => {
  const { id } = useLocalSearchParams()
  const {
    authState: { token },
  } = useAuth()
  const { data, loading } = useFetch(() =>
    getPurchaseOrder({
      id,
      token,
    })
  )

  return (
    <View className="flex-1 bg-primary px-4">
      <Image source={icons.appLogo} className="w-full h-60 0 mt-10 mb-5 mx-auto" />

      <Text className="text-2xl font-bold text-white mb-6">Order Summary</Text>
      {data && (
        <>
          <View className="border  px-4 rounded-lg border-gray-700 py-10">
            {data?.token && (
              <>
                <Text className="text-base text-center text-white">Token</Text>
                <Text className="text-2xl text-center text-alt font-semibold"> {data?.token} </Text>
              </>
            )}

            {data.service_type === 'ELECTRICITY' && <DetailLine value={data.name} label={'Name'} />}

            <DetailLine value={moneyFormat(data?.amount)} label={'Amount'} />
            {data.service_type === 'ELECTRICITY' && (
              <DetailLine value={data.address} label={'Address'} />
            )}
            <DetailLine
              value={data?.meter_number}
              label={
                data.service_type === 'DATA' || data.service_type === 'VTU'
                  ? 'Phone Number'
                  : 'Meter Number'
              }
            />

            <DetailLine value={data?.status} label={'Status'} />
            {data.service_type === 'ELECTRICITY' && (
              <DetailLine value={data.units} label={'Units'} />
            )}
            <DetailLine value={data.email} label={'Email'} />
            <DetailLine value={data.biller} label={'Biller'} />
            <DetailLine value={data.service_type} label={'Service'} />
            <DetailLine value={data.payment_type} label={'Payment'} />
            <DetailLine value={moneyFormat(data?.service_charge)} label={'Service Charge'} />
            <DetailLine value={dateFormat(data.created_at)} label={'Date'} />
            <DetailLine value={data.id} label={'Order Id'} />
          </View>
        </>
      )}
    </View>
  )
}

const DetailLine = ({ label, value }: any) => (
  <View className="flex-row justify-between gap-3 items-center py-2">
    <Text className="text-white ">{label}</Text>
    <Text numberOfLines={2} className="text-white font-semibold ">
      {value}
    </Text>
  </View>
)
export default OrderDetails

const styles = StyleSheet.create({})
