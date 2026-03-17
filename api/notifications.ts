import client from './client'

type DevicePayload = {
  provider?: string
  token: string
  platform?: string
  app_version?: string
  metadata?: Record<string, unknown>
}

export async function registerNotificationDevice(payload: DevicePayload) {
  const res = await client.post('/notifications/devices', {
    device: {
      provider: payload.provider || 'expo',
      token: payload.token,
      platform: payload.platform,
      app_version: payload.app_version,
      metadata: payload.metadata || {},
    },
  })
  return res.data
}

export async function unregisterNotificationDevice(token: string) {
  const cleanToken = String(token || '').trim()
  if (!cleanToken) return null

  const res = await client.delete('/notifications/devices', {
    data: { token: cleanToken },
  })
  return res.data
}

type ServiceStatusSubscriptionPayload = {
  provider?: string
  service_key: string
  channel?: string
  expires_in_hours?: number
  metadata?: Record<string, unknown>
}

export async function getServiceStatusSubscriptionStatus(params: {
  provider?: string
  service_key: string
  channel?: string
}) {
  const res = await client.get('/notifications/service_status_subscriptions', {
    params: {
      provider: params.provider || 'buypower',
      service_key: params.service_key,
      channel: params.channel || 'push',
    },
  })
  return res.data?.data
}

export async function subscribeToServiceStatusAlerts(payload: ServiceStatusSubscriptionPayload) {
  const res = await client.post('/notifications/service_status_subscriptions', {
    provider: payload.provider || 'buypower',
    service_key: payload.service_key,
    channel: payload.channel || 'push',
    expires_in_hours: payload.expires_in_hours || 72,
    metadata: payload.metadata || {},
  })
  return res.data?.data
}

export async function unsubscribeFromServiceStatusAlerts(params: {
  provider?: string
  service_key: string
  channel?: string
}) {
  const res = await client.delete('/notifications/service_status_subscriptions', {
    data: {
      provider: params.provider || 'buypower',
      service_key: params.service_key,
      channel: params.channel || 'push',
    },
  })
  return res.data?.data
}
