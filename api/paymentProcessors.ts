import client from '@/api/client'

export const queryTransaction = async (id: string | number): Promise<any> => {
  const res = await client.get(`/payment_processors/${id}/query_transaction`)
  return res.data
}

export const getRefOrder = async (id: string | number): Promise<any> => {
  const res = await client.get(`/payment_processors/${id}/get_ref_order`)
  return res.data
}
