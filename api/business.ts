import client from './client'

export const getBusinessEntities = () => client.get('/business_entities')
export const getBusinessEntity = (id: string | number) => client.get(`/business_entities/${id}`)
export const createBusinessEntity = (payload: Record<string, any>) => client.post('/business_entities', payload)

export const getBusinessOnboarding = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/onboarding`)
export const updateBusinessOnboarding = (businessId: string | number, payload: Record<string, any>) =>
  client.patch(`/business_entities/${businessId}/onboarding`, payload)

export const getBusinessKyb = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/kyb`)
export const getBusinessKybStatus = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/kyb/status`)
export const getBusinessKybDocuments = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/kyb/documents`)
export const submitBusinessKyb = (businessId: string | number) =>
  client.post(`/business_entities/${businessId}/kyb/submit`)
export const resyncBusinessKyb = (businessId: string | number) =>
  client.post(`/business_entities/${businessId}/kyb/resync`)
export const uploadBusinessKybDocument = (
  businessId: string | number,
  payload: { document_kind: string; provider_document_id?: string; file?: { uri: string; name?: string; type?: string } | null; text_data?: string; force?: boolean }
) => {
  const formData = new FormData()
  formData.append('document_kind', payload.document_kind)
  if (payload.provider_document_id) formData.append('provider_document_id', payload.provider_document_id)
  if (payload.file) {
    formData.append('file', {
      uri: payload.file.uri,
      name: payload.file.name || 'business-document',
      type: payload.file.type || 'application/octet-stream',
    } as any)
  }
  if (payload.text_data) formData.append('text_data', payload.text_data)
  if (payload.force) formData.append('force', 'true')
  return client.post(`/business_entities/${businessId}/kyb/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const createBusinessProvisioning = (businessId: string | number) =>
  client.post(`/business_entities/${businessId}/provision`)

export const getBusinessWallet = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/wallet`)
export const getBusinessAccount = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/account`)
export const getBusinessTransactions = (businessId: string | number, params: Record<string, any> = {}) => {
  const search = new URLSearchParams()
  if (params.limit) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', String(params.cursor))
  const query = search.toString()
  return client.get(`/business_entities/${businessId}/transactions${query ? `?${query}` : ''}`)
}

export const getBusinessApprovalSummary = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/approval_summary`)
export const getBusinessApprovalRequests = (businessId: string | number, params: Record<string, any> = {}) => {
  const search = new URLSearchParams()
  if (params.status) search.set('status', String(params.status))
  const query = search.toString()
  return client.get(`/business_entities/${businessId}/approval_requests${query ? `?${query}` : ''}`)
}
export const approveBusinessApprovalRequest = (
  businessId: string | number,
  approvalRequestId: string | number,
  payload: Record<string, any> = {}
) => client.post(`/business_entities/${businessId}/approval_requests/${approvalRequestId}/approve`, payload)
export const rejectBusinessApprovalRequest = (
  businessId: string | number,
  approvalRequestId: string | number,
  payload: Record<string, any> = {}
) => client.post(`/business_entities/${businessId}/approval_requests/${approvalRequestId}/reject`, payload)

export const getBusinessApprovalPolicies = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/approval_policies`)

export const getBusinessMemberships = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/memberships`)
export const createBusinessMembership = (businessId: string | number, payload: Record<string, any>) =>
  client.post(`/business_entities/${businessId}/memberships`, payload)
export const updateBusinessMembership = (
  businessId: string | number,
  membershipId: string | number,
  payload: Record<string, any>
) => client.patch(`/business_entities/${businessId}/memberships/${membershipId}`, payload)
export const deleteBusinessMembership = (businessId: string | number, membershipId: string | number) =>
  client.delete(`/business_entities/${businessId}/memberships/${membershipId}`)

export const getBusinessSettings = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/settings`)
export const updateBusinessSettings = (businessId: string | number, payload: Record<string, any>) =>
  client.patch(`/business_entities/${businessId}/settings`, payload)

export const createBusinessTransfer = (businessId: string | number, payload: Record<string, any>) =>
  client.post(`/business_entities/${businessId}/transfers`, payload)
export const getBusinessTransfer = (businessId: string | number, reference: string) =>
  client.get(`/business_entities/${businessId}/transfers/${encodeURIComponent(reference)}`)
export const getBusinessReceipt = (businessId: string | number, reference: string) =>
  client.get(`/business_entities/${businessId}/receipts/${encodeURIComponent(reference)}`)

export const getBusinessPayoutRuns = (businessId: string | number, params: Record<string, any> = {}) => {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const query = search.toString()
  return client.get(`/business_entities/${businessId}/payout_runs${query ? `?${query}` : ''}`)
}

export const getBusinessPayoutRun = (businessId: string | number, payoutRunId: string | number) =>
  client.get(`/business_entities/${businessId}/payout_runs/${payoutRunId}`)

export const getBusinessScheduledPayoutRuns = (businessId: string | number) =>
  client.get(`/business_entities/${businessId}/payout_runs/scheduled`)
