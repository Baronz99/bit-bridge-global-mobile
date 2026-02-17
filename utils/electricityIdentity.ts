type AnyRecord = Record<string, unknown>

const clean = (value: unknown) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const normalized = text.toLowerCase()
  if (normalized === 'undefined' || normalized === 'null') return ''
  return text
}

const readPath = (obj: unknown, path: string) => {
  if (!obj || typeof obj !== 'object') return ''
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined
    return (acc as AnyRecord)[key]
  }, obj)
  return clean(value)
}

const pickPath = (source: AnyRecord, paths: string[]) => {
  for (const path of paths) {
    const value = readPath(source, path)
    if (value) return value
  }
  return ''
}

export type ElectricityIdentity = {
  customerName: string
  serviceAddress: string
}

export const resolveElectricityIdentity = (source: unknown): ElectricityIdentity => {
  const payload = source && typeof source === 'object' ? (source as AnyRecord) : {}

  const customerName = pickPath(payload, [
    'customerName',
    'customer_name',
    'name',
    'meta.customerName',
    'meta.customer_name',
    'meta.name',
    'provider_response.customerName',
    'provider_response.customer_name',
    'provider_response.name',
    'provider_response.data.customerName',
    'provider_response.data.customer_name',
    'provider_response.data.name',
    'provider_response.result.data.customerName',
    'provider_response.result.data.customer_name',
    'provider_response.result.data.name',
    'parties.customerName',
    'parties.customer_name',
    'parties.name',
  ])

  const serviceAddress = pickPath(payload, [
    'address',
    'service_address',
    'meter_address',
    'meta.address',
    'meta.service_address',
    'meta.meter_address',
    'provider_response.address',
    'provider_response.service_address',
    'provider_response.meter_address',
    'provider_response.data.address',
    'provider_response.data.service_address',
    'provider_response.data.meter_address',
    'provider_response.result.data.address',
    'provider_response.result.data.service_address',
    'provider_response.result.data.meter_address',
    'parties.address',
    'parties.service_address',
    'parties.meter_address',
  ])

  return { customerName, serviceAddress }
}
