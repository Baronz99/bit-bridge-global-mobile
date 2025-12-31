import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'
import useFetch from '@/services/useFetch'
import moneyFormat from '@/utils/moneyFormat'
import { getUserOrders } from '@/api/billOrder'

const index = () => {
  const { data, loading } = useFetch(() => getUserOrders())

  return (
    <View className="flex-1 bg-primary">
      <View className="flex-1">
        <View className="my-4 mx-4">
          <Text className="text-white text-base">Transaction History</Text>
        </View>

        <View className="flex-1 border-b mx-4  border-gray-900 pb-2 mb-2 overflow-hidden ">
          <View className="flex-row rounded bg-gray-800 px-4 py-3">
            <Text className="flex-1 text-gray-300 font-semibold">Service</Text>
            <Text className="flex-1 text-gray-300 text-center font-semibold">Amount (₦)</Text>

            <Text className="flex-1 text-gray-300 text-center font-semibold"> </Text>
          </View>
          <View className="flex-1">
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 40,
                marginBottom: 40,
              }}
              className=""
            >
              {loading ? (
                <ActivityIndicator size={'large'} color={'#000ff'} className="mt-10 self-center" />
              ) : (
                data &&
                data?.map((item: any, index: number) => (
                  <View key={index} className="flex-row border-t border-gray-900 px-4 py-3">
                    <Text className="flex-1 text-gray-200">{item.service_type}</Text>

                    <Text className="flex-1 text-center text-white">
                      {moneyFormat(item.amount)}
                    </Text>
                    <Link
                      href={{
                        pathname: '/orderDetails/[id]',
                        params: { id: String(item?.id) },
                      }}
                      asChild
                    >
                      <Text
                        className={`"flex-1 ${item?.status === 'completed' ? 'text-blue-700' : 'text-red-700'}  text-center`}
                      >
                        Details
                      </Text>
                    </Link>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  )
}

export default index
