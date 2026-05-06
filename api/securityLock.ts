import client from '@/api/client'
import { getSecurityLockSnapshot } from '@/utils/securityLock'

export type ActivateSecurityLockPayload = {
  pin?: string
  biometric_approval_token?: string
  reason?: string
}

export type StartSecurityLockUnlockPayload = {
  current_password: string
}

export type VerifySecurityLockUnlockPayload = {
  otp_code: string
}

export async function getSecurityLock() {
  const response = await client.get('/security_lock')
  return getSecurityLockSnapshot(response?.data)
}

export async function activateSecurityLock(payload: ActivateSecurityLockPayload) {
  const response = await client.post('/security_lock/activate', payload)
  return getSecurityLockSnapshot(response?.data)
}

export async function startSecurityLockUnlock(payload: StartSecurityLockUnlockPayload) {
  const response = await client.post('/security_lock/unlock/start', payload)
  return response?.data?.data ?? response?.data
}

export async function verifySecurityLockUnlock(payload: VerifySecurityLockUnlockPayload) {
  const response = await client.post('/security_lock/unlock/verify', payload)
  return getSecurityLockSnapshot(response?.data)
}
