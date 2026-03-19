import client from '@/api/client'
import powerDistribution from '@/data/powerDistributions.json'

export type ServiceAvailabilityState = 'operational' | 'degraded' | 'outage' | 'unknown'

export type ServiceAvailabilityRow = {
  key: string
  label: string
  state: ServiceAvailabilityState
  confidence?: 'high' | 'medium' | 'low'
  last_updated_at?: string | null
  advice?: {
    can_checkout?: boolean
    message?: string
  }
  metrics?: {
    attempts?: number
    success_rate?: number
    timeout_rate?: number
    p95_latency_ms?: number | null
    window_minutes?: number
  }
}

type ServiceAvailabilityResponse = {
  success?: boolean
  data?: {
    services?: ServiceAvailabilityRow[]
    generated_at?: string
    stale_after_seconds?: number
  }
}

export const normalizeProviderForStatus = (raw: any) => {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return ''
  if (['9-mobile', '9_mobil', '9mobil', 'etisalat', 'emts'].includes(s)) return '9mobile'
  return s.replace(/\s+/g, '_')
}

export const normalizeServiceTypeForStatus = (raw: any) => {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!s) return ''
  if (['CABLE', 'CABLETV', 'CABLE_TV'].includes(s)) return 'TV'
  if (s === 'AIRTIME') return 'VTU'
  return s
}

export const makeServiceAvailabilityKey = ({ provider, biller, serviceType }: { provider?: any; biller?: any; serviceType?: any }) => {
  const p = normalizeProviderForStatus(provider || biller)
  const t = normalizeServiceTypeForStatus(serviceType)
  if (!p || !t) return ''
  return `${p.toUpperCase()}_${t}`
}

export const getServiceAvailability = async (): Promise<ServiceAvailabilityResponse['data']> => {
  try {
    const res = await client.get('/service_availability')
    return res?.data?.data || { services: [] }
  } catch {
    return { services: [] }
  }
}

export const availabilityMapFrom = (rows?: ServiceAvailabilityRow[] | null) => {
  const map = new Map<string, ServiceAvailabilityRow>()
  ;(rows || []).forEach((row) => {
    if (row?.key) map.set(String(row.key).toUpperCase(), row)
  })
  return map
}

export const unknownAvailability = (fallbackLabel = 'Status unavailable'): ServiceAvailabilityRow => ({
  key: '',
  label: fallbackLabel,
  state: 'unknown',
  confidence: 'low',
  advice: {
    can_checkout: true,
    message: 'Status currently unavailable. You can still try.',
  },
})

export const makeElectricityServiceKey = (biller?: string) =>
  makeServiceAvailabilityKey({
    provider: biller,
    serviceType: 'ELECTRICITY',
  })

export const resolveElectricityRouteFromServiceKey = (serviceKey?: string) => {
  const rawProvider = String(serviceKey || '').trim().toUpperCase().replace(/_ELECTRICITY$/, '')
  if (!rawProvider) return null

  const provider = powerDistribution.find((item) => {
    const normalized = normalizeProviderForStatus(item?.biller)
    return normalized.toUpperCase() === rawProvider
  })
  if (!provider?.id) return null

  return {
    pathname: '/powerProviders/[id]' as const,
    params: { id: String(provider.id) },
  }
}
