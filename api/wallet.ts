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

export const convertTunnelNgnToUsd = async (amountNgn: number, pin: string) => {
  try {
    const response = await client.post('/wallets/tunnel/convert', {
      amount_ngn: amountNgn,
      pin,
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

export const convertTunnelUsdToNgn = async (amountUsd: number, pin: string) => {
  try {
    const response = await client.post('/wallets/tunnel/convert-back', {
      amount_usd: amountUsd,
      pin,
    })
    return response.data
  } catch (error) {
    throw error
  }
}
