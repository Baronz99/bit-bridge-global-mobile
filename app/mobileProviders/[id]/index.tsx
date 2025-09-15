import { Image, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { images } from '@/constants/images'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { splitString } from '@/utils'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import FormSelect from '@/components/FormSelect'
import Loader from '@/components/Loader'
import { useIsFocused } from '@react-navigation/native'
const ProvideDertails = () => {
  const { id } = useLocalSearchParams()
  const [loader, setLoader] = useState(false)
  const isFocused = useIsFocused()

  const router = useRouter()
  const {
    authState: { token },
    userProfileData,
  } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const { data } = useFetch(() =>
    getProvision({
      id: id as string,
      token: token,
    })
  )

  const { data: priceList, refetch } = useFetch(
    () =>
      getPriceList({
        id: id as string,
        provider: data?.product.provider,
        service_type: data?.service_type,
        token: token,
      }),
    false
  )

  useEffect(() => {
    if (data && data?.service_type === 'DATA') {
      refetch()
    }
  }, [data])

  // const {}
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
        orderData: {
          ...formValue,
          email: userProfileData?.email,
          service_type: data.service_type,
          biller: data.product.provider.toUpperCase(),
          skip: true,
        },
        token,
      })

      setLoader(false)

      if (response) router.push({pathname: `/transaction/details`, params: {
        id: id, 
        orderId: response?.data?.id
      }
      })
    } catch (error: any) {
      setLoader(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <View className="flex-1 bg-primary px-4">
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 80,
          }}
          showsVerticalScrollIndicator={false}
          className="flex-1"
        >
          <View className="py-6">
            <Image
              source={images[`${splitString(data?.name)}`]}
              className="w-full h-40 rounded-lg"
            />

            <KeyboardAvoidWrapper>
              <View>
                <FormInput
                  name="billerCode"
                  label="Phone Number"
                  placeHolder="Enter 11 digits Number"
                  onChangeText={(text: string) => setFormValue({ ...formValue, billersCode: text })}
                  value={formValue.billersCode}
                />
                {data?.service_type === 'VTU' && (
                  <FormInput
                    name="amount"
                    label="Amount"
                    placeHolder="Enter Amount"
                    onChangeText={(text: string) => setFormValue({ ...formValue, amount: text })}
                    value={formValue.amount}
                  />
                )}

                {data?.service_type === 'DATA' && (
                  <FormSelect
                    options={priceList ?? []}
                    selectedValue={formValue.tariff_class}
                    name="tarrif_class"
                    label="Data Plan"
                    placeHolder="Data Plan"
                    onValueChange={(value: string) => {
                      const newAmountdata = priceList.find((price: any) => price.value === value)

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
    </SafeAreaView>
  )
}

export default ProvideDertails
