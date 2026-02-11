import { resolveUserProfile } from '@/services/auth/resolveUserProfile'

describe('resolveUserProfile', () => {
  it('is exported as a function', () => {
    expect(typeof resolveUserProfile).toBe('function')
  })

  it('unwraps data payloads and always returns user_profile object', () => {
    const resolved = resolveUserProfile({
      data: {
        email: 'user@example.com',
        user_profile: { first_name: 'Ada' },
      },
    })

    expect(resolved.email).toBe('user@example.com')
    expect(resolved.user_profile).toEqual({ first_name: 'Ada' })
  })

  it('handles null/invalid payload safely', () => {
    expect(resolveUserProfile(null)).toEqual({ user_profile: {} })
    expect(resolveUserProfile(undefined)).toEqual({ user_profile: {} })
  })
})

