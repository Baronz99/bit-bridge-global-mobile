import client from '@/api/client'

export type CircleRecord = Record<string, unknown>

export const listCircles = async (): Promise<any> => {
  const res = await client.get('/circles')
  return res.data
}

export const getCircle = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}`)
  return res.data
}

export const createCircle = async (payload: CircleRecord): Promise<any> => {
  const res = await client.post('/circles', { circle: payload })
  return res.data
}

export const inviteCircleMember = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.post(`/circles/${id}/memberships`, { membership: payload })
  return res.data
}

export const fundCircle = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.post(`/circles/${id}/fund`, payload)
  return res.data
}

export const withdrawCircle = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.post(`/circles/${id}/withdraw`, payload)
  return res.data
}

export const listCircleActivities = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/activities`)
  return res.data
}

export const createCircleActivity = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.post(`/circles/${id}/activities`, { activity: payload })
  return res.data
}

export const getCircleAuditSummary = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/audit_summary`)
  return res.data
}

export const exportCircleCsv = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/export_csv`)
  return res.data
}

export const reactToCircleTx = async (
  id: string | number,
  emoji: string
): Promise<any> => {
  const res = await client.post(`/circle_transactions/${id}/react`, { emoji })
  return res.data
}

export const unreactToCircleTx = async (
  id: string | number,
  emoji: string
): Promise<any> => {
  const res = await client.delete(`/circle_transactions/${id}/unreact`, {
    params: { emoji },
  })
  return res.data
}
