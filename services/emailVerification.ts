import * as SecureStore from 'expo-secure-store'

export const EMAIL_VERIFICATION_SUCCESS_MESSAGE = 'Verification email sent.'
export const EMAIL_VERIFICATION_COOLDOWN_MESSAGE =
  'Please wait before requesting another verification email.'

const memoryDismissals = new Set<string>()

const asText = (value: unknown) => String(value || '').trim()
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

export const getEmailVerificationState = (user: unknown) => {
  const payload = asRecord(user)
  const root = asRecord(payload.data ?? payload)
  const email = asText(root?.email)
  const emailVerifiedAt = root?.email_verified_at ?? null
  const emailVerificationPending = root?.email_verification_pending ?? null
  const emailVerificationSentAt = root?.email_verification_sent_at ?? null
  const isVerified = Boolean(emailVerifiedAt)
  const canPrompt = Boolean(email) && !isVerified

  return {
    email,
    emailVerifiedAt,
    emailVerificationPending,
    emailVerificationSentAt,
    isVerified,
    canPrompt,
  }
}

export const isEmailVerificationCooldownError = (error: unknown) => {
  const record = asRecord(error)
  const response = asRecord(record.response)
  const responseData = asRecord(response.data)
  const status = Number(response.status || 0)
  if (status === 429) return true

  const code = asText(responseData.error_code || responseData.code).toLowerCase()
  if (code.includes('cooldown') || code.includes('rate') || code.includes('limit')) return true

  const message = asText(responseData.message || responseData.error || record.message).toLowerCase()

  return (
    message.includes('please wait') ||
    message.includes('too many') ||
    message.includes('rate limit') ||
    message.includes('cooldown') ||
    message.includes('try again later')
  )
}

export const getEmailVerificationFeedback = (error: unknown) => {
  const record = asRecord(error)
  const responseData = asRecord(asRecord(record.response).data)
  if (isEmailVerificationCooldownError(error)) return EMAIL_VERIFICATION_COOLDOWN_MESSAGE

  return (
    asText(responseData.message) ||
    asText(responseData.error) ||
    'Unable to send verification email right now.'
  )
}

const dismissKey = (email: string) => `bitbridge.email_verification.dismissed.${email.toLowerCase()}`

export const readEmailVerificationDismissed = async (email: string) => {
  const key = dismissKey(email)
  if (memoryDismissals.has(key)) return true

  try {
    const stored = await SecureStore.getItemAsync(key)
    if (stored === '1') {
      memoryDismissals.add(key)
      return true
    }
  } catch {
    // no-op
  }

  return false
}

export const writeEmailVerificationDismissed = async (email: string) => {
  const key = dismissKey(email)
  memoryDismissals.add(key)

  try {
    await SecureStore.setItemAsync(key, '1')
  } catch {
    // no-op
  }
}

export const clearEmailVerificationDismissed = async (email: string) => {
  const key = dismissKey(email)
  memoryDismissals.delete(key)

  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    // no-op
  }
}
