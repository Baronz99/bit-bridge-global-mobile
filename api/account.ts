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

export const getBanks = async () => {
  try {
    const res = await client.get('/accounts/get_banks')
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    console.log('[getBanks error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

export const getBeneficiaries = async () => {
  try {
    const res = await client.get('/accounts/beneficiaries')
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    console.log('[getBeneficiaries error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

export const createCounterParty = async (payload: {
  account: {
    bank_code: string
    account_number: string
    account_name?: string
  }
}) => {
  try {
    const res = await client.post('/accounts/create_counter_party', payload)
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    console.log('[createCounterParty error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

export const getUserAccountDetail = async () => {
  try {
    const res = await client.get('/accounts/get_user_account_detail')
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    console.log('[getUserAccountDetail error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

export const initiateFundTransfer = async (payload: {
  account: {
    account_number: string
    bank_code: string
    amount: number
    inter_bank: boolean
    counter_party_id?: string
    pin: string
  }
}) => {
  try {
    const res = await client.post('/accounts/initiate_fund_transfer', payload)
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    console.log('[initiateFundTransfer error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

export const verifyTransfer = async (transferId: string) => {
  try {
    const res = await client.get('/accounts/verify_transfer', {
      params: { transfer_id: transferId },
    })
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    console.log('[verifyTransfer error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}
