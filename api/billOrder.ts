// src/api/billOrder.ts (MOBILE APP) — SAFE + NORMALIZED
import client from '@/api/client'
import moneyFormat from '@/utils/moneyFormat'

const errMsg = (err: any, fallback = 'Something went wrong') =>
  err?.response?.data?.message || err?.message || fallback

const isHtmlResponse = (err: any) => {
  const data = err?.response?.data
  if (typeof data === 'string') return data.trim().startsWith('<')
  const contentType = err?.response?.headers?.['content-type'] as string | undefined
  return contentType ? contentType.includes('text/html') : false
}

const isPendingResponse = (data: any) =>
  data?.status === 'pending' || data?.data?.status === 'pending'

const isTimeoutError = (err: any) => {
  const msg = String(err?.message || '').toLowerCase()
  return err?.code === 'ECONNABORTED' || msg.includes('timeout')
}

/** --- Normalization helpers (match backend logic) --- */
const normalizeProvider = (provider: string) => {
  const p = String(provider || '').trim().toLowerCase()

  // mobile
  if (['9-mobile', '9mobile', '9_mobil', '9mobil', 'etisalat', 'emts'].includes(p)) return '9mobile'
  if (p === 'mtn') return 'mtn'
  if (p === 'glo') return 'glo'
  if (p === 'airtel') return 'airtel'
  if (p === 'ntel') return 'ntel'

  // tv
  if (p === 'dstv') return 'dstv'
  if (p === 'gotv') return 'gotv'
  if (['startimes', 'star-times', 'star_times'].includes(p)) return 'startimes'

  return p
}

const normalizeServiceType = (serviceType: string) => {
  const s = String(serviceType || '').trim().toUpperCase()
  if (['CABLE', 'CABLETV', 'CABLE_TV'].includes(s)) return 'TV'
  if (s === 'AIRTIME') return 'VTU'
  return s
}

/**
 * Guard unsupported combinations BEFORE calling backend
 * (Based on your real prod logs: NTEL fails for DATA)
 */
const SERVICE_SUPPORTED_PROVIDERS: Record<string, Set<string>> = {
  DATA: new Set(['mtn', 'glo', 'airtel', '9mobile']),
  VTU: new Set(['mtn', 'glo', 'airtel', '9mobile', 'ntel']),
  TV: new Set(['dstv', 'gotv', 'startimes']),
}

const isProviderSupported = (serviceType: string, provider: string) => {
  const s = normalizeServiceType(serviceType)
  const p = normalizeProvider(provider)
  const set = SERVICE_SUPPORTED_PROVIDERS[s]
  if (!set) return true
  return set.has(p)
}

/** --- Shared UI placeholder --- */
const placeholderOption = { label: 'Select Data Plan', value: null as any, amount: 0 }

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
          message: respData?.message || 'Payment pending. Please try again in a moment.',
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
    if (!provider || !service_type) {
      return [placeholderOption]
    }

    const normalizedProvider = normalizeProvider(provider)
    const normalizedService = normalizeServiceType(service_type)

    // ✅ Prevent invalid combos like NTEL + DATA from breaking the screen
    if (!isProviderSupported(normalizedService, normalizedProvider)) {
      return [placeholderOption]
    }

    const res = await client.get('/payment_processors/get_price_list', {
      params: { provider: normalizedProvider, service_type: normalizedService },
    })

    const result = res.data

    // Build options and dedupe by "value" (code)
    const mapped =
      result?.data?.map((item: any) => {
        const code = item?.code
        const price = Number(item?.price ?? 0)
        const desc = String(item?.desc ?? '').trim()
        const validity = item?.validity ? String(item.validity) : ''
        return {
          value: code,
          label: `${moneyFormat(price)} | ${desc}${validity ? ` | ${validity}` : ''}`,
          amount: price,
        }
      }) ?? []

    const seen = new Set<string>()
    const unique = mapped.filter((x: any) => {
      const key = String(x?.value ?? '')
      if (!key) return false
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return [placeholderOption, ...unique]
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 503 || isHtmlResponse(err) || isTimeoutError(err)) {
      return [placeholderOption]
    }
    throw new Error(errMsg(err))
  }
}
