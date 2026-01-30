import client from '@/api/client'

export type CardTokenRecord = Record<string, unknown>

export const createCardToken = async (payload: CardTokenRecord): Promise<any> => {
  const res = await client.post('/card_tokens', payload)
  return res.data
}

export const getCardTokens = async (): Promise<any> => {
  const res = await client.get('/card_tokens')
  return res.data
}

export const getUserCardTokens = async (): Promise<any> => {
  const res = await client.get('/card_tokens/user')
  return res.data
}

export const updateCardToken = async (
  id: string | number,
  payload: CardTokenRecord
): Promise<any> => {
  const res = await client.patch(`/card_tokens/${id}`, payload)
  return res.data
}
