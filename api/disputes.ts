import client from '@/api/client'

export const raiseDispute = async (payload: {
  circle_transaction_id: string | number
  reason: string
  note?: string
}) => {
  const res = await client.post('/disputes', payload)
  return res.data
}
