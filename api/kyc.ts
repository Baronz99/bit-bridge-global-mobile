import client from '@/api/client'

export type PhoneVerificationRequestPayload = {
  phone_number: string
  current_password?: string
}

export type PhoneVerificationRequestResponse = {
  status: string
  message?: string
  phone_e164?: string
  phone_number?: string
  phone_verified_at?: string
  expires_at?: string
  expires_in_seconds?: number
  resend_available_in_seconds?: number
  provider_message_id?: string
  reason?: string
  errors?: string[]
}

export type PhoneVerificationVerifyPayload = {
  phone_number: string
  code: string
}

export type PhoneVerificationVerifyResponse = {
  status: string
  phone_e164?: string
  phone_number?: string
  phone_verified_at?: string
  errors?: string[]
}

export type BvnVerifyPayload = {
  bvn: string
}

export type BvnVerifyResponse = {
  status: string
  tier?: string
  bvn_last4?: string
  matches?: {
    dob?: boolean
    first_name?: boolean
    last_name?: boolean
  }
  match_score?: number
  prembly_reference?: string
  verified_at?: string
  reason?: string
  locked_until?: string
  message?: string
}

export type KycStatusResponse = {
  data?: {
    kyc_level?: string
    phone_verified?: boolean
    phone_verified_at?: string
    phone_e164?: string
    user_kyc?: {
      bvn_status?: string
      bvn_last4?: string
      bvn_provider?: string
      bvn_provider_reference?: string
      bvn_verified_at?: string
      bvn_name_match?: boolean
      bvn_dob_match?: boolean
      bvn_first_name_match?: boolean
      bvn_last_name_match?: boolean
      bvn_match_score?: number
      watchlisted?: boolean
      bvn_attempts_count?: number
      bvn_failed_attempts_count?: number
      bvn_locked_until?: string
    }
  }
}

export const requestPhoneOtp = async (payload: PhoneVerificationRequestPayload) => {
  const res = await client.post('/phone_verification/request', payload)
  return res.data as PhoneVerificationRequestResponse
}

export const verifyPhoneOtp = async (payload: PhoneVerificationVerifyPayload) => {
  const res = await client.post('/phone_verification/verify', payload)
  return res.data as PhoneVerificationVerifyResponse
}

export const verifyBvn = async (payload: BvnVerifyPayload) => {
  const res = await client.post('/kyc/bvn/verify', payload)
  return res.data as BvnVerifyResponse
}

export const getKycStatus = async () => {
  const res = await client.get('/users/user_profile')
  return res.data as KycStatusResponse
}
