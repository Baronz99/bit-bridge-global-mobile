import client from '@/api/client'

export const getStatistics = async () => {
  const res = await client.get('/statistics')
  return res.data
}
