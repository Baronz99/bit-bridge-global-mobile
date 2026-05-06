import client from '@/api/client'

export const getTransactionPinStatus = async () => {
  const res = await client.get('/transaction_pin/status')
  return res.data
}

export const setTransactionPin = async (pin: string) => {
  const res = await client.post('/transaction_pin/set', { pin })
  return res.data
}

export const enableTransactionPinAppLock = async () => {
  const res = await client.post('/transaction_pin/app_lock/enable')
  return res.data
}

export const disableTransactionPinAppLock = async () => {
  const res = await client.post('/transaction_pin/app_lock/disable')
  return res.data
}

export const verifyTransactionPin = async (pin: string) => {
  const endpoint = '/transaction_pin/verify'
  try {
    const payload = { pin }
    const res = await client.post(endpoint, payload)
    return res.data
  } catch (err: any) {
    throw err
  }
}

export const createBiometricEnrollment = async (pin: string, deviceId: string) => {
  const res = await client.post('/transaction_pin/biometric_enrollment', {
    pin,
    device_id: deviceId,
  })
  return res.data
}

export const createBiometricSession = async (enrollmentToken: string, deviceId: string) => {
  const res = await client.post('/transaction_pin/biometric_session', {
    biometric_enrollment_token: enrollmentToken,
    device_id: deviceId,
  })
  return res.data
}

export const changeTransactionPin = async (payload: {
  current_pin: string
  new_pin: string
}) => {
  const res = await client.patch('/transaction_pin/change', payload)
  return res.data
}

export const requestTransactionPinReset = async (payload: {
  phone_number?: string
  current_password?: string
}) => {
  const res = await client.post('/transaction_pin/reset/request', payload)
  return res.data
}

export const confirmTransactionPinReset = async (payload: {
  code: string
  new_pin: string
  phone_number?: string
}) => {
  const res = await client.post('/transaction_pin/reset/confirm', payload)
  return res.data
}
