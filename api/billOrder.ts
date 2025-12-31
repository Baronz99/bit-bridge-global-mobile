// src/api/billOrder.ts (MOBILE APP)
import client from '@/api/client'
import moneyFormat from '@/utils/moneyFormat'

const errMsg = (err: any, fallback = 'Something went wrong') =>
  err?.response?.data?.message || err?.message || fallback

const isHtmlResponse = (err: any) => {
  const data = err?.response?.data
  if (typeof data === 'string') {
    return data.trim().startsWith('<')
  }
  const contentType = err?.response?.headers?.['content-type'] as string | undefined
  return contentType ? contentType.includes('text/html') : false
}

const isPendingResponse = (data: any) =>
  data?.status === 'pending' || data?.data?.status === 'pending'

const isTimeoutError = (err: any) => {
  const msg = String(err?.message || '').toLowerCase()
  return err?.code === 'ECONNABORTED' || msg.includes('timeout')
}

export const createPurchaseOrder = async (orderData: any) => {
  try {
    const res = await client.post('/payment_processors/process_payment', orderData)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

export const updateOrderStatus = async (id: string) => {
  try {
    const res = await client.get(`/payment_processors/${id}/update_status`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

export const getPurchaseOrder = async (id: string) => {
  try {
    const res = await client.get(`/payment_processors/${id}`)
    return res.data?.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

export const confirmPayment = async ({
  queryId,
  payment_method,
}: {
  queryId: string
  payment_method: string
}) => {
  try {
    const res = await client.get(`/payment_processors/${queryId}/confirm_payment`, {
      params: { payment_method },
    })
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

export const confirmBillPayment = async ({
  queryId,
  payment_method,
}: {
  queryId: string
  payment_method: string
}) => {
  try {
    const res = await client.get(`/bill_orders/${queryId}/initialize_confirm_payment`, {
      params: { payment_method },
    })
    return res.data
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 503 || isTimeoutError(err)) {
      if (isHtmlResponse(err)) {
        return {
          pending: true,
          status: 'pending',
          message: 'Payment pending. Please try again in a moment.',
        }
      }

      const respData = err?.response?.data
      if (isPendingResponse(respData) || status === 503 || isTimeoutError(err)) {
        return {
          pending: true,
          status: 'pending',
          message:
            respData?.message || 'Payment pending. Please try again in a moment.',
        }
      }
    }
    throw new Error(errMsg(err))
  }
}

export const confirmOrderPayment = async ({
  queryId,
  data,
}: {
  queryId: string
  data: any
}) => {
  try {
    const res = await client.patch(`/bill_orders/${queryId}/confirm_bill_payment`, {
      bill_order: data,
    })
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

export const repurchaseOrder = async (id: string) => {
  try {
    const res = await client.get(`/payment_processors/${id}/repurchase`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

export const getUserOrders = async (params?: { status?: string }) => {
  try {
    const res = await client.get('/bill_orders/user', { params })
    return res.data?.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fetch orders'))
  }
}

export const getRescentPurchaseOrder = async () => {
  try {
    const res = await client.get('/bill_orders/user_recent')
    return res.data?.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fetch recent orders'))
  }
}

export const getPriceList = async ({
  provider,
  service_type,
}: {
  provider: string
  service_type: string
}) => {
  try {
    const res = await client.get('/payment_processors/get_price_list', {
      params: { provider, service_type },
    })

    const result = res.data
    const priceListOptions =
      result?.data?.map((item: any) => ({
        value: item.code,
        label: `${moneyFormat(item?.price)} | ${item?.desc} | ${item?.validity ?? ''}`,
        amount: item?.price,
      })) ?? []

    return [{ label: 'Select Data Plan', value: null, amount: 0 }, ...priceListOptions]
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}
