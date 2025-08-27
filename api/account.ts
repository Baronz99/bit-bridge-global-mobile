import axios from 'axios'
import APP_CONFIG from './baseUrl'
const { base_url, api_route } = APP_CONFIG

interface CreateAccount {
  account: {
    bvn: string
    currency: string
    vendor: string
  }
}

export const createBankAccount = async (bvndata: CreateAccount, token: string) => {
  try {
    const response = await axios.post(`${base_url + api_route}accounts`, bvndata, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = response.data
    return data
  } catch (error: any) {
    console.log(error.response.data, 'error response')
    if (error.response) {
      throw new Error(error.response.data.message)
    }

    throw new Error(error?.message || 'Something went wrong')
  }
}
