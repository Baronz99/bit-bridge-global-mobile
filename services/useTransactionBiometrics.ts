import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import {
  createBiometricEnrollment,
  createBiometricSession,
} from '@/api/transactionPin'
import { error as logError, log, warn } from '@/utils/logger'

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
const enrollmentKey = (userId: string) => `transaction-biometric-enrollment-${userId}`
const TRANSFER_BIOMETRIC_STORE_OPTIONS: SecureStore.SecureStoreOptions =
  Platform.OS === 'ios'
    ? { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    : {}

type TxBioCode =
  | 'TXBIO_DEVICE_ID_FAIL'
  | 'TXBIO_STORE_FAIL'
  | 'TXBIO_STORE_FAIL_WRITE'
  | 'TXBIO_VERIFY_FAIL'
  | 'TXBIO_VERIFY_FAIL_INITIAL_READ'
  | 'TXBIO_VERIFY_FAIL_RETRY_READ'
  | 'TXBIO_VERIFY_FAIL_MISMATCH'
  | 'TXBIO_USER_ID_FAIL'
  | 'TXBIO_PIN_FAIL'
  | 'TXBIO_TOKEN_FAIL'
  | 'TXBIO_PENDING_MISSING'
  | 'TXBIO_PENDING_EXPIRED'

type PendingEnrollment = {
  pin: string
  createdAt: number
}

const PENDING_ENROLLMENT_TTL_MS = 10 * 60 * 1000
const SECURE_STORE_VERIFY_RETRY_DELAY_MS = 75
const pendingEnrollmentPins = new Map<string, PendingEnrollment>()

const normalizeUserId = (value: unknown) => String(value || '').trim()

const emitTxBioLog = (level: 'log' | 'warn' | 'error', event: string, payload?: unknown) => {
  const line = `[TX_BIOMETRIC] ${event}`
  if (level === 'error') {
    console.error(line, payload)
    logError(line, payload)
    return
  }
  if (level === 'warn') {
    console.warn(line, payload)
    warn(line, payload)
    return
  }
  console.log(line, payload)
  log(line, payload)
}

const buildTxBioError = (code: TxBioCode, message: string, details?: unknown) => {
  const error = new Error(message) as Error & { txBioCode?: TxBioCode; txBioDetails?: unknown }
  error.txBioCode = code
  error.txBioDetails = details
  return error
}

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

const describeError = (error: unknown) => {
  const err = error as any
  return {
    message: err?.message || String(error || ''),
    code: err?.code || null,
    name: err?.name || null,
  }
}

const saveSecureValue = async (key: string, value: string) => {
  emitTxBioLog('log', 'secure_store:set:start', {
    key,
    valueLength: value.length,
    usesDeviceBoundOptions: true,
  })
  try {
    await SecureStore.setItemAsync(key, value, TRANSFER_BIOMETRIC_STORE_OPTIONS)
  } catch (error) {
    throw buildTxBioError(
      'TXBIO_STORE_FAIL_WRITE',
      `SecureStore setItemAsync failed for key ${key}`,
      describeError(error)
    )
  }
  let stored: string | null = null
  try {
    stored = await SecureStore.getItemAsync(key, TRANSFER_BIOMETRIC_STORE_OPTIONS)
  } catch (error) {
    throw buildTxBioError(
      'TXBIO_VERIFY_FAIL_INITIAL_READ',
      `SecureStore verification read failed for key ${key}`,
      {
        stage: 'initial_read',
        error: describeError(error),
      }
    )
  }
  emitTxBioLog('log', 'secure_store:set:verify', {
    key,
    stored: stored === value,
    storedLength: String(stored || '').length,
    attempt: 1,
    usesDeviceBoundOptions: true,
  })
  if (stored !== value) {
    await new Promise((resolve) => setTimeout(resolve, SECURE_STORE_VERIFY_RETRY_DELAY_MS))
    try {
      stored = await SecureStore.getItemAsync(key, TRANSFER_BIOMETRIC_STORE_OPTIONS)
    } catch (error) {
      throw buildTxBioError(
        'TXBIO_VERIFY_FAIL_RETRY_READ',
        `SecureStore verification retry failed for key ${key}`,
        {
          stage: 'retry_read',
          error: describeError(error),
        }
      )
    }
    emitTxBioLog('log', 'secure_store:set:verify', {
      key,
      stored: stored === value,
      storedLength: String(stored || '').length,
      attempt: 2,
      usesDeviceBoundOptions: true,
    })
  }
  if (stored !== value) {
    throw buildTxBioError(
      'TXBIO_VERIFY_FAIL_MISMATCH',
      `SecureStore verification failed for key ${key}`,
      {
        storedLength: String(stored || '').length,
        expectedLength: value.length,
      }
    )
  }
}

const getOrCreateDeviceId = async () => {
  try {
    const existing = await SecureStore.getItemAsync(
      BIOMETRIC_DEVICE_ID_KEY,
      TRANSFER_BIOMETRIC_STORE_OPTIONS
    )
    emitTxBioLog('log', 'device_id:read', {
      exists: Boolean(existing),
      valueLength: String(existing || '').length,
      usesDeviceBoundOptions: true,
    })
    if (existing) return existing
  } catch (error) {
    emitTxBioLog('error', 'device_id:read_failed', describeError(error))
  }

  const created = generateDeviceId()
  emitTxBioLog('log', 'device_id:generated', {
    valueLength: created.length,
  })
  try {
    await saveSecureValue(BIOMETRIC_DEVICE_ID_KEY, created)
    emitTxBioLog('log', 'device_id:stored')
  } catch (error) {
    emitTxBioLog('error', 'device_id:store_failed', describeError(error))
    throw buildTxBioError(
      'TXBIO_DEVICE_ID_FAIL',
      'Biometric confirmation could not be prepared on this device because the biometric device ID could not be saved.',
      describeError(error)
    )
  }
  return created
}

const toErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback

export type TransferBiometricEnrollmentResult =
  | {
      status: 'enrolled'
      token: string
      reason:
        | 'existing_enrollment'
        | 'new_enrollment'
    }
  | {
      status: 'skipped'
      reason:
        | 'biometric_unavailable'
    }

export type TransferBiometricUxState =
  | 'eligible_not_enabled'
  | 'enabling'
  | 'enabled'
  | 'skipped'
  | 'failed'

export type TransferBiometricUxResult = {
  state: TransferBiometricUxState
  code?: TxBioCode
  message?: string
  details?: unknown
}

const getPendingEnrollment = (userId: string) => {
  const pending = pendingEnrollmentPins.get(userId)
  if (!pending) return null
  if (Date.now() - pending.createdAt > PENDING_ENROLLMENT_TTL_MS) {
    pendingEnrollmentPins.delete(userId)
    return null
  }
  return pending
}

export const getTransferBiometricFailureMessage = (code?: string, fallback?: string) => {
  switch (code) {
    case 'TXBIO_DEVICE_ID_FAIL':
      return 'This device could not be prepared for transfer biometrics yet.'
    case 'TXBIO_STORE_FAIL':
    case 'TXBIO_STORE_FAIL_WRITE':
      return 'This device blocked secure storage needed for transfer biometrics.'
    case 'TXBIO_VERIFY_FAIL':
    case 'TXBIO_VERIFY_FAIL_INITIAL_READ':
    case 'TXBIO_VERIFY_FAIL_RETRY_READ':
    case 'TXBIO_VERIFY_FAIL_MISMATCH':
      return 'Transfer biometrics could not be verified after saving on this device.'
    case 'TXBIO_USER_ID_FAIL':
      return 'Your account session is incomplete. Close and reopen the app, then try again.'
    case 'TXBIO_PIN_FAIL':
      return 'A valid 4-digit transaction PIN is required.'
    case 'TXBIO_TOKEN_FAIL':
      return 'The server did not return a transfer biometric enrollment token.'
    case 'TXBIO_PENDING_MISSING':
      return 'Transfer biometric setup is no longer ready. Complete another PIN-confirmed transfer and try again.'
    case 'TXBIO_PENDING_EXPIRED':
      return 'Transfer biometric setup expired. Complete another PIN-confirmed transfer and try again.'
    default:
      return fallback || 'Transfer biometrics could not be enabled on this device yet.'
  }
}

export const useTransactionBiometrics = (userId?: string | null) => {
  const normalizedUserId = useMemo(() => normalizeUserId(userId), [userId])
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    const check = async () => {
      emitTxBioLog('log', 'capability_check:start', {
        normalizedUserIdPresent: Boolean(normalizedUserId),
      })
      const localAuth = await loadLocalAuthentication()
      if (!localAuth) {
        emitTxBioLog('warn', 'capability_check:local_auth_unavailable')
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
            ? await SecureStore
                .getItemAsync(enrollmentKey(normalizedUserId), TRANSFER_BIOMETRIC_STORE_OPTIONS)
                .catch(() => null)
            : null

        emitTxBioLog('log', 'capability_check:resolved', {
          hasHardware,
          isEnrolled,
          capable,
          normalizedUserIdPresent: Boolean(normalizedUserId),
          enrollmentTokenPresent: Boolean(token),
        })
        if (mounted) {
          setAvailable(capable)
          setEnabled(Boolean(capable && normalizedUserId && token))
        }
      } catch (checkError) {
        emitTxBioLog('error', 'capability_check:error', describeError(checkError))
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

  const maybeEnrollAfterPinSuccess = async (pin: string): Promise<TransferBiometricEnrollmentResult> => {
    emitTxBioLog('log', 'enrollment:start', {
      available,
      normalizedUserIdPresent: Boolean(normalizedUserId),
      pinLength: String(pin || '').length,
    })
    if (!available) {
      emitTxBioLog('warn', 'enrollment:skipped', {
        reason: 'biometric_unavailable',
      })
      return {
        status: 'skipped',
        reason: 'biometric_unavailable',
      }
    }
    if (!normalizedUserId) {
      emitTxBioLog('warn', 'enrollment:missing_user_id')
      throw buildTxBioError(
        'TXBIO_USER_ID_FAIL',
        'Biometric confirmation could not be enabled because your account session is incomplete. Close and reopen the app, then try again.'
      )
    }
    if (!/^\d{4}$/.test(String(pin || ''))) {
      emitTxBioLog('warn', 'enrollment:invalid_pin_shape')
      throw buildTxBioError(
        'TXBIO_PIN_FAIL',
        'A valid 4-digit transaction PIN is required to enable biometric confirmation.'
      )
    }

    const existing = await SecureStore
      .getItemAsync(enrollmentKey(normalizedUserId), TRANSFER_BIOMETRIC_STORE_OPTIONS)
      .catch(() => null)
    if (existing) {
      emitTxBioLog('log', 'enrollment:existing_token_found')
      setEnabled(true)
      return {
        status: 'enrolled',
        token: String(existing),
        reason: 'existing_enrollment',
      }
    }

    const deviceId = await getOrCreateDeviceId()
    emitTxBioLog('log', 'enrollment:request', {
      deviceIdPresent: Boolean(deviceId),
      deviceIdLength: String(deviceId || '').length,
      normalizedUserId,
    })
    const response = await createBiometricEnrollment(pin, deviceId)
    const token =
      response?.biometric_enrollment_token ||
      response?.enrollment_token

    emitTxBioLog('log', 'enrollment:response', {
      tokenPresent: Boolean(token),
      tokenLength: String(token || '').length,
    })

    if (!token) {
      emitTxBioLog('warn', 'enrollment:missing_token')
      throw buildTxBioError(
        'TXBIO_TOKEN_FAIL',
        'Biometric confirmation could not be enabled because the server did not return an enrollment token.'
      )
    }

    try {
      await saveSecureValue(enrollmentKey(normalizedUserId), String(token))
      emitTxBioLog('log', 'enrollment:stored', {
        normalizedUserId,
      })
    } catch (error) {
      emitTxBioLog('error', 'enrollment:failed:store', {
        normalizedUserId,
        key: enrollmentKey(normalizedUserId),
        tokenLength: String(token).length,
        error: describeError(error),
      })
      const txBioCode =
        (error as any)?.txBioCode || 'TXBIO_STORE_FAIL'
      throw buildTxBioError(
        txBioCode,
        'Biometric confirmation could not be saved on this device. Please check device security settings and try again.',
        describeError(error)
      )
    }
    setEnabled(true)
    emitTxBioLog('log', 'enrollment:enabled', {
      normalizedUserId,
    })
    return {
      status: 'enrolled',
      token: String(token),
      reason: 'new_enrollment',
    }
  }

  const prepareEnrollmentAfterPinSuccess = async (pin: string): Promise<TransferBiometricUxResult> => {
    emitTxBioLog('log', 'enrollment_prepare:start', {
      available,
      normalizedUserIdPresent: Boolean(normalizedUserId),
      pinLength: String(pin || '').length,
      enabled,
    })

    if (!available) {
      emitTxBioLog('warn', 'enrollment_prepare:skipped', {
        reason: 'biometric_unavailable',
      })
      return {
        state: 'skipped',
        message: 'Set up Face ID / Fingerprint on this device to enable faster transfer confirmations.',
      }
    }

    if (!normalizedUserId) {
      emitTxBioLog('warn', 'enrollment_prepare:missing_user_id')
      return {
        state: 'failed',
        code: 'TXBIO_USER_ID_FAIL',
        message: getTransferBiometricFailureMessage('TXBIO_USER_ID_FAIL'),
        details: null,
      }
    }

    if (!/^\d{4}$/.test(String(pin || ''))) {
      emitTxBioLog('warn', 'enrollment_prepare:invalid_pin_shape')
      return {
        state: 'failed',
        code: 'TXBIO_PIN_FAIL',
        message: getTransferBiometricFailureMessage('TXBIO_PIN_FAIL'),
      }
    }

    const existing = await SecureStore
      .getItemAsync(enrollmentKey(normalizedUserId), TRANSFER_BIOMETRIC_STORE_OPTIONS)
      .catch(() => null)
    if (existing) {
      setEnabled(true)
      emitTxBioLog('log', 'enrollment_prepare:already_enabled')
      return {
        state: 'enabled',
      }
    }

    pendingEnrollmentPins.set(normalizedUserId, {
      pin: String(pin),
      createdAt: Date.now(),
    })
    emitTxBioLog('log', 'enrollment_prepare:ready', {
      normalizedUserId,
    })
    return {
      state: 'eligible_not_enabled',
    }
  }

  const enablePreparedEnrollment = async (): Promise<TransferBiometricUxResult> => {
    if (!normalizedUserId) {
      return {
        state: 'failed',
        code: 'TXBIO_USER_ID_FAIL',
        message: getTransferBiometricFailureMessage('TXBIO_USER_ID_FAIL'),
      }
    }

    const pending = getPendingEnrollment(normalizedUserId)
    if (!pending) {
      const hasStaleKey = pendingEnrollmentPins.has(normalizedUserId)
      pendingEnrollmentPins.delete(normalizedUserId)
      const code: TxBioCode = hasStaleKey ? 'TXBIO_PENDING_EXPIRED' : 'TXBIO_PENDING_MISSING'
      emitTxBioLog('warn', 'enrollment_enable:no_pending', {
        code,
        normalizedUserId,
      })
      return {
        state: 'failed',
        code,
        message: getTransferBiometricFailureMessage(code),
        details: null,
      }
    }

    emitTxBioLog('log', 'enrollment_enable:start', {
      normalizedUserId,
    })
    try {
      const result = await maybeEnrollAfterPinSuccess(pending.pin)
      pendingEnrollmentPins.delete(normalizedUserId)
      if (result.status === 'enrolled') {
        return { state: 'enabled' }
      }
      return {
        state: 'skipped',
        message: 'Set up Face ID / Fingerprint on this device to enable faster transfer confirmations.',
      }
    } catch (error: any) {
      emitTxBioLog('error', 'enrollment_enable:failed', {
        code: error?.txBioCode || null,
        details: error?.txBioDetails || null,
      })
      return {
        state: 'failed',
        code: error?.txBioCode,
        message: getTransferBiometricFailureMessage(error?.txBioCode, error?.message),
        details: error?.txBioDetails || null,
      }
    }
  }

  const skipPreparedEnrollment = () => {
    if (!normalizedUserId) return
    pendingEnrollmentPins.delete(normalizedUserId)
    emitTxBioLog('log', 'enrollment_prepare:skipped_by_user', {
      normalizedUserId,
    })
  }

  const clearEnrollment = async () => {
    if (!normalizedUserId) return
    await SecureStore
      .deleteItemAsync(enrollmentKey(normalizedUserId), TRANSFER_BIOMETRIC_STORE_OPTIONS)
      .catch(() => {})
    setEnabled(false)
  }

  const getApprovalToken = async () => {
    emitTxBioLog('log', 'session:start', {
      available,
      normalizedUserIdPresent: Boolean(normalizedUserId),
    })
    if (!available) {
      emitTxBioLog('warn', 'session:biometric_unavailable')
      throw new Error('Biometric confirmation is not available on this device.')
    }
    if (!normalizedUserId) {
      emitTxBioLog('warn', 'session:missing_user_id')
      throw new Error('Sign in again to use biometric confirmation.')
    }

    const enrollmentToken = await SecureStore
      .getItemAsync(enrollmentKey(normalizedUserId), TRANSFER_BIOMETRIC_STORE_OPTIONS)
      .catch(() => null)
    if (!enrollmentToken) {
      emitTxBioLog('warn', 'session:missing_enrollment_token')
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

      emitTxBioLog('log', 'session:local_auth_result', {
        success: result.success,
        error: result.error || null,
      })
      if (!result.success) {
        if (result.error === 'user_cancel') {
          throw new Error('Biometric confirmation cancelled.')
        }
        throw new Error('Biometric confirmation failed. Use your transaction PIN.')
      }

      const deviceId = await getOrCreateDeviceId()
      emitTxBioLog('log', 'session:request', {
        deviceIdPresent: Boolean(deviceId),
      })
      const response = await createBiometricSession(String(enrollmentToken), deviceId)
      const token =
        response?.biometric_approval_token ||
        response?.approval_token

      if (!token) {
        emitTxBioLog('warn', 'session:missing_approval_token')
        throw new Error('Unable to create biometric confirmation session.')
      }

      emitTxBioLog('log', 'session:success')
      return String(token)
    } catch (error: any) {
      const code = error?.response?.data?.error_code
      if (code === 'biometric_enrollment_invalid') {
        await clearEnrollment()
      }
      emitTxBioLog('error', 'session:error', {
        code,
        message: error?.message || null,
        responseMessage: error?.response?.data?.message || null,
      })
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
    hasPreparedEnrollment: Boolean(normalizedUserId && getPendingEnrollment(normalizedUserId)),
    biometricLoading: loading,
    maybeEnrollAfterPinSuccess,
    prepareEnrollmentAfterPinSuccess,
    enablePreparedEnrollment,
    skipPreparedEnrollment,
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
