import { resolveAnchorPrefill } from '@/utils/anchorOnboardingPrefill'

describe('resolveAnchorPrefill', () => {
  it('resolves required fields from nested user_profile payload', () => {
    const payload = {
      user_profile: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_e164: '2348011111111',
        address_line1: '42 Marina',
        city: 'Lagos',
        state: 'Lagos',
        postal_code: '100001',
        date_of_birth: '1990-01-02',
        bvn: '12345678901',
        gender: 'Female',
      },
      email: 'ada@example.com',
    }

    const resolved = resolveAnchorPrefill(payload, payload)

    expect(resolved.firstName).toBe('Ada')
    expect(resolved.lastName).toBe('Lovelace')
    expect(resolved.email).toBe('ada@example.com')
    expect(resolved.phone).toBe('+2348011111111')
    expect(resolved.address).toBe('42 Marina')
    expect(resolved.city).toBe('Lagos')
    expect(resolved.state).toBe('Lagos')
    expect(resolved.postalCode).toBe('100001')
    expect(resolved.dob).toBe('1990-01-02')
    expect(resolved.bvn).toBe('12345678901')
    expect(resolved.gender).toBe('female')
  })

  it('falls back to id_number when id_type is bvn', () => {
    const payload = {
      id_type: 'bvn',
      id_number: '12345678901',
      phone_number: '08020000000',
      email: 'user@example.com',
    }

    const resolved = resolveAnchorPrefill(payload, payload)

    expect(resolved.bvn).toBe('12345678901')
    expect(resolved.phone).toBe('+2348020000000')
  })
})
