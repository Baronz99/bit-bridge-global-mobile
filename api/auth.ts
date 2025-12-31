import client from '@/api/client'

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
