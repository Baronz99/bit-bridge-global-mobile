import client from '@/api/client'

export const getConversion = async (payload: {
  from_curr: string
  to_curr: string
  amount: number
}) => {
  const res = await client.get('/currencies/get_currency', {
    params: payload,
  })
  return res.data
}
