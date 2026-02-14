import client from '@/api/client'

type FundingProvider = 'anchor'

type PooledAccount = {
  bank_name?: string
  account_name?: string
  account_number?: string
  instructions?: string
}

export type FundingIntentResponse = {
  id: string
  provider: FundingProvider
  reference: string
  expected_amount_cents?: number | null
  expires_at: string
  status: 'pending' | 'detected' | 'credited' | 'expired' | 'cancelled'
  credited_transaction_id?: string | null
  account?: PooledAccount
}

export const getAnchorPooledAccount = async () => {
  const response = await client.get('/funding/anchor_pooled_account')
  return response?.data?.data as PooledAccount
}

export const createFundingIntent = async ({
  provider,
  amount_cents,
}: {
  provider: FundingProvider
  amount_cents?: number
}) => {
  const payload: Record<string, any> = { provider }
  if (typeof amount_cents === 'number') payload.amount_cents = amount_cents

  try {
    const response = await client.post('/funding/intents', payload)
    return response?.data?.data as FundingIntentResponse
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'Unable to create funding intent')
    }
    throw new Error(error?.message || 'Unable to create funding intent')
  }
}

export const getFundingIntent = async (id: string) => {
  try {
    const response = await client.get(`/funding/intents/${id}`)
    return response?.data?.data as FundingIntentResponse
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'Unable to fetch funding intent')
    }
    throw new Error(error?.message || 'Unable to fetch funding intent')
  }
}
