import {
  SECURITY_LOCK_ACTIVATION_ERROR_MESSAGE,
  SECURITY_LOCK_ACTIVATION_ERROR_TITLE,
  SECURITY_LOCK_CODE,
  SECURITY_LOCK_PUBLIC_MESSAGE,
  SECURITY_LOCK_PUBLIC_TITLE,
  SECURITY_LOCK_REFRESH_ERROR_MESSAGE,
  SECURITY_LOCK_REFRESH_ERROR_TITLE,
  SECURITY_LOCK_UNLOCK_AUTH_MESSAGE,
  SECURITY_LOCK_UNLOCK_AUTH_TITLE,
  SECURITY_LOCK_UNLOCK_GENERIC_MESSAGE,
  SECURITY_LOCK_UNLOCK_INVALID_CODE_MESSAGE,
  SECURITY_LOCK_UNLOCK_INVALID_CODE_TITLE,
  SECURITY_LOCK_UNLOCK_RATE_LIMIT_MESSAGE,
  SECURITY_LOCK_UNLOCK_RATE_LIMIT_TITLE,
  SECURITY_LOCK_UNLOCK_START_ERROR_TITLE,
  SECURITY_LOCK_UNLOCK_VERIFY_ERROR_TITLE,
  getSecurityLockActivationErrorNotice,
  getSecurityLockPublicNotice,
  getSecurityLockRefreshErrorNotice,
  getSecurityLockSnapshot,
  isSecurityLockError,
  mergeSecurityLockIntoProfile,
  normalizeUnlockStartError,
  normalizeUnlockVerifyError,
} from '@/utils/securityLock'

describe('securityLock helpers', () => {
  it('detects security lock API errors', () => {
    expect(isSecurityLockError({ response: { data: { error_code: SECURITY_LOCK_CODE } } })).toBe(true)
    expect(isSecurityLockError({ response: { data: { code: 'something_else' } } })).toBe(false)
  })

  it('builds a canonical snapshot from auth/profile payloads', () => {
    const snapshot = getSecurityLockSnapshot({
      security_lock: {
        active: true,
        security_locked_at: '2026-04-26T10:00:00Z',
      },
    })

    expect(snapshot?.active).toBe(true)
    expect(snapshot?.security_locked_at).toBe('2026-04-26T10:00:00Z')
  })

  it('falls back to the neutral public notice copy', () => {
    expect(getSecurityLockPublicNotice()).toEqual({
      title: SECURITY_LOCK_PUBLIC_TITLE,
      message: SECURITY_LOCK_PUBLIC_MESSAGE,
    })
  })

  it('normalizes activation failures to friendly copy', () => {
    expect(getSecurityLockActivationErrorNotice()).toEqual({
      title: SECURITY_LOCK_ACTIVATION_ERROR_TITLE,
      message: SECURITY_LOCK_ACTIVATION_ERROR_MESSAGE,
    })
  })

  it('normalizes refresh failures to friendly copy', () => {
    expect(getSecurityLockRefreshErrorNotice()).toEqual({
      title: SECURITY_LOCK_REFRESH_ERROR_TITLE,
      message: SECURITY_LOCK_REFRESH_ERROR_MESSAGE,
    })
  })

  it('normalizes unlock start 500 responses to friendly copy', () => {
    expect(normalizeUnlockStartError({ response: { status: 500 } })).toEqual({
      title: SECURITY_LOCK_UNLOCK_START_ERROR_TITLE,
      message: SECURITY_LOCK_UNLOCK_GENERIC_MESSAGE,
    })
  })

  it('normalizes unlock verify 500 responses to friendly copy', () => {
    expect(normalizeUnlockVerifyError({ response: { status: 500 } })).toEqual({
      title: SECURITY_LOCK_UNLOCK_VERIFY_ERROR_TITLE,
      message: SECURITY_LOCK_UNLOCK_GENERIC_MESSAGE,
    })
  })

  it('normalizes invalid otp responses', () => {
    expect(
      normalizeUnlockVerifyError({
        response: {
          status: 422,
          data: { code: 'invalid_otp', message: 'Invalid OTP' },
        },
      })
    ).toEqual({
      title: SECURITY_LOCK_UNLOCK_INVALID_CODE_TITLE,
      message: SECURITY_LOCK_UNLOCK_INVALID_CODE_MESSAGE,
    })
  })

  it('normalizes rate-limited unlock responses', () => {
    expect(
      normalizeUnlockVerifyError({
        response: {
          status: 429,
          data: { message: 'Too many attempts' },
        },
      })
    ).toEqual({
      title: SECURITY_LOCK_UNLOCK_RATE_LIMIT_TITLE,
      message: SECURITY_LOCK_UNLOCK_RATE_LIMIT_MESSAGE,
    })
  })

  it('normalizes expired-auth unlock responses', () => {
    expect(
      normalizeUnlockStartError({
        response: {
          status: 401,
          data: { message: 'Session expired' },
        },
      })
    ).toEqual({
      title: SECURITY_LOCK_UNLOCK_AUTH_TITLE,
      message: SECURITY_LOCK_UNLOCK_AUTH_MESSAGE,
    })
  })

  it('merges security lock state into an existing profile payload', () => {
    const next = mergeSecurityLockIntoProfile({ email: 'user@example.com' }, { active: true })
    expect(next).toEqual({
      email: 'user@example.com',
      security_lock: { active: true },
    })
  })
})
