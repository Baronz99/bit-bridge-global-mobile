import client from '@/api/client'

export const getTransactionPinStatus = async () => {
  const res = await client.get('/transaction_pin/status')
  return res.data
}

export const setTransactionPin = async (pin: string) => {
  const res = await client.post('/transaction_pin/set', { pin })
  return res.data
}

export const verifyTransactionPin = async (pin: string) => {
  const endpoint = '/transaction_pin/verify'
  try {
    const payload = { pin }
    if (__DEV__) {
      const base = client.defaults.baseURL || '(no-base)'
      console.log('[PIN_VERIFY] url', `${base}${endpoint}`, 'payloadKeys', Object.keys(payload))
    }
    const res = await client.post(endpoint, payload)
    if (__DEV__) console.log('[PIN_VERIFY] res', res?.data)
    return res.data
  } catch (err: any) {
    const status = err?.response?.status
    if (__DEV__) console.log('[PIN_VERIFY] error', status, err?.response?.data || err?.message)
    throw err
  }
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
