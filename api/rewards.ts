import client from '@/api/client'

export const getRewards = async () => {
  const res = await client.get('/rewards')
  return res.data
}
