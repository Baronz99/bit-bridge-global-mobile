import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useState } from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'
import { useAuth } from '@/services/useAuth'
import { useRouter } from 'expo-router'
import { images } from '@/constants/images'
import { splitString } from '@/utils'
import SelectBoxIcon from '@/components/select-box/SelectBoxIcon'
import FormSelect from '@/components/FormSelect'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import FormInput from '@/components/FormInput'
import Loader from '@/components/Loader'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

const index = () => {
  const { userProfileData } = useAuth()
  const router = useRouter()

  const [loader, setLoader] = useState(false)
  const { notification, setNotification } = useNotification()
  const [selectProvider, setSelectedProvider] = useState<any | null>(null)
  const [selectProvision, setSelectedProvision] = useState<any | null>(null)
  const [formValue, setFormValue] = useState({
    billersCode: '',
    amount: '',
    tariff_class: '',
    description: null,
  })

  const fetchProducts = useCallback(() => {
    return getProducts({
      category: 'utility',
    })
  }, [])
  const { data } = useFetch(fetchProducts)

  const { data: priceList, refetch } = useFetch(
    () =>
      getPriceList({
        provider: selectProvider?.provider,
        service_type: selectProvision?.service_type,
      }),
    false
  )
  const safePriceList = priceList ?? []

  const handleFormSubmit = async () => {
    if(!formValue.billersCode || !formValue.amount || !formValue.tariff_class){
      setNotification({
        message: 'Please fill all required fields',
        error: true,
        data: null,
      })
      return
    }
    setLoader(true)
    const orderData = {
      ...formValue,
      email: userProfileData?.email,
      service_type: selectProvision?.service_type,
      biller: selectProvider?.provider?.toUpperCase(),
    }

    try {
      const response = await createPurchaseOrder(orderData)
      console.log(response, "response data")

      setLoader(false)

      router.push({
        pathname: '/cable-tv-provider/confirm/[orderId]',
        params: { orderId: String(response?.data?.id) },
      })
    } catch (error: any) {
      setNotification({
        message: error.message || 'Something went wrong',
        error: true,
        data: null,
      })
      setLoader(false)
    }
  }

  useEffect(() => {
    if (data) {
      const tvProvider = data.find((provider: any) => provider.provider.toLowerCase() === 'dstv')
      setSelectedProvider(tvProvider)
    }
  }, [data])

  useEffect(() => {
    if (selectProvision) {
      refetch()
    }
  }, [selectProvision])

  useEffect(() => {
    if (selectProvider) {
      const provision = selectProvider?.provisions?.find(
        (item: any) => item.service_type.toLowerCase() === 'tv'
      )
      setSelectedProvision(provision)
    }
  }, [selectProvider])

  const cableProviders = data?.map((item: any) => {
    if (item.category === 'utility') {
      return item
    }
  })

  const priceListData = safePriceList.length
    ? safePriceList
    : [
        { label: 'Select Data Plan', value: 'Select Data Plan', amount: 0 },
        { label: 'Loading', value: 'Loading', amount: 0 },
      ]

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="bg-gray-900/60 p-4 rounded-xl">
        <View className="py-4 flex-wrap gap-y-4 flex-row">
          {cableProviders &&
            cableProviders?.map((item: any, index: number) =>
              item ? (
                <SelectBoxIcon
                  key={String(
                    item?.id ?? item?.uuid ?? item?.code ?? item?.provider ?? item?.name ?? index
                  )}
                  onSelect={() => setSelectedProvider(item)}
                  selectedLabel={selectProvider?.provider?.toLowerCase()}
                  icon={getImageByKey(String(splitString(item?.provider)))}
                  label={splitString(item?.provider)}
                />
              ) : null
            )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
        //   className='flex-1'
      >
        <View className="flex-1 bg-primary px-4 ">
          <View className="py-6">
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
                  options={priceListData}
                  selectedValue={formValue.tariff_class}
                  name="tarrif_class"
                  label="Data Plan"
                  placeHolder="Data Plan"
                  onValueChange={(value: string) => {
                    const newAmountdata = priceListData.find((price: any) => price.value === value)

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

          <Loader open={loader} />
          <AppModal
            open={!!notification.message}
            onclose={() => setNotification({ message: null, error: false, data: null })}
          >
            <NotificationAlert
              onPress={() => setNotification({ message: null, error: false, data: null })}
              message={notification.message}
              error={notification.error}
              data={notification.data}
            />
          </AppModal>
        </View>
      </ScrollView>
    </View>
  )
}

export default index
