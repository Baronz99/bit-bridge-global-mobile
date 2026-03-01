type AnyRecord = Record<string, any>

const asRecord = (value: unknown): AnyRecord => {
  if (!value || typeof value !== 'object') return {}
  return value as AnyRecord
}

export const normalizeNgPhoneToE164 = (value?: string | null): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const digits = raw.replace(/\D+/g, '')
  if (!digits) return ''

  let normalized = digits
  if (normalized.length == 11 && normalized.startsWith('0')) {
    normalized = `234${normalized.slice(1)}`
  } else if (normalized.length == 10) {
    normalized = `234${normalized}`
  }

  if (!/^234\d{10}$/.test(normalized)) return ''
  return `+${normalized}`
}

export const normalizeNgPhoneForApi = (value?: string | null): string => {
  return normalizeNgPhoneToE164(value).replace(/^\+/, '')
}

export const isValidNgPhone = (value?: string | null): boolean => {
  return /^\+234\d{10}$/.test(normalizeNgPhoneToE164(value))
}

export const resolveAnchorPrefilledPhone = (
  profilePayload: unknown,
  rootPayload?: unknown
): string => {
  const profile = asRecord(profilePayload)
  const root = asRecord(rootPayload)
  const nestedProfile = asRecord(profile.user_profile ?? profile.profile)
  const rootNestedProfile = asRecord(root.user_profile ?? root.profile)

  const candidates = [
    profile.phone_number,
    profile.phone_e164,
    profile.phone,
    nestedProfile.phone_number,
    nestedProfile.phone_e164,
    nestedProfile.phone,
    root.phone_number,
    root.phone_e164,
    root.phone,
    rootNestedProfile.phone_number,
    rootNestedProfile.phone_e164,
    rootNestedProfile.phone,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeNgPhoneToE164(candidate)
    if (normalized) return normalized
  }

  return ''
}
