import client from '@/api/client'

export type TimelineRecord = Record<string, unknown>

export const listTimeline = async (): Promise<unknown> => {
  // TODO: confirm timeline endpoint (global feed) naming on the revamp backend.
  const res = await client.get('/timeline')
  return res.data
}

export const listCircleTimeline = async (circleId: string | number): Promise<unknown> => {
  // TODO: confirm if circle timeline is nested or a filter on /timeline.
  const res = await client.get(`/circles/${circleId}/timeline`)
  return res.data
}
