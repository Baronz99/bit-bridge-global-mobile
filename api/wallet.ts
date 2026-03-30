import client from '@/api/client'

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
