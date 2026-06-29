import client from '@/api/client'
import { normalizeCircleWorkspace } from '@/utils/circleWorkspace'

export type CircleRecord = Record<string, unknown>
export type CircleMemberRole = 'member' | 'treasurer' | 'admin'
export type CircleTreasuryInflowAssignmentPayload = {
  circle_member_id?: string | number
  circle_person_id?: string | number
  user_id?: string | number
  purpose_reference_type?: string
  purpose_reference_id?: string | number
  assignment_note?: string
}

export type CircleTreasuryInflowAssignmentCorrectionPayload = CircleTreasuryInflowAssignmentPayload & {
  correction_reason?: string
}

export type CircleTreasurySettlementKind = 'dues' | 'outstanding_dues'

export type CircleTreasuryInflowDuesPreviewPayload = {
  settlement_kind?: CircleTreasurySettlementKind
  circle_person_id?: string | number
  periods_count?: number | string
  through_on?: string
  through_date?: string
  paid_through_on?: string
}

export type CircleTreasuryInflowListParams = {
  page?: number | string
  per_page?: number | string
  status?: string | string[]
  settlement_status?: string | string[]
  reconciliation_state?: 'all' | 'assigned' | 'unassigned'
}

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
  const [circleResult, contextResult, settingsResult, treasuryResult] = await Promise.allSettled([
    getCircle(id),
    getCircleContext(id, params),
    getCircleSettings(id),
    getCircleTreasury(id),
  ])

  const circleResponse = circleResult.status === 'fulfilled' ? circleResult.value : null
  const contextResponse = contextResult.status === 'fulfilled' ? contextResult.value : null
  const settingsResponse = settingsResult.status === 'fulfilled' ? settingsResult.value : null
  const treasuryResponse = treasuryResult.status === 'fulfilled' ? treasuryResult.value : null

  if (!circleResponse && !contextResponse) {
    const primaryFailure = circleResult.status === 'rejected' ? circleResult.reason : contextResult.status === 'rejected' ? contextResult.reason : null
    throw primaryFailure || new Error('Unable to load circle workspace')
  }

  return normalizeCircleWorkspace({
    circlePayload: circleResponse,
    contextPayload: contextResponse,
    treasuryPayload: treasuryResponse,
    settingsPayload: settingsResponse,
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

export const uploadCircleLogo = async (
  id: string | number,
  file: { uri: string; name: string; type: string }
): Promise<any> => {
  const form = new FormData()
  form.append('file', file as any)
  const res = await client.post(`/circles/${id}/settings/logo`, form, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
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

export const listCirclePeople = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/people`)
  return res.data
}

export const getCirclePerson = async (
  circleId: string | number,
  personId: string | number
): Promise<any> => {
  const res = await client.get(`/circles/${circleId}/people/${personId}`)
  return res.data
}

export const createCirclePerson = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.post(`/circles/${id}/people`, { person: payload })
  return res.data
}

export const updateCirclePerson = async (
  circleId: string | number,
  personId: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.patch(`/circles/${circleId}/people/${personId}`, { person: payload })
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

export const listCircleTreasuryInflows = async (
  id: string | number,
  params?: CircleTreasuryInflowListParams
): Promise<any> => {
  const res = await client.get(`/circles/${id}/treasury/inflows`, { params })
  return res.data
}

export const getCircleTreasuryInflow = async (
  circleId: string | number,
  inflowId: string | number
): Promise<any> => {
  const res = await client.get(`/circles/${circleId}/treasury/inflows/${inflowId}`)
  return res.data
}

export const assignCircleTreasuryInflow = async (
  circleId: string | number,
  inflowId: string | number,
  payload: CircleTreasuryInflowAssignmentPayload
): Promise<any> => {
  const res = await client.post(`/circles/${circleId}/treasury/inflows/${inflowId}/assignments`, payload)
  return res.data
}

export const correctCircleTreasuryInflowAssignment = async (
  circleId: string | number,
  inflowId: string | number,
  assignmentId: string | number,
  payload: CircleTreasuryInflowAssignmentCorrectionPayload
): Promise<any> => {
  const res = await client.post(`/circles/${circleId}/treasury/inflows/${inflowId}/assignments/${assignmentId}/correct`, payload)
  return res.data
}

export const previewCircleTreasuryInflowDues = async (
  circleId: string | number,
  inflowId: string | number,
  payload: CircleTreasuryInflowDuesPreviewPayload
): Promise<any> => {
  const res = await client.post(`/circles/${circleId}/treasury/inflows/${inflowId}/allocations/preview`, payload)
  return res.data
}

export const settleCircleTreasuryInflowDues = async (
  circleId: string | number,
  inflowId: string | number,
  payload: CircleTreasuryInflowDuesPreviewPayload & { note?: string; allocation_note?: string }
): Promise<any> => {
  const res = await client.post(`/circles/${circleId}/treasury/inflows/${inflowId}/allocations/settle`, payload)
  return res.data
}

export const listCircleTreasuryPayoutRequests = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/treasury/payouts`)
  return res.data
}

export const getCircleTreasuryPayoutRequest = async (
  id: string | number,
  payoutRequestId: string | number
): Promise<any> => {
  const res = await client.get(`/circles/${id}/treasury/payouts/${payoutRequestId}`)
  return res.data
}

export const createCircleTreasuryPayoutRequest = async (
  id: string | number,
  payload: CircleRecord
): Promise<any> => {
  const res = await client.post(`/circles/${id}/treasury/payouts`, payload)
  return res.data
}

export const approveCircleTreasuryPayoutRequest = async (
  id: string | number,
  payoutRequestId: string | number,
  payload?: CircleRecord
): Promise<any> => {
  const res = await client.post(`/circles/${id}/treasury/payouts/${payoutRequestId}/approve`, payload || {})
  return res.data
}

export const rejectCircleTreasuryPayoutRequest = async (
  id: string | number,
  payoutRequestId: string | number
): Promise<any> => {
  const res = await client.post(`/circles/${id}/treasury/payouts/${payoutRequestId}/reject`)
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

export const listCircleCollections = async (id: string | number): Promise<any> => {
  const res = await client.get(`/circles/${id}/collections`)
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

export const exportCircleCsv = async (id: string | number): Promise<any> =>
  client.get(`/circles/${id}/export_csv`, { responseType: 'text' })

export const exportCircleDuesCsv = async (id: string | number): Promise<any> =>
  client.get(`/circles/${id}/dues_export_csv`, { responseType: 'text' })

export const exportCircleDuesStatementPdf = async (id: string | number): Promise<any> =>
  client.get(`/circles/${id}/dues_statement_pdf`, { responseType: 'arraybuffer' })

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
