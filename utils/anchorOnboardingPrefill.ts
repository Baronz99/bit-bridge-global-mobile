import { resolveAnchorPrefilledPhone } from '@/utils/phone'

type AnyRecord = Record<string, any>

const asRecord = (value: unknown): AnyRecord => {
  if (!value || typeof value !== 'object') return {}
  return value as AnyRecord
}

const normalizeText = (value: unknown): string => String(value || '').trim()
const normalizeSpaces = (value: unknown): string => normalizeText(value).replace(/\s+/g, ' ')

const normalizeName = (value: unknown): string => normalizeSpaces(value)
const normalizeEmail = (value: unknown): string => normalizeText(value).toLowerCase()
const normalizePostalCode = (value: unknown): string => normalizeSpaces(value)
const normalizeState = (value: unknown): string => {
  const raw = normalizeSpaces(value)
  if (!raw) return ''
  const lowered = raw.toLowerCase()
  if (lowered == 'fct' || lowered == 'abuja' || lowered == 'fct (abuja)') return 'FCT'
  return raw
}
const normalizeGender = (value: unknown): string => {
  const raw = normalizeText(value).toLowerCase()
  if (raw == 'male' || raw == 'female') return raw
  return ''
}

const pickFirst = (sources: AnyRecord[], keys: string[]): string => {
  for (const source of sources) {
    for (const key of keys) {
      const value = normalizeText(source?.[key])
      if (value) return value
    }
  }
  return ''
}

const normalizeDob = (value: unknown): string => {
  const raw = normalizeText(value)
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

const normalizeBvn = (value: unknown): string => {
  const digits = normalizeText(value).replace(/\D+/g, '')
  return digits.length == 11 ? digits : ''
}

export type AnchorPrefill = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  postalCode: string
  dob: string
  bvn: string
  gender: string
}

export const resolveAnchorPrefill = (profilePayload: unknown, rootPayload?: unknown): AnchorPrefill => {
  const profile = asRecord(profilePayload)
  const root = asRecord(rootPayload)
  const nestedProfile = asRecord(profile.user_profile ?? profile.profile)
  const rootNestedProfile = asRecord(root.user_profile ?? root.profile)
  const sources = [profile, nestedProfile, root, rootNestedProfile]

  const idType = pickFirst(sources, ['id_type']).toLowerCase()

  return {
    firstName: normalizeName(pickFirst(sources, ['first_name', 'firstname', 'given_name'])),
    lastName: normalizeName(pickFirst(sources, ['last_name', 'lastname', 'surname', 'family_name'])),
    email: normalizeEmail(pickFirst(sources, ['email'])),
    phone: resolveAnchorPrefilledPhone(profilePayload, rootPayload),
    address: normalizeSpaces(pickFirst(sources, ['address_line1', 'address_line_1', 'addressLine_1', 'addressLine1', 'address', 'street_address', 'residential_address'])),
    city: normalizeSpaces(pickFirst(sources, ['city', 'town', 'lga_city'])),
    state: normalizeState(pickFirst(sources, ['state', 'state_of_residence', 'province', 'region'])),
    postalCode: normalizePostalCode(pickFirst(sources, ['postal_code', 'postcode', 'zip_code', 'zip'])),
    dob: normalizeDob(pickFirst(sources, ['dob', 'date_of_birth', 'birthdate'])),
    bvn: normalizeBvn(pickFirst(sources, ['bvn', 'bvn_number']) || (idType == 'bvn' ? pickFirst(sources, ['id_number']) : '')),
    gender: normalizeGender(pickFirst(sources, ['gender'])),
  }
}
