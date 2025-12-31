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
