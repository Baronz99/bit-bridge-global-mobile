// src/api/account.ts (MOBILE APP)
import client from '@/api/client'

const errMsg = (err: any, fallback = 'Something went wrong') =>
  err?.response?.data?.message || err?.message || fallback

export interface CreateAccountPayload {
  account: {
    bvn: string
    currency: string
    vendor: string
  }
}

/**
 * ✅ Uses central client:
 * - baseURL is .../api/v1
 * - Authorization attached automatically
 * - 401 refresh/retry handled globally
 */
export const createBankAccount = async (payload: CreateAccountPayload) => {
  try {
    const res = await client.post('/accounts', payload)
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    console.log('[createBankAccount error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw new Error(msg)
  }
}
