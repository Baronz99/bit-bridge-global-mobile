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
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { images } from '@/constants/images'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { splitString } from '@/utils'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import { createOrderFromPurchase } from '@/api/orders'
import FormSelect from '@/components/FormSelect'
import Loader from '@/components/Loader'
import useServiceAvailability from '@/hooks/useServiceAvailability'
import ServiceStatusPill from '@/components/service-availability/ServiceStatusPill'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

const ProvideDertails = () => {
  const { id } = useLocalSearchParams()
  const [loader, setLoader] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const router = useRouter()
  const { userProfileData } = useAuth()
  const { getStatus } = useServiceAvailability()
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

  const selectedServiceStatus = useMemo(
    () => getStatus({ provider: data?.product?.provider, serviceType, label: providerName }),
    [data?.product?.provider, getStatus, providerName, serviceType]
  )

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

  const phoneDigits = useMemo(() => String(formValue.billersCode || '').replace(/\D/g, ''), [formValue.billersCode])
  const realPlanSelected = useMemo(() => {
    if (serviceType !== 'DATA') return true
    const picked = safePriceList.find((price: any) => String(price?.value) === String(formValue.tariff_class))
    return Boolean(picked && picked.value != null && !String(picked?.label ?? '').toLowerCase().includes('select data plan'))
  }, [formValue.tariff_class, safePriceList, serviceType])
  const canProceed = useMemo(() => {
    if (serviceType === 'DATA') {
      return phoneDigits.length === 11 && realPlanSelected && Number(formValue.amount) > 0
    }
    return phoneDigits.length === 11 && Number(formValue.amount) > 0
  }, [formValue.amount, phoneDigits.length, realPlanSelected, serviceType])

  const handleFormSubmit = async () => {
    setSubmitError('')
    if (phoneDigits.length !== 11) {
      setSubmitError('Enter a valid 11-digit phone number.')
      return
    }
    if (serviceType === 'DATA' && !realPlanSelected) {
      setSubmitError('Select a valid data plan to continue.')
      return
    }
    if (!(Number(formValue.amount) > 0)) {
      setSubmitError(serviceType === 'DATA' ? 'Unable to resolve the selected plan amount. Choose the plan again.' : 'Enter a valid amount to continue.')
      return
    }

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
      setSubmitError(String(error?.message || 'Unable to start this purchase right now.'))
    } finally {
      setLoader(false)
    }
  }

  return (
    <>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <View className="flex-1 bg-primary px-4">
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
          <View className="mt-3 flex-row items-center justify-between rounded-xl border border-gray-800 bg-gray-950/40 px-3 py-2">
            <Text className="text-gray-300 text-xs">Current service signal</Text>
            <ServiceStatusPill state={selectedServiceStatus.state} />
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

              {submitError ? (
                <View className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                  <Text className="text-white text-xs">{submitError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleFormSubmit}
                disabled={!canProceed || loader}
                className={`rounded-xl mt-4 py-4 ${!canProceed || loader ? 'bg-app-primary/40' : 'bg-app-primary'}`}
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

export default ProvideDertails
