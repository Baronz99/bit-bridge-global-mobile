import client from '@/api/client'
import { getBusinessWallet } from '@/api/business'
import { getCircleWorkspace } from '@/api/circles'
import type { ActiveAccount } from '@/services/useActiveAccount'

export const userWallet = async () => {
  try {
    const response = await client.get('/wallets')
    const result = response.data

    return result
  } catch (error: any) {
    if (error?.response) {
      return error.response.data || 'error occured'
    }

    return 'something went wrong'
  }
}

export const getUserWallet = async () => {
  try {
    const response = await client.get('/wallets/user')
    return response.data
  } catch (error) {
    throw error
  }
}

export const getWallet = async (activeAccount: ActiveAccount) => {
  if (activeAccount?.type === 'business') {
    const response = await getBusinessWallet(activeAccount.businessId)
    const payload = response?.data?.data || response?.data || {}
    const wallet = payload?.wallet || payload

    return {
      data: {
        bridge: wallet || null,
        tunnel: null,
      },
      account_context: activeAccount,
    }
  }

  if (activeAccount?.type === 'circle') {
    const circle = await getCircleWorkspace(activeAccount.circleId)

    return {
      data: {
        bridge: null,
        tunnel: null,
        circle: circle || null,
      },
      account_context: activeAccount,
    }
  }

  return getUserWallet()
}

export const activateTunnel = async () => {
  try {
    const response = await client.post('/wallets/tunnel/activate')
    return response.data
  } catch (error) {
    throw error
  }
}

export const quoteTunnelNgnToUsd = async (amountNgn: number) => {
  try {
    const response = await client.post('/wallets/tunnel/quote', {
      amount_ngn: amountNgn,
    })
    return response.data
  } catch (error) {
    throw error
  }
}

export const convertTunnelNgnToUsd = async (
  amountNgn: number,
  transactionPinOrApprovalToken: string,
  quoteToken?: string
) => {
  try {
    const credential = String(transactionPinOrApprovalToken || '').trim()
    const response = await client.post('/wallets/tunnel/convert', {
      amount_ngn: amountNgn,
      ...(credential.length === 4
        ? { transaction_pin: credential }
        : { biometric_approval_token: credential }),
      quote_token: quoteToken,
    })
    return response.data
  } catch (error) {
    throw error
  }
}

export const quoteTunnelUsdToNgn = async (amountUsd: number) => {
  try {
    const response = await client.post('/wallets/tunnel/quote-back', {
      amount_usd: amountUsd,
    })
    return response.data
  } catch (error) {
    throw error
  }
}

export const convertTunnelUsdToNgn = async (
  amountUsd: number,
  transactionPinOrApprovalToken: string,
  quoteToken?: string
) => {
  try {
    const credential = String(transactionPinOrApprovalToken || '').trim()
    const response = await client.post('/wallets/tunnel/convert-back', {
      amount_usd: amountUsd,
      ...(credential.length === 4
        ? { transaction_pin: credential }
        : { biometric_approval_token: credential }),
      quote_token: quoteToken,
    })
    return response.data
  } catch (error) {
    throw error
  }
}

export const sendMoneyToUser = async (payload: {
  phone_number: string
  amount: number
  transaction_pin?: string
  biometric_approval_token?: string
  description?: string
}) => {
  try {
    const response = await client.post('/wallets/send_money', payload)
    return response.data
  } catch (error) {
    throw error
  }
}
