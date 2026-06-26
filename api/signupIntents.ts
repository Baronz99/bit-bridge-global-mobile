import client from '@/api/client'

export type RequestSignupIntentOtpPayload = {
  phone_number: string
  email?: string
  first_name?: string
  last_name?: string
}

export type VerifySignupIntentOtpPayload = {
  signup_intent_id: string
  phone_number?: string
  code: string
}

export type CompleteSignupIntentPayload = {
  signup_intent_id: string
  email: string
  password: string
  password_confirmation: string
  first_name?: string
  last_name?: string
}

export const requestSignupIntentOtp = async (payload: RequestSignupIntentOtpPayload) => {
  const response = await client.post('/signup_intents/request_otp', payload)
  return response.data
}

export const verifySignupIntentOtp = async (payload: VerifySignupIntentOtpPayload) => {
  const response = await client.post('/signup_intents/verify_otp', payload)
  return response.data
}

export const completeSignupIntent = async (payload: CompleteSignupIntentPayload) => {
  const response = await client.post('/signup_intents/complete', payload)
  return response.data
}

