import client from '@/api/client'

export type TimelineRecord = Record<string, unknown>

export type TimelineQuery = {
  cursor?: string
  limit?: number
  type?: string
  status?: string
  startDate?: string
  endDate?: string
  minAmount?: string
  maxAmount?: string
  source?: string
  showAlerts?: boolean
  search?: string
}

export const listTimeline = async (query: TimelineQuery = {}): Promise<unknown> => {
  const params: Record<string, unknown> = {}
  if (query.cursor) params.cursor = query.cursor
  if (query.limit) params.limit = query.limit
  if (query.type && query.type !== 'all') params.type = query.type
  if (query.status && query.status !== 'all') params.status = query.status
  if (query.startDate) params.start_date = query.startDate
  if (query.endDate) params.end_date = query.endDate
  if (query.minAmount) params.min_amount = query.minAmount
  if (query.maxAmount) params.max_amount = query.maxAmount
  if (query.source && query.source !== 'all') params.source = query.source
  if (query.showAlerts === false) params.show_alerts = false
  if (query.search) params.search = query.search

  const res = await client.get('/timeline', { params })
  return res.data
}

export const getTimelineItem = async (id: string): Promise<unknown> => {
  // Placeholder for a detail endpoint.
  const res = await client.get(`/timeline/${id}`)
  return res.data
}

export const listCircleTimeline = async (circleId: string | number): Promise<unknown> => {
  const res = await client.get(`/circles/${circleId}/timeline`)
  return res.data
}
