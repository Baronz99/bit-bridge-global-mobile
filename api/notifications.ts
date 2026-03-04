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
