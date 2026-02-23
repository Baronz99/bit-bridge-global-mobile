// src/api/billOrder.ts (MOBILE APP) — SAFE + NORMALIZED (NO AUTO-DECLINE)
import client from '@/api/client'
import moneyFormat from '@/utils/moneyFormat'
import { log } from '@/utils/log'

/**
 * ⚠️ IMPORTANT:
 * - DO NOT call /payment_processors/:id/update_status automatically.
 * - That endpoint DECLINES transactions for some reference types (e.g., fbg-*),
 *   which can block Monnify webhook crediting.
 * - Only call cancelPayment() when the user explicitly taps "Cancel Payment".
 */

const isBillRef = (ref: string) => String(ref || '').startsWith('bbg-')


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
export const normalizeProvider = (provider: string) => {
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

export const normalizeServiceType = (serviceType: string) => {
  const s = String(serviceType || '').trim().toUpperCase()
  if (['CABLE', 'CABLETV', 'CABLE_TV'].includes(s)) return 'TV'
  if (s === 'AIRTIME') return 'VTU'
  return s
}

/**
 * Guard unsupported combinations BEFORE calling backend
 * (Based on real prod logs: NTEL fails for DATA)
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

/** -------------------- Core APIs -------------------- */

export const createPurchaseOrder = async (orderData: any) => {
  try {
    const res = await client.post('/payment_processors/process_payment', orderData)
    return res.data
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 503 || isHtmlResponse(err) || isTimeoutError(err)) {
      throw new Error('Provider timeout. Please retry in a few seconds.')
    }
    throw new Error(errMsg(err))
  }
}

/**
 /**
 * ✅ SAFE: cancel only bill orders (bbg-*)
 * Never cancel funding/deposits (fbg-*) from mobile.
 * Reason: backend update_status declines some reference types and can block webhook crediting.
 */
export const cancelPayment = async (reference: string, reason = 'user_cancelled') => {
  try {
    if (!reference) throw new Error('Missing payment reference')

    // HARD GUARD (required)
    if (!isBillRef(reference)) {
      throw new Error('Cancel is only available for bill payments.')
    }

    const res = await client.get(`/payment_processors/${reference}/update_status`, {
      params: { reason },
    })
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

export const getBillOrder = async (id: string) => {
  try {
    const res = await client.get(`/bill_orders/${id}`)
    return res.data?.data ?? res.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

export const confirmPayment = async ({
  queryId,
  payment_method = 'wallet',
}: {
  queryId: string
  payment_method?: 'wallet'
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

export const initializeBillOrderPayment = async ({
  queryId,
  payment_method = 'wallet',
  redirect_url,
  use_commission = false,
}: {
  queryId: string
  payment_method?: 'wallet'
  redirect_url?: string
  use_commission?: boolean
}) => {
  try {
    const res = await client.get(`/bill_orders/${queryId}/initialize_confirm_payment`, {
      params: {
        payment_method,
        redirect_url,
        use_commission,
      },
    })
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Unable to initialize payment'))
  }
}

export const createBillPaymentIntent = async (bill_order_id: string) => {
  try {
    const res = await client.post('/bill_payment_intents', { bill_order_id })
    return res.data?.data ?? res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Unable to create bill payment intent'))
  }
}

export const getBillPaymentIntent = async (intentId: string) => {
  try {
    const res = await client.get(`/bill_payment_intents/${intentId}`)
    return res.data?.data ?? res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Unable to fetch bill payment intent'))
  }
}

export const executeBillPaymentIntent = async (
  intentId: string,
  { use_commission = false }: { use_commission?: boolean } = {}
) => {
  try {
    const normalizedUseCommission = use_commission === true
    const res = await client.post(
      `/bill_payment_intents/${intentId}/execute`,
      { use_commission: normalizedUseCommission },
      {
        params: {
          use_commission: normalizedUseCommission,
        },
      }
    )
    return { ...(res.data || {}), http_status: res.status }
  } catch (err: any) {
    const status = err?.response?.status
    const respData = err?.response?.data
    if (status === 503 || isTimeoutError(err) || isPendingResponse(respData)) {
      return {
        pending: true,
        status: 'pending',
        message: respData?.message || 'Payment pending. Please try again in a moment.',
      }
    }

    const enrichedError: any = new Error(respData?.message || errMsg(err, 'Unable to execute bill payment intent'))
    enrichedError.code = respData?.error_code
    enrichedError.details = respData?.details
    enrichedError.warning = respData?.warning
    throw enrichedError
  }
}

/**
 * BillOrders confirm endpoint (kept as-is with your "pending" tolerant behavior)
 */
export const confirmBillPayment = async ({
  queryId,
  payment_method,
  use_commission = false,
  idempotencyKey,
}: {
  queryId: string
  payment_method: string
  use_commission?: boolean
  idempotencyKey?: string
}) => {
  try {
    const payload = {
      bill_order: {
        payment_method,
        use_commission,
      },
    }
    if (__DEV__) {
      log('[API] confirmBillPayment payload', {
        payment_method,
        use_commission,
        idempotencyKey,
      })
    }
    const res = await client.patch(`/bill_orders/${queryId}/confirm_bill_payment`, payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    })
    return { ...(res.data || {}), http_status: res.status }
  } catch (err: any) {
    const status = err?.response?.status
    const respData = err?.response?.data
    if (__DEV__) {
      log('[API] confirmBillPayment error', {
        status,
        data: respData,
        message: err?.message,
      })
    }
    const message = respData?.message || respData?.error || err?.message || 'Payment failed'

    if (status === 503 || isTimeoutError(err) || isPendingResponse(respData)) {
      if (isHtmlResponse(err)) {
        return {
          pending: true,
          status: 'pending',
          message: 'Payment pending. Please try again in a moment.',
          ui: respData?.ui,
        }
      }

      return {
        pending: true,
        status: 'pending',
        message: respData?.message || 'Payment pending. Please try again in a moment.',
        ui: respData?.ui,
      }
    }

    throw new Error(message)
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

/** -------------------- Payment processor helpers (mobile post-checkout) -------------------- */

export const getRefOrder = async (reference: string | number) => {
  try {
    const res = await client.get(`/payment_processors/${reference}/get_ref_order`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

export const queryTransaction = async (reference: string | number) => {
  try {
    const res = await client.get(`/payment_processors/${reference}/query_transaction`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err))
  }
}

/** -------------------- Price list -------------------- */

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

export default {
  createPurchaseOrder,
  cancelPayment,
  getPurchaseOrder,
  getBillOrder,
  createBillPaymentIntent,
  getBillPaymentIntent,
  executeBillPaymentIntent,
  confirmPayment,
  initializeBillOrderPayment,
  confirmBillPayment,
  confirmOrderPayment,
  repurchaseOrder,
  getUserOrders,
  getRescentPurchaseOrder,
  getRefOrder,
  queryTransaction,
  getPriceList,
}
