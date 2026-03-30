import { useEffect, useMemo, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import {
  createBiometricEnrollment,
  createBiometricSession,
} from '@/api/transactionPin'

type LocalAuthResult = {
  success: boolean
  error?: string
}

type LocalAuthModule = {
  hasHardwareAsync: () => Promise<boolean>
  isEnrolledAsync: () => Promise<boolean>
  authenticateAsync: (options: {
    promptMessage: string
    cancelLabel?: string
    fallbackLabel?: string
    disableDeviceFallback?: boolean
  }) => Promise<LocalAuthResult>
}

const BIOMETRIC_DEVICE_ID_KEY = 'transaction-biometric-device-id'
const enrollmentKey = (userId: string) => `transaction-biometric-enrollment:${userId}`

const normalizeUserId = (value: unknown) => String(value || '').trim()

const loadLocalAuthentication = async (): Promise<LocalAuthModule | null> => {
  try {
    const mod = await import('expo-local-authentication')
    const api = (mod?.default ?? mod) as LocalAuthModule
    if (
      api &&
      typeof api.hasHardwareAsync === 'function' &&
      typeof api.isEnrolledAsync === 'function' &&
      typeof api.authenticateAsync === 'function'
    ) {
      return api
    }
    return null
  } catch {
    return null
  }
}

const generateDeviceId = () =>
  `bbg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const getOrCreateDeviceId = async () => {
  const existing = await SecureStore.getItemAsync(BIOMETRIC_DEVICE_ID_KEY).catch(() => null)
  if (existing) return existing
  const created = generateDeviceId()
  await SecureStore.setItemAsync(BIOMETRIC_DEVICE_ID_KEY, created).catch(() => {})
  return created
}

const toErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback

export const useTransactionBiometrics = (userId?: string | null) => {
  const normalizedUserId = useMemo(() => normalizeUserId(userId), [userId])
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    const check = async () => {
      const localAuth = await loadLocalAuthentication()
      if (!localAuth) {
        if (mounted) {
          setAvailable(false)
          setEnabled(false)
        }
        return
      }

      try {
        const [hasHardware, isEnrolled] = await Promise.all([
          localAuth.hasHardwareAsync(),
          localAuth.isEnrolledAsync(),
        ])
        const capable = Boolean(hasHardware && isEnrolled)
        const token =
          normalizedUserId
            ? await SecureStore.getItemAsync(enrollmentKey(normalizedUserId)).catch(() => null)
            : null

        if (mounted) {
          setAvailable(capable)
          setEnabled(Boolean(capable && normalizedUserId && token))
        }
      } catch {
        if (mounted) {
          setAvailable(false)
          setEnabled(false)
        }
      }
    }

    void check()
    return () => {
      mounted = false
    }
  }, [normalizedUserId])

  const maybeEnrollAfterPinSuccess = async (pin: string) => {
    if (!available) return null
    if (!normalizedUserId) {
      throw new Error('Biometric confirmation could not be enabled because your account session is incomplete. Close and reopen the app, then try again.')
    }
    if (!/^\d{4}$/.test(String(pin || ''))) {
      throw new Error('A valid 4-digit transaction PIN is required to enable biometric confirmation.')
    }

    const existing = await SecureStore.getItemAsync(enrollmentKey(normalizedUserId)).catch(() => null)
    if (existing) {
      setEnabled(true)
      return existing
    }

    const deviceId = await getOrCreateDeviceId()
    const response = await createBiometricEnrollment(pin, deviceId)
    const token =
      response?.biometric_enrollment_token ||
      response?.enrollment_token

    if (!token) return null

    try {
      await SecureStore.setItemAsync(enrollmentKey(normalizedUserId), String(token))
    } catch {
      throw new Error('Biometric confirmation could not be saved on this device. Please check device security settings and try again.')
    }
    setEnabled(true)
    return String(token)
  }

  const clearEnrollment = async () => {
    if (!normalizedUserId) return
    await SecureStore.deleteItemAsync(enrollmentKey(normalizedUserId)).catch(() => {})
    setEnabled(false)
  }

  const getApprovalToken = async () => {
    if (!available) {
      throw new Error('Biometric confirmation is not available on this device.')
    }
    if (!normalizedUserId) {
      throw new Error('Sign in again to use biometric confirmation.')
    }

    const enrollmentToken = await SecureStore.getItemAsync(enrollmentKey(normalizedUserId)).catch(() => null)
    if (!enrollmentToken) {
      throw new Error('Use your transaction PIN once on this device to enable biometric confirmations.')
    }

    setLoading(true)
    try {
      const localAuth = await loadLocalAuthentication()
      if (!localAuth) {
        throw new Error('Biometric confirmation is not available on this device.')
      }

      const result = await localAuth.authenticateAsync({
        promptMessage: 'Confirm with Face ID / Fingerprint',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use transaction PIN',
        disableDeviceFallback: false,
      })

      if (!result.success) {
        if (result.error === 'user_cancel') {
          throw new Error('Biometric confirmation cancelled.')
        }
        throw new Error('Biometric confirmation failed. Use your transaction PIN.')
      }

      const deviceId = await getOrCreateDeviceId()
      const response = await createBiometricSession(String(enrollmentToken), deviceId)
      const token =
        response?.biometric_approval_token ||
        response?.approval_token

      if (!token) {
        throw new Error('Unable to create biometric confirmation session.')
      }

      return String(token)
    } catch (error: any) {
      const code = error?.response?.data?.error_code
      if (code === 'biometric_enrollment_invalid') {
        await clearEnrollment()
      }
      throw new Error(
        toErrorMessage(error, 'Biometric confirmation failed. Use your transaction PIN.')
      )
    } finally {
      setLoading(false)
    }
  }

  return {
    biometricAvailable: available,
    biometricEnabled: enabled,
    biometricLoading: loading,
    maybeEnrollAfterPinSuccess,
    getApprovalToken,
    clearEnrollment,
  }
}

export const resolveTransactionBiometricUserId = (payload: any) =>
  normalizeUserId(
    payload?.id ||
      payload?.user_id ||
      payload?.data?.id ||
      payload?.data?.user_id
  )
