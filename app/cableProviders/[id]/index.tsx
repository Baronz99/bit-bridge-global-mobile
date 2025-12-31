import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { images } from '@/constants/images'
import FormInput from '@/components/FormInput'
import { splitString } from '@/utils'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
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
  const fetchProvision = useCallback(() => getProvision(id as string), [id])
  const { data } = useFetch(fetchProvision)

  const { data: priceList, refetch } = useFetch(
    () =>
      getPriceList({
        provider: data?.product.provider,
        service_type: data?.service_type,
      }),
    false
  )
  const safePriceList = priceList ?? []

  useEffect(() => {
    if (data && data?.service_type === 'TV') {
      refetch()
    }
  }, [data, refetch])

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
        email: '',
        service_type: data?.service_type,
        biller: data?.product?.provider?.toUpperCase(),
      })

      setLoader(false)

      if (response)
        router.push({
          pathname: '/cableProviders/[id]/confirm/[orderId]',
          params: { id: String(id), orderId: String(response?.data?.id) },
        })
    } catch (error: any) {
      setLoader(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4 ">
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      >
        <View className="py-6">
          <Image source={getImageByKey(String(splitString(data?.name)))} className="w-full h-40 rounded-lg" />

          <KeyboardAvoidWrapper>
            <View>
              <FormInput
                name="billerCode"
                label="IUC number"
                placeHolder="Enter 10 digit IUC Number"
                onChangeText={(text: string) => setFormValue({ ...formValue, billersCode: text })}
                value={formValue.billersCode}
              />
              {data?.service_type === 'VTU' && (
                <FormInput
                  name="amount"
                  label="amount"
                  placeHolder="Enter Amount"
                  onChangeText={(text: string) => setFormValue({ ...formValue, amount: text })}
                  value={formValue.amount}
                />
              )}

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

              <TouchableOpacity
                onPress={handleFormSubmit}
                className="border rounded-md mt-4 border-alt py-5 "
              >
                <Text className="text-alt text-center">Proceed</Text>
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
