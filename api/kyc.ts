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
  reason_code?: string
  reason?: string
  display?: {
    severity?: 'info' | 'success' | 'warning' | 'error'
    title?: string
    message?: string
    action?: string
    action_label?: string
  }
  locked_until?: string
  bvn_locked_until?: string
  message?: string
}

export type NinVerifyPayload = {
  nin?: string
  number?: string
}

export type NinVerifyResponse = {
  status: string
  tier?: string
  nin_last4?: string
  prembly_reference?: string
  verified_at?: string
  reason?: string
  message?: string
  requirements?: {
    missing?: string[]
    next_steps?: string[]
  }
}

export type KycStatusResponse = {
  data?: {
    kyc_level?: string
    phone_verified?: boolean
    phone_verified_at?: string
    phone_e164?: string
    primary_use_case?: string
    id_type?: string
    user_profile?: {
      id?: string | number
      first_name?: string
      last_name?: string
      full_name?: string
      phone_number?: string
      date_of_birth?: string
      phone_verified_at?: string
      role?: string
      primary_use_case?: string
      id_type?: string
      address_line1?: string
      address_line2?: string
      city?: string
      state?: string
      country?: string
      postal_code?: string
      proof_of_address_type?: string
      proof_of_address_url?: string
      id_document_url?: string
    }
    user_kyc?: {
      bvn_status?: string
      bvn_last4?: string
      bvn_provider?: string
      bvn_provider_reference?: string
      bvn_verified_at?: string
      nin_status?: string
      nin_last4?: string
      nin_provider?: string
      nin_provider_reference?: string
      nin_verified_at?: string
      nin_last_result_status?: string
      nin_last_result_reason?: string
      nin_last_checked_at?: string
      bvn_name_match?: boolean
      bvn_dob_match?: boolean
      bvn_first_name_match?: boolean
      bvn_last_name_match?: boolean
      bvn_match_score?: number
      watchlisted?: boolean
      bvn_attempts_count?: number
      bvn_failed_attempts_count?: number
      bvn_locked_until?: string
      tier3_status?: string
      tier3_error?: string
      tier3_reference?: string
      tier3_verified_at?: string
    }
  }
}

export type Tier3SubmitPayload = {
  image: string
}

export type Tier3SubmitResponse = {
  status?: string
  message?: string
  detail?: string
  error?: string
}

export type Tier3StatusResponse = {
  tier3_status?: string
  tier3_error?: string
  tier3_reference?: string
  tier3_verified_at?: string
}

export type Tier3StartResponse = {
  status?: string
  message?: string
  detail?: string
  error?: string
}

export type Tier3LivenessResponse = {
  status?: string
  message?: string
  error?: string
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

export const verifyNin = async (payload: NinVerifyPayload) => {
  const res = await client.post('/kyc/nin/verify', payload)
  return res.data as NinVerifyResponse
}

export const getNinStatus = async () => {
  const res = await client.get('/kyc/nin/status')
  return res.data as NinVerifyResponse
}

export const getKycStatus = async () => {
  const res = await client.get('/users/user_profile')
  return res.data as KycStatusResponse
}

export const submitTier3 = async (payload: Tier3SubmitPayload) => {
  const res = await client.post('/verification/tier3/start', payload)
  return res.data as Tier3SubmitResponse
}

export const getTier3Status = async () => {
  const res = await client.get('/verification/tier3/status')
  return res.data as Tier3StatusResponse
}

export const startTier3 = async (payload?: { image?: string; image_url?: string }) => {
  const res = await client.post('/verification/tier3/start', payload || {})
  return res.data as Tier3StartResponse
}

export const submitTier3Liveness = async (image: string) => {
  const res = await client.post('/verification/tier3/liveness', { image })
  return res.data as Tier3LivenessResponse
}
