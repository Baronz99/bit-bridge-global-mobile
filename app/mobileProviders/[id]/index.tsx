import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { images } from '@/constants/images'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { splitString } from '@/utils'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import { createOrderFromPurchase } from '@/api/orders'
import FormSelect from '@/components/FormSelect'
import Loader from '@/components/Loader'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}
const ProvideDertails = () => {
  const { id } = useLocalSearchParams()
  const [loader, setLoader] = useState(false)

  const router = useRouter()
  const { userProfileData } = useAuth()
  const fetchProvision = useCallback(() => getProvision(id as string), [id])
  const { data } = useFetch(fetchProvision)

  const providerName = useMemo(() => {
    const raw = String(data?.product?.provider ?? '').trim()
    return raw ? String(splitString(raw)) : ''
  }, [data])
  const serviceType = useMemo(() => {
    const raw = String(data?.service_type ?? '').toLowerCase()
    if (raw.includes('data')) return 'DATA'
    if (raw.includes('vtu')) return 'VTU'
    return data?.service_type ?? ''
  }, [data])

  const fetchPriceList = useCallback(() => {
    if (!providerName || serviceType !== 'DATA') return Promise.resolve([])
    return getPriceList({
      provider: providerName,
      service_type: serviceType,
    })
  }, [providerName, serviceType])

  const { data: priceList, refetch } = useFetch(fetchPriceList, false)
  const safePriceList = priceList ?? []

  useEffect(() => {
    if (providerName && serviceType === 'DATA') {
      refetch()
    }
  }, [providerName, serviceType, refetch])

  const [formValue, setFormValue] = useState({
    billersCode: '',
    amount: '',
    tariff_class: '',
    description: null,
  })

  const handleFormSubmit = async () => {
    setLoader(true)

    try {
      const response = await createPurchaseOrder({
        ...formValue,
        email: userProfileData?.email,
        service_type: data?.service_type,
        biller: data?.product?.provider?.toUpperCase(),
        skip: true,
      })

      setLoader(false)

      const amountValue = Number(formValue.amount)
      if (Number.isFinite(amountValue)) {
        void createOrderFromPurchase({
          product_id: data?.product?.id,
          provision_id: data?.id,
          amount: amountValue,
          currency: data?.currency || data?.product?.currency,
          order_type: data?.service_type,
          extra_info: `Phone: ${formValue.billersCode}`,
        })
      }

      if (response)
        router.push({
          pathname: `/transaction/details`,
          params: {
            id: id,
            orderId: response?.data?.id,
          },
        })
    } catch (error: any) {
      setLoader(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      >
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white/70 text-xs tracking-widest uppercase">Mobile</Text>
          <Text className="text-white text-2xl font-semibold mt-2">
            {serviceType === 'DATA' ? 'Data Top Up' : 'Airtime Top Up'}
          </Text>
          <Text className="text-gray-400 mt-2 text-sm">
            {data?.product?.provider || 'Provider'} {data?.service_type || 'top up'}.
          </Text>
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-white text-sm font-semibold">Selected Provider</Text>
          <Image
            source={getImageByKey(String(splitString(data?.name)))}
            className="w-full h-40 rounded-2xl mt-4"
          />
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-white text-sm font-semibold">Top Up Details</Text>
          <KeyboardAvoidWrapper>
            <View className="mt-3">
              <FormInput
                name="billerCode"
                label="Phone Number"
                placeHolder="Enter 11 digits Number"
                onChangeText={(text: string) => setFormValue({ ...formValue, billersCode: text })}
                value={formValue.billersCode}
              />
              {serviceType === 'VTU' && (
                <FormInput
                  name="amount"
                  label="Amount"
                  placeHolder="Enter Amount"
                  onChangeText={(text: string) => setFormValue({ ...formValue, amount: text })}
                  value={formValue.amount}
                />
              )}

              {serviceType === 'DATA' && (
                <FormSelect
                  options={safePriceList}
                  selectedValue={formValue.tariff_class}
                  name="tarrif_class"
                  label="Data Plan"
                  placeHolder="Data Plan"
                  onValueChange={(value: string) => {
                    const newAmountdata = safePriceList.find((price: any) => price.value === value)

                    setFormValue({
                      ...formValue,
                      amount: newAmountdata.amount,
                      description: newAmountdata.label,
                      tariff_class: value,
                    })
                  }}
                />
              )}

              <TouchableOpacity
                onPress={handleFormSubmit}
                className="bg-app-primary rounded-xl mt-4 py-4"
              >
                <Text className="text-white text-center font-semibold">Proceed</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidWrapper>
        </View>
      </ScrollView>
      <Loader open={loader} />
    </View>
  )
}

export default ProvideDertails
