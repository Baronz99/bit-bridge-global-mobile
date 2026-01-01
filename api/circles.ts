import client from '@/api/client'

export type CircleRecord = Record<string, unknown>

export const listCircles = async (): Promise<unknown> => {
  const res = await client.get('/circles')
  return res.data
}

export const getCircle = async (id: string | number): Promise<unknown> => {
  const res = await client.get(`/circles/${id}`)
  return res.data
}

export const createCircle = async (payload: CircleRecord): Promise<unknown> => {
  const res = await client.post('/circles', payload)
  return res.data
}

export const inviteCircleMember = async (
  id: string | number,
  payload: CircleRecord
): Promise<unknown> => {
  // TODO: confirm invite endpoint path (maybe /circles/:id/invite or /circles/:id/invitations).
  const res = await client.post(`/circles/${id}/invite`, payload)
  return res.data
}
