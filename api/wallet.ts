import axios from 'axios'
import APP_CONFIG from './baseUrl'

const { base_url, api_route } = APP_CONFIG
export const userWallet = async ({ token }: { token: string }) => {
  try {
    const response = await axios.get(`${base_url + api_route}wallets`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const result = response.data

    return result
  } catch (error: any) {
    if (axios.isAxiosError(error) || error.response){
      return error.response.data ||'error occured'
    } 

    return 'something went wrong'
  }
}
