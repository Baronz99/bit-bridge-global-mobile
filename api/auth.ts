import axios from 'axios'
import APP_CONFIG from './baseUrl'

const { base_url, api_route } = APP_CONFIG
export const userProfile = async ({ token }: { token: string }) => {
  try {
    const response = await axios.get(`${base_url + api_route}users/user_profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = response.data

    return result
  } catch (error: any) {
    if (axios.isAxiosError(error) || error.response) {
      return error.response.data || 'error occured'
    }
    return 'something went wrong'
  }
}

export const userProfileUpdate = async ({ token, formData }: { token: string; formData: any }) => {
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
    const response = await axios.patch(`${base_url + api_route}users/user_update`, userData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = response.data
    return result
  } catch (error: any) {
    if (axios.isAxiosError(error) || error.response) {
      throw new Error(error.response.data.message || 'error occured')
    }

    throw new Error('something went wrong')
  }
}

export const userPasswordUpdate = async ({ token, formData }: { token: string; formData: any }) => {
  const userData = {
    user: {
      confirm_password: formData?.confirm_password,
      password: formData?.password,
      old_password: formData?.old_password,
    },
  }
  try {
    const response = await axios.patch(
      `${base_url + api_route}users/user_password_update`,
      userData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const result = response.data
    return result
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error?.response.data.message || 'error occured')
    }

    throw new Error('something went wrong')
  }
}

export const userProfileDel = async ({ token }: { token: string }) => {
  try {
    const response = await axios.delete(`${base_url + api_route}users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = response.data
    return result.message
  } catch (error: any) {
    if (axios.isAxiosError(error) || error.response) {
      throw error.response.data
    }

    throw new Error('something went wrong')
  }
}

export const sendUserConfirmation = async (email: string) => {
  try {
    const response = await axios.get(
      `${base_url + api_route}users/resend_confirmation_token?email=${email}`
    )

    const data = response.data
    console.log(data)
    return data
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message)
    }
    console.error(error)
    throw new Error('Something went wrong')
  }
}
