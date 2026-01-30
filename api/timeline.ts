// api/timeline.ts
import client from '@/api/client'

export type TimelineQuery = {
  cursor?: string | null
  limit?: number
  type?: string // all | wallet | cards | bills | circles
  status?: string
  startDate?: string
  endDate?: string
  minAmount?: string
  maxAmount?: string
  source?: string
  showAlerts?: boolean
  show_alerts?: boolean
  search?: string
}

const normalizeQuery = (q?: TimelineQuery) => {
  const query = q || {}
  const params: Record<string, any> = {}

  if (query.cursor) params.cursor = query.cursor
  params.limit = query.limit ?? 25

  if (query.type && query.type !== 'all') params.type = query.type
  if (query.status && query.status !== 'all') params.status = query.status
  if (query.startDate) params.start_date = query.startDate
  if (query.endDate) params.end_date = query.endDate
  if (query.minAmount) params.min_amount = query.minAmount
  if (query.maxAmount) params.max_amount = query.maxAmount
  if (query.source && query.source !== 'all') params.source = query.source
  if (typeof query.showAlerts === 'boolean') params.show_alerts = query.showAlerts
  if (typeof query.show_alerts === 'boolean') params.show_alerts = query.show_alerts
  if (query.search) params.search = query.search

  return params
}

export const listTimeline = async (query?: TimelineQuery) => {
  return client.get('/timeline', { params: normalizeQuery(query) })
}

export const getTimelineItem = async (id: string) => {
  return client.get(`/timeline/${id}`)
}

/**
 * ✅ Smart helper:
 * - Returns null on 404 (backend doesn't support some timeline IDs).
 * - Throws for other errors.
 */
export const getTimelineItemSmart = async (id: string) => {
  try {
    return await getTimelineItem(id)
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 404) return null
    throw err
  }
}

// Compatibility for `import * as apiTimeline from '@/api/timeline'`
export const apiTimeline = { listTimeline, getTimelineItem, getTimelineItemSmart }

// Optional default export
export default apiTimeline
