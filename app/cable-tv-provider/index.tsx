import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'
import { useAuth } from '@/services/useAuth'
import { useRouter } from 'expo-router'
import { images } from '@/constants/images'
import { splitString } from '@/utils'
import SelectBoxIcon from '@/components/select-box/SelectBoxIcon'
import FormSelect from '@/components/FormSelect'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import { createOrderFromPurchase } from '@/api/orders'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import FormInput from '@/components/FormInput'
import Loader from '@/components/Loader'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'
import useNotification from '@/hooks/useNotification'
import useServiceAvailability from '@/hooks/useServiceAvailability'
import ServiceStatusPill from '@/components/service-availability/ServiceStatusPill'

const normalizeProviderKey = (raw: any) => String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '_')
const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  const k = normalizeProviderKey(key)
  return dict[k] ?? dict.fail ?? dict.bg
}

const index = () => {
  const { userProfileData } = useAuth()
  const router = useRouter()

  const [loader, setLoader] = useState(false)
  const { notification, setNotification } = useNotification()
  const [selectProvider, setSelectedProvider] = useState<any | null>(null)
  const [selectProvision, setSelectedProvision] = useState<any | null>(null)
  const { getStatus } = useServiceAvailability()
  const [formValue, setFormValue] = useState({
    billersCode: '',
    amount: '',
    tariff_class: '',
    description: null,
  })

  const fetchProducts = useCallback(() => getProducts({ category: 'utility' }), [])
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

  const cableProviders = useMemo(() => {
    const list = (data ?? []).filter((item: any) => item?.category === 'utility')
    const unique = new Map<string, any>()
    for (const item of list) {
      const key = normalizeProviderKey(item?.provider ?? item?.name)
      if (!key) continue
      if (!unique.has(key)) unique.set(key, item)
    }
    return Array.from(unique.values())
  }, [data])

  const statusForProvider = useCallback(
    (provider: any) => getStatus({ provider: provider?.provider, serviceType: 'TV' }),
    [getStatus]
  )
  const selectedServiceStatus = useMemo(() => statusForProvider(selectProvider), [selectProvider, statusForProvider])

  const handleFormSubmit = async () => {
    if (!formValue.billersCode || !formValue.amount || !formValue.tariff_class) {
      setNotification({ message: 'Please fill all required fields', error: true, data: null })
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
      setLoader(false)

      const amountValue = Number(formValue.amount)
      if (Number.isFinite(amountValue)) {
        void createOrderFromPurchase({
          product_id: selectProvider?.id,
          provision_id: selectProvision?.id,
          amount: amountValue,
          currency: selectProvision?.currency || selectProvider?.currency,
          order_type: selectProvision?.service_type,
          extra_info: `IUC: ${formValue.billersCode}`,
        })
      }

      router.push({
        pathname: '/cable-tv-provider/confirm/[orderId]',
        params: { orderId: String(response?.data?.id) },
      })
    } catch (error: any) {
      setNotification({ message: error.message || 'Something went wrong', error: true, data: null })
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
    if (selectProvision) refetch()
  }, [selectProvision, refetch])

  useEffect(() => {
    if (selectProvider) {
      const provision = selectProvider?.provisions?.find((item: any) => item.service_type.toLowerCase() === 'tv')
      setSelectedProvision(provision)
    }
  }, [selectProvider])

  const priceListData = safePriceList.length
    ? safePriceList
    : [
        { label: 'Select Data Plan', value: 'Select Data Plan', amount: 0 },
        { label: 'Loading', value: 'Loading', amount: 0 },
      ]

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white/70 text-xs tracking-widest uppercase">Utilities</Text>
          <Text className="text-white text-2xl font-semibold mt-2">Cable TV Subscription</Text>
          <Text className="text-gray-400 mt-2 text-sm">Renew your favorite TV packages in seconds.</Text>
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-white text-sm font-semibold">Choose Provider</Text>
          <View className="mt-4 flex-row flex-wrap gap-y-4">
            {cableProviders?.map((item: any, index: number) =>
              item ? (
                <SelectBoxIcon
                  key={String(item?.id ?? item?.uuid ?? item?.code ?? item?.provider ?? item?.name ?? index)}
                  onSelect={() => setSelectedProvider(item)}
                  selectedLabel={selectProvider?.provider?.toLowerCase()}
                  icon={getImageByKey(String(splitString(item?.provider)))}
                  label={splitString(item?.provider)}
                  statusState={statusForProvider(item)?.state}
                />
              ) : null
            )}
          </View>
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-white text-sm font-semibold">Subscription Details</Text>
          {selectProvider ? (
            <View className="mt-3 flex-row items-center justify-between rounded-xl border border-gray-800 bg-gray-950/40 px-3 py-2">
              <Text className="text-gray-300 text-xs">Current service signal</Text>
              <ServiceStatusPill state={selectedServiceStatus.state} />
            </View>
          ) : null}
          <KeyboardAvoidWrapper>
            <View className="mt-3">
              <FormInput
                name="billerCode"
                label="IUC number"
                placeHolder="Enter 10 digit IUC Number"
                onChangeText={(text: string) => setFormValue({ ...formValue, billersCode: text })}
                value={formValue.billersCode}
              />

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

              <TouchableOpacity onPress={handleFormSubmit} className="bg-app-primary rounded-xl mt-4 py-4">
                <Text className="text-white text-center font-semibold">Proceed</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidWrapper>
        </View>
      </ScrollView>

      <Loader open={loader} />
      <AppModal open={!!notification.message} onclose={() => setNotification({ message: null, error: false, data: null })}>
        <NotificationAlert
          onPress={() => setNotification({ message: null, error: false, data: null })}
          message={notification.message}
          error={notification.error}
          data={notification.data}
        />
      </AppModal>
    </View>
  )
}

export default index
