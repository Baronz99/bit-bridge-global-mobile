export const SECURITY_LOCK_CODE = 'security_lock_active'
export const SECURITY_LOCK_PUBLIC_TITLE = 'Transaction temporarily unavailable'
export const SECURITY_LOCK_PUBLIC_MESSAGE = 'This transaction cant be completed right now. Please try again later.'
export const SECURITY_LOCK_ACTIVATION_ERROR_TITLE = 'Couldnt activate Security Lock'
export const SECURITY_LOCK_ACTIVATION_ERROR_MESSAGE = 'Please try again. If this continues, contact support.'
export const SECURITY_LOCK_REFRESH_ERROR_TITLE = 'Couldnt refresh status'
export const SECURITY_LOCK_REFRESH_ERROR_MESSAGE = 'Please check your connection and try again.'
export const SECURITY_LOCK_UNLOCK_START_ERROR_TITLE = 'Couldnt start unlock'
export const SECURITY_LOCK_UNLOCK_VERIFY_ERROR_TITLE = 'Couldnt unlock Security Lock'
export const SECURITY_LOCK_UNLOCK_GENERIC_MESSAGE = 'Please try again. If this continues, contact support.'
export const SECURITY_LOCK_UNLOCK_AUTH_TITLE = 'Verification required'
export const SECURITY_LOCK_UNLOCK_AUTH_MESSAGE = 'Please sign in again and retry.'
export const SECURITY_LOCK_UNLOCK_INVALID_CODE_TITLE = 'Incorrect code'
export const SECURITY_LOCK_UNLOCK_INVALID_CODE_MESSAGE = 'Please check the code and try again.'
export const SECURITY_LOCK_UNLOCK_RATE_LIMIT_TITLE = 'Too many attempts'
export const SECURITY_LOCK_UNLOCK_RATE_LIMIT_MESSAGE = 'Please wait a few minutes and try again.'

export type SecurityLockSnapshot = {
  active?: boolean
  security_locked?: boolean
  security_locked_at?: string | null
  security_lock_reason?: string | null
  security_lock_source?: string | null
  security_unlocked_at?: string | null
  security_unlock_method?: string | null
  unlock_contact?: {
    phone_verified?: boolean
    masked_phone?: string | null
  } | null
} | null

export function getSecurityLockSnapshot(payload: any): SecurityLockSnapshot {
  if (!payload || typeof payload !== 'object') return null
  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  const snapshot = root?.security_lock ?? root
  if (!snapshot || typeof snapshot !== 'object') return null
  const active = snapshot.active === true || snapshot.security_locked === true
  return {
    active,
    security_locked: active,
    security_locked_at: snapshot.security_locked_at ?? null,
    security_lock_reason: snapshot.security_lock_reason ?? null,
    security_lock_source: snapshot.security_lock_source ?? null,
    security_unlocked_at: snapshot.security_unlocked_at ?? null,
    security_unlock_method: snapshot.security_unlock_method ?? null,
    unlock_contact: snapshot.unlock_contact ?? null,
  }
}

export function isSecurityLockError(error: any): boolean {
  const code = String(error?.response?.data?.error_code || error?.response?.data?.code || error?.error_code || error?.code || '').trim()
  return code === SECURITY_LOCK_CODE
}

export function getSecurityLockPublicNotice(error?: any) {
  const title = String(error?.response?.data?.title || error?.title || SECURITY_LOCK_PUBLIC_TITLE).trim() || SECURITY_LOCK_PUBLIC_TITLE
  const message = String(
    error?.response?.data?.public_message ||
      error?.response?.data?.message ||
      error?.message ||
      SECURITY_LOCK_PUBLIC_MESSAGE
  ).trim() || SECURITY_LOCK_PUBLIC_MESSAGE

  return { title, message }
}

export function getSecurityLockActivationErrorNotice() {
  return {
    title: SECURITY_LOCK_ACTIVATION_ERROR_TITLE,
    message: SECURITY_LOCK_ACTIVATION_ERROR_MESSAGE,
  }
}

export function getSecurityLockRefreshErrorNotice() {
  return {
    title: SECURITY_LOCK_REFRESH_ERROR_TITLE,
    message: SECURITY_LOCK_REFRESH_ERROR_MESSAGE,
  }
}

function getSecurityLockErrorStatus(error?: any) {
  const status = Number(error?.response?.status)
  return Number.isFinite(status) ? status : null
}

function getSecurityLockErrorCode(error?: any) {
  return String(
    error?.response?.data?.error_code ||
      error?.response?.data?.code ||
      error?.code ||
      ''
  )
    .trim()
    .toLowerCase()
}

function getSecurityLockErrorMessage(error?: any) {
  return String(
    error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      ''
  )
    .trim()
    .toLowerCase()
}

function normalizeUnlockError(
  error: any,
  fallbackTitle: string
): { title: string; message: string } {
  const status = getSecurityLockErrorStatus(error)
  const code = getSecurityLockErrorCode(error)
  const message = getSecurityLockErrorMessage(error)

  if (status === 401 || status === 403) {
    return {
      title: SECURITY_LOCK_UNLOCK_AUTH_TITLE,
      message: SECURITY_LOCK_UNLOCK_AUTH_MESSAGE,
    }
  }

  if (
    status === 429 ||
    code.includes('rate') ||
    code.includes('too_many') ||
    message.includes('too many')
  ) {
    return {
      title: SECURITY_LOCK_UNLOCK_RATE_LIMIT_TITLE,
      message: SECURITY_LOCK_UNLOCK_RATE_LIMIT_MESSAGE,
    }
  }

  if (
    status === 422 &&
    (code.includes('otp') ||
      code.includes('code') ||
      message.includes('invalid otp') ||
      message.includes('invalid code') ||
      message.includes('incorrect code') ||
      message.includes('wrong code'))
  ) {
    return {
      title: SECURITY_LOCK_UNLOCK_INVALID_CODE_TITLE,
      message: SECURITY_LOCK_UNLOCK_INVALID_CODE_MESSAGE,
    }
  }

  return {
    title: fallbackTitle,
    message: SECURITY_LOCK_UNLOCK_GENERIC_MESSAGE,
  }
}

export function normalizeUnlockStartError(error?: any) {
  return normalizeUnlockError(error, SECURITY_LOCK_UNLOCK_START_ERROR_TITLE)
}

export function normalizeUnlockVerifyError(error?: any) {
  return normalizeUnlockError(error, SECURITY_LOCK_UNLOCK_VERIFY_ERROR_TITLE)
}

export function mergeSecurityLockIntoProfile(profile: any, snapshot: SecurityLockSnapshot) {
  if (!profile || typeof profile !== 'object') return profile
  return {
    ...profile,
    security_lock: snapshot,
  }
}
