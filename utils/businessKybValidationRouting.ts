export type BusinessOnboardingSection = 'business' | 'contact' | 'signatory'

export type BusinessKybValidationRoute = {
  section: BusinessOnboardingSection
  field?: string
  fieldMessage?: string
  providerStatus?: string
  source: 'structured' | 'fallback'
}

type ObjectRecord = Record<string, unknown>

type FieldErrorEntry = {
  path: string
  message: string
}

const asRecord = (value: unknown): ObjectRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectRecord) : null

const compactString = (value: unknown) => String(value || '').trim()

const normalizeKey = (value: unknown) =>
  compactString(value)
    .toLowerCase()
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const collectText = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join(' ')
  const record = asRecord(value)
  if (record) return Object.values(record).map(collectText).filter(Boolean).join(' ')
  return ''
}

const normalizeSection = (value: unknown): BusinessOnboardingSection | null => {
  const key = normalizeKey(value)
  if (!key) return null
  if (key.includes('signatory') || key.includes('director') || key.includes('owner')) return 'signatory'
  if (key.includes('contact') || key.includes('address') || key.includes('registered') || key.includes('operating')) return 'contact'
  if (key.includes('business') || key.includes('company') || key.includes('profile')) return 'business'
  return null
}

const pathLooksSignatory = (path: string) =>
  path.includes('signatory') ||
  path.includes('signatories') ||
  path.includes('director') ||
  path.includes('owner') ||
  path.includes('representative')

const routeFromPath = (pathValue: unknown, sectionValue?: unknown): Omit<BusinessKybValidationRoute, 'source' | 'fieldMessage' | 'providerStatus'> | null => {
  const path = normalizeKey(pathValue)
  const section = normalizeSection(sectionValue)
  if (!path && section) return { section }
  if (!path) return null
  if (section && path === normalizeKey(sectionValue)) return { section }

  if (path.includes('title')) return { section: 'signatory', field: 'title' }

  if (path.includes('state') || path.includes('country')) {
    if (pathLooksSignatory(path) || section === 'signatory') return { section: 'signatory', field: path.includes('country') ? 'country' : 'state' }
    if (path.includes('registered')) return { section: 'contact', field: path.includes('country') ? 'registered_country' : 'registered_state' }
    return { section: 'contact', field: path.includes('country') ? 'country' : 'state' }
  }

  if (path.includes('registered')) return { section: 'contact', field: path.replace(/^.*registered_/, 'registered_') }
  if (section) return { section, field: path.split('_').pop() || undefined }
  return null
}

const routeFromFallbackText = (textValue: unknown): Omit<BusinessKybValidationRoute, 'source' | 'fieldMessage' | 'providerStatus'> | null => {
  const text = normalizeKey(textValue)
  if (!text) return null
  if (text.includes('title')) return { section: 'signatory', field: 'title' }
  if (text.includes('registered') && (text.includes('state') || text.includes('country'))) {
    return { section: 'contact', field: text.includes('country') ? 'registered_country' : 'registered_state' }
  }
  if (pathLooksSignatory(text) && (text.includes('state') || text.includes('country'))) {
    return { section: 'signatory', field: text.includes('country') ? 'country' : 'state' }
  }
  if (text.includes('invalid_state') || (text.includes('state') && text.includes('country'))) {
    return { section: 'contact', field: 'state' }
  }
  return null
}

const fieldErrorEntries = (value: unknown, prefix = ''): FieldErrorEntry[] => {
  if (!value) return []

  if (typeof value === 'string') {
    return prefix ? [{ path: prefix, message: value }] : []
  }

  if (Array.isArray(value)) {
    const objectEntries = value.flatMap((item) => {
      const record = asRecord(item)
      if (!record) return []
      const path = compactString(record.field_path || record.path || record.field || prefix)
      const message = compactString(record.message || record.error || collectText(record.messages || record.errors))
      return path && message ? [{ path, message }] : fieldErrorEntries(record, prefix)
    })
    if (objectEntries.length) return objectEntries
    const message = value.map(collectText).filter(Boolean).join(' ')
    return prefix && message ? [{ path: prefix, message }] : []
  }

  const record = asRecord(value)
  if (!record) return []

  const directPath = compactString(record.field_path || record.path || record.field || prefix)
  const directMessage = compactString(record.message || record.error)
  if (directPath && directMessage) return [{ path: directPath, message: directMessage }]

  return Object.entries(record).flatMap(([key, child]) => fieldErrorEntries(child, prefix ? `${prefix}.${key}` : key))
}

const messageForRoute = (entries: FieldErrorEntry[], route: Omit<BusinessKybValidationRoute, 'source' | 'fieldMessage' | 'providerStatus'>) => {
  const routeField = normalizeKey(route.field)
  const match = entries.find((entry) => {
    const path = normalizeKey(entry.path)
    if (!routeField) return false
    if (routeField === 'title') return path.includes('title')
    if (routeField === 'registered_state') return path.includes('registered') && path.includes('state')
    if (routeField === 'registered_country') return path.includes('registered') && path.includes('country')
    return path.endsWith(routeField) || path.includes(`_${routeField}`) || path.includes(routeField)
  })
  return match?.message
}

export const resolveBusinessKybValidationRoute = (data: unknown, fallbackText?: string): BusinessKybValidationRoute | null => {
  const record = asRecord(data)
  const fieldPath = record?.field_path
  const errorCode = record?.error_code
  const section = record?.section
  const providerStatus = compactString(record?.provider_status)
  const entries = fieldErrorEntries(record?.field_errors)

  const structuredCandidates = [
    fieldPath,
    ...entries.map((entry) => entry.path),
    errorCode,
    section,
  ]

  for (const candidate of structuredCandidates) {
    const route = routeFromPath(candidate, section)
    if (route) {
      return {
        ...route,
        fieldMessage: messageForRoute(entries, route) || undefined,
        providerStatus: providerStatus || undefined,
        source: 'structured',
      }
    }
  }

  const fallbackRoute = routeFromFallbackText(`${fallbackText || ''} ${collectText(data)}`)
  if (!fallbackRoute) return null
  return {
    ...fallbackRoute,
    providerStatus: providerStatus || undefined,
    source: 'fallback',
  }
}
