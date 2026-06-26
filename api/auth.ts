import client from '@/api/client'
import APP_CONFIG from './baseUrl'

export const signup = async (payload: { user: Record<string, any> }) => {
  try {
    const response = await client.request({
      method: 'POST',
      baseURL: APP_CONFIG.root_url,
      url: '/signup',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      data: payload,
      __skipAuth: true,
      __skipAuthRefresh: true,
    } as any)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.status?.message || 'Signup failed')
    }
    throw new Error(error?.message || 'Signup failed')
  }
}

export const userProfile = async () => {
  try {
    const response = await client.get('/users/user_profile')
    return response.data
  } catch (error: any) {
    if (error?.response) {
      return error.response.data || 'error occured'
    }
    return 'something went wrong'
  }
}

export const userProfileUpdate = async ({ formData }: { formData: any }) => {
  const userData = {
    user: {
      email: formData?.email,
      user_profile_attributes: {
        id: formData?.user_profile_id,
        first_name: formData?.first_name,
        last_name: formData?.last_name,
        phone_number: formData?.phone,
        gender: formData?.gender,
        date_of_birth: formData?.date_of_birth,
        country: formData?.country,
        address_line1: formData?.address_line1,
        city: formData?.city,
        state: formData?.state,
        postal_code: formData?.postal_code,
      },
    },
  }

  try {
    const response = await client.patch('/users/user_update', userData)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'error occured')
    }
    throw new Error('something went wrong')
  }
}

export const userPasswordUpdate = async ({ formData }: { formData: any }) => {
  const userData = {
    user: {
      confirm_password: formData?.confirm_password,
      password: formData?.password,
      old_password: formData?.old_password,
    },
  }

  try {
    const response = await client.patch('/users/user_password_update', userData)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'error occured')
    }
    throw new Error('something went wrong')
  }
}

export const userProfileDel = async () => {
  try {
    const response = await client.delete('/users')
    return response.data?.message
  } catch (error: any) {
    if (error?.response) {
      throw error.response.data
    }
    throw new Error('something went wrong')
  }
}

export const sendUserConfirmation = async (email: string) => {
  try {
    const response = await client.get(
      `/users/resend_confirmation_token?email=${encodeURIComponent(email)}`
    )
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'error occured')
    }
    throw new Error('Something went wrong')
  }
}

export type RequestUnconfirmedEmailRecoveryPayload = {
  phone_number: string
  current_password: string
  new_email: string
}

export type ConfirmUnconfirmedEmailRecoveryPayload = {
  phone_number: string
  current_password: string
  new_email: string
  phone_otp_code: string
}

export const requestUnconfirmedEmailRecovery = async (payload: RequestUnconfirmedEmailRecoveryPayload) => {
  try {
    const response = await client.post('/users/request_unconfirmed_email_recovery', payload)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'Unable to verify this account')
    }
    throw new Error('Unable to verify this account')
  }
}

export const confirmUnconfirmedEmailRecovery = async (payload: ConfirmUnconfirmedEmailRecoveryPayload) => {
  try {
    const response = await client.post('/users/confirm_unconfirmed_email_recovery', payload)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'Unable to update unconfirmed email')
    }
    throw new Error('Unable to update unconfirmed email')
  }
}

export type RequestEmailChangePayload = {
  new_email: string
  current_password: string
}

export type ConfirmEmailChangePayload = {
  new_email: string
  current_password: string
  phone_otp_code: string
}

export const requestEmailChange = async (payload: RequestEmailChangePayload) => {
  try {
    const response = await client.post('/users/request_email_change', payload)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'Unable to request email change')
    }
    throw new Error('Unable to request email change')
  }
}

export const confirmEmailChange = async (payload: ConfirmEmailChangePayload) => {
  try {
    const response = await client.post('/users/confirm_email_change', payload)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'Unable to confirm email change')
    }
    throw new Error('Unable to confirm email change')
  }
}

export const requestEmailVerification = async () => {
  try {
    const response = await client.post('/users/request_email_verification')
    return response.data
  } catch (error: unknown) {
    if ((error as { response?: unknown } | null)?.response) {
      throw error
    }
    throw new Error('Unable to send verification email')
  }
}

export const confirmEmailToken = async (confirmationToken: string) => {
  try {
    const response = await client.request({
      method: 'GET',
      baseURL: APP_CONFIG.root_url,
      url: '/confirmation',
      params: { confirmation_token: confirmationToken },
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      __skipAuth: true,
      __skipAuthRefresh: true,
    } as any)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'Email confirmation failed')
    }
    throw new Error('Email confirmation failed')
  }
}

export const requestPasswordReset = async (email: string) => {
  try {
    const response = await client.get('/users/password_reset', {
      params: { email },
    })
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'error occured')
    }
    throw new Error('Something went wrong')
  }
}

export const confirmPasswordReset = async (payload: {
  reset_password_token: string
  password: string
  password_confirmation?: string
}) => {
  try {
    const response = await client.patch('/users/update_password', {
      user: {
        reset_password_token: payload.reset_password_token,
        password: payload.password,
        password_confirmation: payload.password_confirmation || payload.password,
      },
    })
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.message || 'error occured')
    }
    throw new Error('Something went wrong')
  }
}


