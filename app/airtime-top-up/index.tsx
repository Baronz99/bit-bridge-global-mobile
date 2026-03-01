import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'
import { useAuth } from '@/services/useAuth'
import { useRouter } from 'expo-router'
import { images } from '@/constants/images'
import { splitString } from '@/utils'

import SelectBoxIcon from '@/components/select-box/SelectBoxIcon'
import { createPurchaseOrder } from '@/api/billOrder'
import { createOrderFromPurchase } from '@/api/orders'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import Loader from '@/components/Loader'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

const index = () => {
  const router = useRouter()
  const [loader, setLoader] = useState(false)

  const [selectProvider, setSelectedProvider] = useState<any | null>(null)
  const [selectProvision, setSelectedProvision] = useState<any | null>(null)

  const { userProfileData } = useAuth()

  const [formValue, setFormValue] = useState({
    billersCode: '',
    amount: '',
    tariff_class: '',
    description: null,
  })
  const priceList: any[] = []

  const handleFormSubmit = async () => {
    setLoader(true)

    try {
      const response = await createPurchaseOrder({
        ...formValue,
        email: userProfileData?.email,
        service_type: selectProvision?.service_type,
        biller: selectProvider?.provider?.toUpperCase(),
        skip: true,
      })

      setLoader(false)

      const amountValue = Number(formValue.amount)
      if (Number.isFinite(amountValue)) {
        void createOrderFromPurchase({
          product_id: selectProvider?.id,
          provision_id: selectProvision?.id,
          amount: amountValue,
          currency: selectProvision?.currency || selectProvider?.currency,
          order_type: selectProvision?.service_type,
          extra_info: `Phone: ${formValue.billersCode}`,
        })
      }

      if (response)
        router.push({
          pathname: `/transaction/details`,
          params: {
            orderId: response?.data?.id,
          },
        })
    } catch (error: any) {
      setLoader(false)
    }
  }

  const fetchProducts = useCallback(() => {
    return getProducts({
      category: 'mobile provider',
    })
  }, [])
  const { data } = useFetch(fetchProducts)

  useEffect(() => {
    if (data) {
      const airtimeProvider = data.find(
        (provider: any) => provider.provider.toLowerCase() === 'mtn'
      )

      setSelectedProvider(airtimeProvider)
    }
  }, [data])

  useEffect(() => {
    if (selectProvider) {
      const provision = selectProvider?.provisions?.find((item: any) => item.service_type === 'VTU')

      setSelectedProvision(provision)
    }
  }, [selectProvider])

  const airtimeBillers_ = useMemo(() => {
    const list = (data ?? []).filter((item: any) => item?.category === 'mobile provider')
    const unique = new Map<string, any>()
    for (const item of list) {
      const key = String(item?.provider ?? item?.name ?? '').trim().toLowerCase()
      if (!key) continue
      if (!unique.has(key)) unique.set(key, item)
    }
    return Array.from(unique.values())
  }, [data])

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <View className="flex-1 bg-primary px-4">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
            <Text className="text-white/70 text-xs tracking-widest uppercase">Mobile</Text>
            <Text className="text-white text-2xl font-semibold mt-2">Airtime Top Up</Text>
            <Text className="text-gray-400 mt-2 text-sm">
              Buy airtime instantly across all networks.
            </Text>
          </View>

          <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <Text className="text-white text-sm font-semibold">Choose Network</Text>
            <View className="mt-4 flex-row flex-wrap gap-y-4">
              {airtimeBillers_ &&
                airtimeBillers_?.map((item: any, index: number) =>
                  item ? (
                    <SelectBoxIcon
                      selectedLabel={selectProvider?.provider}
                      key={String(
                        item?.id ?? item?.uuid ?? item?.code ?? item?.provider ?? item?.name ?? index
                      )}
                      onSelect={() => setSelectedProvider(item)}
                      icon={getImageByKey(String(splitString(item?.provider)))}
                      label={item?.provider}
                    />
                  ) : null
                )}
            </View>
          </View>

          <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <Text className="text-white text-sm font-semibold">Top Up Details</Text>
              <View className="mt-3">
                <FormInput
                  name="billerCode"
                  label="Phone Number"
                  placeHolder="Enter 11 digits Number"
                  onChangeText={(text: string) => setFormValue({ ...formValue, billersCode: text })}
                  value={formValue.billersCode}
                />
                {selectProvision?.service_type === 'VTU' && (
                  <FormInput
                    name="amount"
                    label="Amount"
                    placeHolder="Enter Amount"
                    onChangeText={(text: string) => setFormValue({ ...formValue, amount: text })}
                    value={formValue.amount}
                  />
                )}

                {selectProvision?.service_type === 'DATA' && (
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
                  className="bg-app-primary rounded-xl mt-4 py-4"
                >
                  <Text className="text-white text-center font-semibold">Proceed</Text>
                </TouchableOpacity>
              </View>
          </View>
        </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <Loader open={loader} />
    </>
  )
}

export default index
