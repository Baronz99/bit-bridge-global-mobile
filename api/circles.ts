import client from '@/api/client'
import { normalizeCircleWorkspace } from '@/utils/circleWorkspace'

export type CircleRecord = Record<string, unknown>
export type CircleMemberRole = 'member' | 'treasurer' | 'admin'

export const listCircles = async (): Promise<any> => {
  const res = await client.get('/circles')
  return res.data
}

export const getCircle = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}`)
  return res.data
}

export const getCircleContext = async (
  id: string | number,
  params?: CircleRecord
): Promise<any> => {
  const res = await client.get(`/circles/${id}/context`, { params })
  return res.data
}

export const getCircleWorkspace = async (
  id: string | number,
  params?: CircleRecord
): Promise<any> => {
  const [circleResponse, contextResponse] = await Promise.all([
    getCircle(id).catch(() => null),
    getCircleContext(id, params).catch(() => null),
  ])
  const treasuryResponse = await getCircleTreasury(id).catch(() => null)

  return normalizeCircleWorkspace({
    circlePayload: circleResponse,
    contextPayload: contextResponse,
    treasuryPayload: treasuryResponse,
  })
}

export const getCircleSettings = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/settings`)
  return res.data
}

export const updateCircleSettings = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.patch(`/circles/${id}/settings`, payload)
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

export const getCircleDuePlan = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/due_plan`)
  return res.data
}

export const upsertCircleDuePlan = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.post(`/circles/${id}/due_plan`, { due_plan: payload })
  return res.data
}

export const updateCircleDuePlan = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.patch(`/circles/${id}/due_plan`, { due_plan: payload })
  return res.data
}

export const listCircleDueObligations = async (
  id: string | number,
  params?: CircleRecord
): Promise<any> => {
  const res = await client.get(`/circles/${id}/due_plan/obligations`, { params })
  return res.data
}

export const getCircleDuePlanSummary = async (
  id: string | number
): Promise<any> => {
  const res = await client.get(`/circles/${id}/due_plan/summary`)
  return res.data
}

export const quoteCircleDuePlan = async (
  id: string | number,
  params?: CircleRecord
): Promise<any> => {
  const res = await client.get(`/circles/${id}/due_plan/quote`, { params })
  return res.data
}

export const getCirclePaymentItems = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/payment_items`)
  return res.data
}

export const getCircleTreasury = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/treasury`)
  return res.data
}

export const requestCircleTreasury = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.post(`/circles/${id}/treasury/request`, payload)
  return res.data
}


export const updateMyCircleMembership = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.patch(`/circles/${id}/memberships/me`, { membership: payload })
  return res.data
}

export const updateCircleMembership = async (
  id: string | number,
  membershipId: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.patch(`/circles/${id}/memberships/${membershipId}`, { membership: payload })
  return res.data
}

export const removeCircleMembership = async (
  id: string | number,
  membershipId: string | number
): Promise<any> => {
  const res = await client.delete(`/circles/${id}/memberships/${membershipId}`)
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

export const listCircleApprovalRequests = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/approval_requests`)
  return res.data
}

export const getCircleGovernance = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/governance`)
  return res.data
}

export const updateCircleGovernance = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.patch(`/circles/${id}/governance`, { governance: payload })
  return res.data
}

export const getCircleApprovalRequest = async (
  id: string | number,
  approvalRequestId: string | number
): Promise<any> => {
  const res = await client.get(`/circles/${id}/approval_requests/${approvalRequestId}`)
  return res.data
}

export const approveCircleApprovalRequest = async (
  id: string | number,
  approvalRequestId: string | number
): Promise<any> => {
  const res = await client.post(`/circles/${id}/approval_requests/${approvalRequestId}/approve`)
  return res.data
}

export const rejectCircleApprovalRequest = async (
  id: string | number,
  approvalRequestId: string | number
): Promise<any> => {
  const res = await client.post(`/circles/${id}/approval_requests/${approvalRequestId}/reject`)
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

export const updateCircleActivity = async (
  id: string | number,
  activityId: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.patch(`/circles/${id}/activities/${activityId}`, { activity: payload })
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
