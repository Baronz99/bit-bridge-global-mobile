import {
  isValidNgPhone,
  normalizeNgPhoneForApi,
  normalizeNgPhoneToE164,
  resolveAnchorPrefilledPhone,
} from '@/utils/phone'

describe('phone utils', () => {
  it('normalizes local phone numbers to +234 E.164', () => {
    expect(normalizeNgPhoneToE164('08012345678')).toBe('+2348012345678')
    expect(normalizeNgPhoneToE164('2348012345678')).toBe('+2348012345678')
    expect(normalizeNgPhoneToE164('+2348012345678')).toBe('+2348012345678')
  })

  it('validates Nigerian E.164 inputs', () => {
    expect(isValidNgPhone('+2348012345678')).toBe(true)
    expect(isValidNgPhone('2348012345678')).toBe(true)
    expect(isValidNgPhone('08012345678')).toBe(true)
    expect(isValidNgPhone('12345')).toBe(false)
  })

  it('returns API-safe phone digits without plus', () => {
    expect(normalizeNgPhoneForApi('+2348012345678')).toBe('2348012345678')
  })

  it('resolves anchor prefilled phone from nested user profile', () => {
    const profilePayload = {
      user_profile: {
        phone_number: '',
        phone_e164: '2348030000000',
      },
    }

    expect(resolveAnchorPrefilledPhone(profilePayload)).toBe('+2348030000000')
  })
})
