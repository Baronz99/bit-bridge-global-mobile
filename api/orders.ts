import client from '@/api/client'

const errMsg = (err: any, fallback = 'Something went wrong') =>
  err?.response?.data?.message || err?.message || fallback

export const createOrder = async (payload: any) => {
  try {
    const headers =
      typeof FormData !== 'undefined' && payload instanceof FormData
        ? { 'Content-Type': undefined }
        : undefined
    const res = await client.post('/order_details', payload, { headers })
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

export const getOrders = async () => {
  try {
    const res = await client.get('/order_details')
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fetch orders'))
  }
}

export const getOrder = async (id: string) => {
  try {
    const res = await client.get(`/order_details/${id}`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fetch order'))
  }
}

export const getUserOrders = async () => {
  try {
    const res = await client.get('/order_details/user')
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fetch user orders'))
  }
}

export const updateOrder = async (id: string, payload: any) => {
  try {
    const res = await client.patch(`/order_details/${id}`, payload)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to update order'))
  }
}

export const createOrderFromPurchase = async (payload: {
  product_id?: string | number
  provision_id?: string | number
  amount: number
  currency?: string
  order_type?: string
  extra_info?: string
  quantity?: number
}) => {
  if (!payload.product_id) return null

  const form = new FormData()
  form.append('order_detail[order_type]', payload.order_type || 'UTILITY')
  form.append('order_detail[total_amount]', String(payload.amount))
  if (payload.extra_info) {
    form.append('order_detail[extra_info]', payload.extra_info)
  }

  form.append('order_detail[order_items_attributes][0][product_id]', String(payload.product_id))
  form.append('order_detail[order_items_attributes][0][amount]', String(payload.amount))
  if (payload.provision_id) {
    form.append(
      'order_detail[order_items_attributes][0][provision_id]',
      String(payload.provision_id)
    )
  }
  if (payload.quantity) {
    form.append(
      'order_detail[order_items_attributes][0][quantity]',
      String(payload.quantity)
    )
  }
  if (payload.currency) {
    form.append(
      'order_detail[order_items_attributes][0][currency]',
      String(payload.currency)
    )
  }

  return createOrder(form)
}
