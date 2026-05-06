// src/api/account.ts (MOBILE APP)
import client from '@/api/client'
import { normalizeBank, normalizeBeneficiary } from '@/utils/normalize'
import { log, warn } from '@/utils/log'

const errMsg = (err: any, fallback = 'Something went wrong') =>
  err?.response?.data?.message || err?.message || fallback

const DEFAULT_TRANSFER_DESCRIPTION = 'Fund Transfer'

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
    warn('[createBankAccount error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw new Error(msg)
  }
}

export const getUserAnchorAccountDetail = async () => {
  try {
    const res = await client.get('/accounts/get_user_account_detail')
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    warn('[getUserAnchorAccountDetail error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

export const getAnchorOnboardingState = async () => {
  try {
    const res = await client.get('/accounts/anchor_onboarding_state')
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    warn('[getAnchorOnboardingState error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

const parseAccountError = (err: any) => {
  const status = err?.response?.status
  const data = err?.response?.data || {}
  return {
    status,
    success: data?.success,
    error: data?.error,
    error_code: data?.error_code,
    message: data?.message || err?.message,
    missing_fields: Array.isArray(data?.missing_fields) ? data.missing_fields : [],
    details: data?.details || null,
    flow: data?.flow || data?.meta?.flow || null,
    requirements: data?.requirements || null,
    capabilities: data?.capabilities || null,
    request_id: data?.request_id || data?.meta?.request_id || null,
    response: err?.response,
  }
}

const parseAnchorApiError = (err: any) => {
  const data = err?.response?.data || {}
  return {
    status: err?.response?.status,
    success: data?.success,
    message: data?.message || err?.message || 'Something went wrong',
    error: data?.error,
    error_code: data?.error_code || data?.error,
    errors: Array.isArray(data?.errors) ? data.errors : [],
    details: data?.details || null,
    retryable: data?.retryable === true || data?.meta?.retryable === true,
    capabilities: data?.capabilities || null,
    requirements: data?.requirements || null,
    request_id: data?.request_id || data?.meta?.request_id || null,
    meta: data?.meta || null,
    flow: data?.flow || data?.meta?.flow || null,
    response: err?.response,
  }
}

export const createAnchorAccount = async (payload?: { account?: Record<string, unknown> }) => {
  try {
    const accountPayload = {
      vendor: 'anchor',
      ...(payload?.account || {}),
    }
    const res = await client.post('/accounts', { account: accountPayload })
    return res.data
  } catch (err: any) {
    const parsed = parseAccountError(err)
    warn('[createAnchorAccount error]', {
      message: parsed.message,
      status: parsed.status,
      error_code: parsed.error_code,
      missing_fields: parsed.missing_fields,
      url: err?.config?.url,
    })
    throw parsed
  }
}

export const getBanks = async (): Promise<any> => {
  try {
    const res = await client.get('/accounts/get_banks')
    const payload = res.data
    const raw =
      payload?.data?.banks ||
      payload?.data?.data ||
      payload?.data ||
      payload?.banks ||
      payload
    const list = Array.isArray(raw) ? raw : []
    log('[getBanks] payload keys', Object.keys(payload || {}))
    log('[getBanks] raw sample', list.slice(0, 2))
    const normalized = list.map((item) => normalizeBank(item || {}))
    log('[getBanks] normalized sample', normalized[0])
    return normalized
  } catch (err: any) {
    const msg = errMsg(err)
    warn('[getBanks error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

export const getBeneficiaries = async (): Promise<any> => {
  try {
    const res = await client.get('/accounts/beneficiaries')
    const payload = res.data
    const raw =
      payload?.data?.beneficiaries ||
      payload?.data?.data ||
      payload?.data ||
      payload?.beneficiaries ||
      payload
    const list = Array.isArray(raw) ? raw : []
    return list.map((item) => normalizeBeneficiary(item || {}))
  } catch (err: any) {
    const msg = errMsg(err)
    warn('[getBeneficiaries error]', {
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
    warn('[createCounterParty error]', {
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
    warn('[getUserAccountDetail error]', {
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
    bank: string
    account_name: string
    amount: number
    inter_bank: boolean
    counter_party_id?: string
    pin?: string
    biometric_approval_token?: string
    transfer_reference: string
    description: string
    save_beneficiary?: boolean
  }
}) => {
  const account = payload?.account || ({} as any)
  const accountNumber = String(account.account_number || '').trim()
  const bankCode = String(account.bank_code || '').trim()
  const bank = String(account.bank || '').trim()
  const accountName = String(account.account_name || '').trim()
  const description = String(account.description || '').trim() || DEFAULT_TRANSFER_DESCRIPTION
  const pin = String(account.pin || '').trim()
  const biometricApprovalToken = String(account.biometric_approval_token || '').trim()
  const transferReference = String(account.transfer_reference || '').trim()
  const counterPartyId = String(account.counter_party_id || '').trim()
  const amount = Number(account.amount)

  if (!/^\d{10}$/.test(accountNumber)) {
    throw new Error('Account number must be exactly 10 digits.')
  }
  if (!bankCode) throw new Error('Bank code is required.')
  if (!bank) throw new Error('Bank is required.')
  if (!accountName) throw new Error('Account name is required.')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than 0 (in Naira).')
  }
  if (typeof account.inter_bank !== 'boolean') {
    throw new Error('inter_bank must be true or false.')
  }
  if (!/^\d{4}$/.test(pin) && !biometricApprovalToken) {
    throw new Error('PIN or biometric approval is required.')
  }
  if (!transferReference) {
    throw new Error('transfer_reference is required.')
  }
  if (account.inter_bank === true && !counterPartyId) {
    throw new Error('counter_party_id is required when inter_bank is true.')
  }

  const accountPayload = {
    ...account,
    description,
    ...(pin ? { pin } : {}),
    ...(biometricApprovalToken ? { biometric_approval_token: biometricApprovalToken } : {}),
  }

  try {
    const res = await client.post('/accounts/initiate_fund_transfer', { account: accountPayload }, {
      headers: {
        Accept: 'application/json',
      },
    })
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    warn('[initiateFundTransfer error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    const data = err?.response?.data || {}
    const enhanced = new Error(msg) as Error & {
      status?: number
      error_code?: string
      attempts_remaining?: number
      retry_after_seconds?: number
      response?: any
    }
    enhanced.status = err?.response?.status
    enhanced.error_code = data?.error_code
    enhanced.attempts_remaining = data?.attempts_remaining
    enhanced.retry_after_seconds = data?.retry_after_seconds
    enhanced.response = err?.response
    throw enhanced
  }
}

export const getTransferQuote = async (amount: number) => {
  try {
    const res = await client.get('/accounts/transfer_quote', {
      params: { amount },
      headers: {
        Accept: 'application/json',
      },
    })
    return res.data
  } catch (err: any) {
    const msg = errMsg(err, 'Unable to compute transfer quote')
    warn('[getTransferQuote error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

export const resolveAccountName = async (payload: {
  account: {
    bank_code: string
    account_number: string
  }
}) => {
  try {
    const res = await client.post('/accounts/resolve', payload)
    return res.data
  } catch (err: any) {
    const msg = errMsg(err)
    warn('[resolveAccountName error]', {
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
    warn('[verifyTransfer error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw err
  }
}

export const getAccounts = async () => {
  try {
    const res = await client.get('/accounts/user_accounts')
    return res.data
  } catch (err: any) {
    const msg = errMsg(err, 'Failed to fetch accounts')
    warn('[getAccounts error]', {
      message: msg,
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw new Error(msg)
  }
}

export const createDepositAccount = async () => {
  try {
    const res = await client.post('/accounts/provision_account_number')
    return res.data
  } catch (err: any) {
    const status = err?.response?.status
    // Backward compatibility for older backend deployments.
    if (status === 404 || status === 405) {
      try {
        const legacy = await client.get('/accounts/get_account_number')
        return legacy.data
      } catch (legacyErr: any) {
        const parsedLegacy = parseAnchorApiError(legacyErr)
        warn('[createDepositAccount legacy error]', {
          message: parsedLegacy.message,
          status: parsedLegacy.status,
          data: legacyErr?.response?.data,
          url: legacyErr?.config?.url,
        })
        throw parsedLegacy
      }
    }
    const parsed = parseAnchorApiError(err)
    warn('[createDepositAccount error]', {
      message: parsed.message,
      status: parsed.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw parsed
  }
}

export const setupAnchorOnboarding = async (payload?: { account?: Record<string, unknown> }) => {
  try {
    const accountPayload = payload?.account || {}
    const res = await client.post('/accounts/setup_anchor_onboarding', {
      account: accountPayload,
    })
    return res.data
  } catch (err: any) {
    const parsed = parseAnchorApiError(err)
    warn('[setupAnchorOnboarding error]', {
      message: parsed.message,
      status: parsed.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw parsed
  }
}

export const verifyKyc = async (payload: {
  bvn: string
  dob: string
  gender?: string
}) => {
  try {
    const res = await client.post('/accounts/verify_kyc', {
      account: payload,
    })
    return res.data
  } catch (err: any) {
    const parsed = parseAnchorApiError(err)
    warn('[verifyKyc error]', {
      message: parsed.message,
      status: parsed.status,
      data: err?.response?.data,
      url: err?.config?.url,
    })
    throw parsed
  }
}
