import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'
import { useAuth } from '@/services/useAuth'
import { useRouter } from 'expo-router'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import { createOrderFromPurchase } from '@/api/orders'
import Loader from '@/components/Loader'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import FormInput from '@/components/FormInput'
import SelectBoxIcon from '@/components/select-box/SelectBoxIcon'
import FormSelect from '@/components/FormSelect'
import { splitString } from '@/utils'
import { images } from '@/constants/images'

type PriceOption = {
  label: string
  value: string | number | null
  amount: number
}

const normalizeProviderKey = (raw: any) => {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return ''
  // normalize common aliases to match your images keys + backend normalization
  if (['9mobile', '9-mobile', '9_mobil', '9mobil', 'etisalat', 'emts'].includes(s)) return '9mobile'
  return s
}

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  const k = normalizeProviderKey(key)
  return dict[k] ?? dict.fail ?? dict.bg
}

const isRealPlanOption = (x: any) => {
  if (!x) return false
  if (x?.value == null) return false
  const v = String(x.value).trim()
  if (!v) return false
  const label = String(x.label ?? '').trim().toLowerCase()
  if (label.includes('select data plan')) return false
  return true
}

const DataSubscriptionScreen = () => {
  const router = useRouter()
  const { userProfileData } = useAuth()

  const [loader, setLoader] = useState(false)
  const [selectProvider, setSelectedProvider] = useState<any | null>(null)

  const [formValue, setFormValue] = useState({
    billersCode: '',
    amount: '',
    tariff_class: '',
    description: null as string | null,
  })

  const serviceType = 'DATA'

  // ---- products ----
  const fetchProducts = useCallback(() => getProducts({ category: 'mobile provider' }), [])
  const { data: products, error: productsError } = useFetch(fetchProducts)

  // ✅ Only show providers that your upstream actually supports
  const providers = useMemo(() => {
    const list = (products ?? []).filter((item: any) => item?.category === 'mobile provider')

    const unique = new Map<string, any>()
    for (const item of list) {
      const key = normalizeProviderKey(item?.provider ?? item?.name)
      if (!key) continue

      // Hide ntel (upstream rejects: "invalid disco NTEL for vertical DATA")
      if (key === 'ntel') continue

      if (!unique.has(key)) unique.set(key, { ...item, _normalizedProvider: key })
    }
    return Array.from(unique.values())
  }, [products])

  // Default provider (MTN first, else first)
  useEffect(() => {
    if (!providers?.length) return
    const mtn = providers.find((p: any) => normalizeProviderKey(p?.provider) === 'mtn')
    setSelectedProvider(mtn ?? providers[0] ?? null)
  }, [providers])

  const selectedProviderName = useMemo(() => {
    // backend expects provider like mtn/glo/airtel/9mobile (it also accepts 9-mobile, but we normalize anyway)
    return normalizeProviderKey(selectProvider?.provider)
  }, [selectProvider])

  // ---- price list (for ALL providers) ----
  const fetchPriceList = useCallback(() => {
    if (!selectedProviderName) return Promise.resolve([])
    return getPriceList({ provider: selectedProviderName, service_type: serviceType })
  }, [selectedProviderName])

  const { data: priceList, refetch: refetchPriceList } = useFetch(fetchPriceList, false)

  const rawPriceList: PriceOption[] = useMemo(() => {
    if (!Array.isArray(priceList)) return []
    return priceList as any
  }, [priceList])

  const planOptions: PriceOption[] = useMemo(() => {
    return rawPriceList.filter(isRealPlanOption)
  }, [rawPriceList])

  // When provider changes, refetch plans + reset fields
  useEffect(() => {
    if (!selectedProviderName) return
    setFormValue((prev) => ({ ...prev, tariff_class: '', amount: '', description: null }))
    refetchPriceList()
  }, [selectedProviderName, refetchPriceList])

  const handleProviderSelect = (item: any) => {
    setSelectedProvider(item)
  }

  const handleProceed = async () => {
    setLoader(true)
    try {
      const response = await createPurchaseOrder({
        ...formValue,
        email: userProfileData?.email,
        service_type: serviceType,
        biller: String(selectedProviderName).toUpperCase(),
        skip: true,
      })

      const amountValue = Number(formValue.amount)
      if (Number.isFinite(amountValue)) {
        await createOrderFromPurchase({
          product_id: selectProvider?.id,
          amount: amountValue,
          currency: selectProvider?.currency,
          order_type: serviceType,
          extra_info: `Phone: ${formValue.billersCode}`,
        }).catch(() => {})
      }

      if (response) {
        router.push({
          pathname: `/transaction/details` as any,
          params: { orderId: response?.data?.id },
        })
      }
    } finally {
      setLoader(false)
    }
  }

  const planPlaceholder = 'Select data plan'

  return (
    <>
      <View className="flex-1 bg-primary px-4">
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
            <Text className="text-white/70 text-xs tracking-widest uppercase">Mobile</Text>
            <Text className="text-white text-2xl font-semibold mt-2">Data Subscription</Text>
            <Text className="text-gray-400 mt-2 text-sm">Choose a network and subscribe instantly.</Text>
          </View>

          {!!productsError?.message ? (
            <View className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <Text className="text-white font-semibold">Products error</Text>
              <Text className="text-white/80 text-xs">{productsError.message}</Text>
            </View>
          ) : null}

          <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <Text className="text-white text-sm font-semibold">Choose Network</Text>
            <View className="mt-4 flex-row flex-wrap gap-y-4">
              {providers?.map((item: any, index: number) =>
                item ? (
                  <SelectBoxIcon
                    key={String(item?.id ?? item?._normalizedProvider ?? index)}
                    selectedLabel={selectProvider?.provider}
                    onSelect={() => handleProviderSelect(item)}
                    icon={getImageByKey(item?._normalizedProvider ?? item?.provider)}
                    label={item?.provider}
                  />
                ) : null
              )}
            </View>
          </View>

          <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <Text className="text-white text-sm font-semibold">Subscription Details</Text>

            <KeyboardAvoidWrapper>
              <View className="mt-3">
                <FormInput
                  name="billerCode"
                  label="Phone Number"
                  placeHolder="Enter 11 digits Number"
                  onChangeText={(text: string) =>
                    setFormValue((prev) => ({ ...prev, billersCode: text }))
                  }
                  value={formValue.billersCode}
                />

                {planOptions.length > 0 ? (
                  <FormSelect
                    options={planOptions}
                    selectedValue={formValue.tariff_class}
                    name="tariff_class"
                    label="Data Plan"
                    placeHolder={planPlaceholder}
                    onValueChange={(value: string) => {
                      const picked = planOptions.find(
                        (p: any) => String(p?.value) === String(value)
                      )
                      setFormValue((prev) => ({
                        ...prev,
                        tariff_class: value,
                        amount: String(picked?.amount ?? ''),
                        description: picked?.label ?? null,
                      }))
                    }}
                  />
                ) : (
                  <View className="mt-3 rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                    <Text className="text-gray-300 text-xs">
                      {selectedProviderName
                        ? 'Loading data plans…'
                        : 'Select a network to load data plans.'}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleProceed}
                  className="bg-app-primary rounded-xl mt-4 py-4"
                >
                  <Text className="text-white text-center font-semibold">Proceed</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidWrapper>
          </View>
        </ScrollView>
      </View>

      <Loader open={loader} />
    </>
  )
}

export default DataSubscriptionScreen
