import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { FEATURE_ORDERS } from '@/constants/featureFlags'
import { createOrder } from '@/api/orders'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { getProducts, getProvisions } from '@/api/products'
import useFetch from '@/services/useFetch'
import FormSelect from '@/components/FormSelect'

const OrderConfirm = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState({
    order_type: '',
    total_amount: '',
    extra_info: '',
    product_id: '',
    provision_id: '',
    quantity: '',
    currency: 'NGN',
  })

  const productsFetch = useFetch(() => getProducts())
  const provisionsFetch = useFetch(() => getProvisions())

  if (!FEATURE_ORDERS) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Order Confirmation</Text>
        <Text className="text-gray-400">Orders are currently disabled.</Text>
      </View>
    )
  }

  type Option = { label: string; value: string; currency?: any }

  const productOptions: Option[] = useMemo(() => {
    const list = Array.isArray(productsFetch.data) ? productsFetch.data : []
    const options = list.map((item: any) => ({
      label: item?.name || item?.product || `Product ${item?.id}`,
      value: String(item?.id),
      currency: item?.currency,
    }))
    return [{ label: 'Select Product', value: '' }, ...options]
  }, [productsFetch.data])

  const provisionOptions: Option[] = useMemo(() => {
    const list = Array.isArray(provisionsFetch.data) ? provisionsFetch.data : []
    const filtered = form.product_id
      ? list.filter((item: any) => String(item?.product_id || item?.product?.id) === form.product_id)
      : list
    const options = filtered.map((item: any) => ({
      label: item?.name || item?.provider || `Provision ${item?.id}`,
      value: String(item?.id),
      currency: item?.currency,
    }))
    return [{ label: 'Select Provision (optional)', value: '' }, ...options]
  }, [provisionsFetch.data, form.product_id])

  const handleSubmit = async () => {
    const amount = Number(form.total_amount)
    if (!form.order_type || !amount || !form.product_id) {
      setNotice('Order type, total amount, and product id are required.')
      return
    }

    setLoading(true)
    setNotice(null)
    try {
      const payload = new FormData()
      payload.append('order_detail[order_type]', form.order_type)
      payload.append('order_detail[total_amount]', String(amount))
      if (form.extra_info) payload.append('order_detail[extra_info]', form.extra_info)

      payload.append('order_detail[order_items_attributes][0][product_id]', form.product_id)
      payload.append(
        'order_detail[order_items_attributes][0][amount]',
        String(amount)
      )
      if (form.provision_id) {
        payload.append(
          'order_detail[order_items_attributes][0][provision_id]',
          form.provision_id
        )
      }
      if (form.quantity) {
        payload.append(
          'order_detail[order_items_attributes][0][quantity]',
          form.quantity
        )
      }
      if (form.currency) {
        payload.append(
          'order_detail[order_items_attributes][0][currency]',
          form.currency
        )
      }

      const response = await createOrder(payload)
      const id = response?.data?.id || response?.id
      setNotice(response?.message || 'Order created successfully.')
      if (id) router.push(`/orders/${id}`)
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to create order',
      })
      setNotice(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="pt-8">
          <Text className="text-white text-2xl font-semibold">Create Order</Text>
          <Text className="text-gray-400 mt-1">
            Submit an order_detail payload for checkout.
          </Text>

          <View className="mt-6">
            <FormInput
              label="Order Type"
              value={form.order_type}
              onChangeText={(value: string) =>
                setForm({ ...form, order_type: value })
              }
            />
            <FormInput
              label="Total Amount"
              value={form.total_amount}
              keyboardType="numeric"
              onChangeText={(value: string) =>
                setForm({ ...form, total_amount: value })
              }
            />
            <FormInput
              label="Extra Info (optional)"
              value={form.extra_info}
              onChangeText={(value: string) =>
                setForm({ ...form, extra_info: value })
              }
            />
            {productOptions.length > 1 ? (
              <FormSelect
                label="Product"
                selectedValue={form.product_id}
                onValueChange={(value: string) => {
                  const selected = productOptions.find((item) => item.value === value) as any
                  setForm({
                    ...form,
                    product_id: value,
                    provision_id: '',
                    currency: selected?.currency || form.currency,
                  })
                }}
                options={productOptions}
              />
            ) : (
              <FormInput
                label="Product ID"
                value={form.product_id}
                onChangeText={(value: string) =>
                  setForm({ ...form, product_id: value })
                }
              />
            )}
            {provisionOptions.length > 1 ? (
              <FormSelect
                label="Provision (optional)"
                selectedValue={form.provision_id}
                onValueChange={(value: string) => {
                  const selected = provisionOptions.find((item) => item.value === value) as any
                  setForm({
                    ...form,
                    provision_id: value,
                    currency: selected?.currency || form.currency,
                  })
                }}
                options={provisionOptions}
              />
            ) : (
              <FormInput
                label="Provision ID (optional)"
                value={form.provision_id}
                onChangeText={(value: string) =>
                  setForm({ ...form, provision_id: value })
                }
              />
            )}
            <FormInput
              label="Quantity (optional)"
              value={form.quantity}
              keyboardType="numeric"
              onChangeText={(value: string) =>
                setForm({ ...form, quantity: value })
              }
            />
            <FormInput
              label="Currency"
              value={form.currency}
              onChangeText={(value: string) =>
                setForm({ ...form, currency: value })
              }
            />
          </View>

          {productsFetch.loading || provisionsFetch.loading ? (
            <View className="py-3">
              <ActivityIndicator />
            </View>
          ) : null}

          {productsFetch.error ? (
            <Text className="text-red-400 mt-2">
              Failed to load products. You can still type IDs manually.
            </Text>
          ) : null}

          {notice ? <Text className="text-yellow-400 mt-2">{notice}</Text> : null}

          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-app-primary py-4 rounded-xl mt-6"
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-white text-center font-medium">Create Order</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default OrderConfirm
