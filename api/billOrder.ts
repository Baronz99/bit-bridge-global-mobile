import axios from 'axios'
import APP_CONFIG from './baseUrl'
import moneyFormat from '@/utils/moneyFormat'
const { base_url, api_route } = APP_CONFIG

export const createPurchaseOrder = async ({ orderData, token }) => {
  try {
    const response = await axios.post(
      `${base_url + api_route}payment_processors/process_payment`,
      orderData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = response.data
    return data
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message)
    }

    throw new Error(error.message || 'Something went wrong')
  }
}

export const updateOrderStatus = async ({ id, token }: any) => {
  try {
    const response = await axios.get(
      `${base_url + api_route}payment_processors/${id}/update_status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = response.data
    return data
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message)
    }

    throw new Error(error.message || 'Something went wrong')
  }
}

export const getPurchaseOrder = async ({ id, token }: any) => {
  try {
    const response = await axios.get(`${base_url + api_route}payment_processors/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const { data } = response.data
    return data
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message)
    }
    throw new Error('Something went wrong')
  }
}

export const confirmPayment = async ({ token, queryId, payment_method }: any) => {
  try {
    const response = await axios.get(
      `${base_url + api_route}payment_processors/${queryId}/confirm_payment?payment_method=${payment_method}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = response.data

    return data
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message)
    }
    throw new Error('Something went wrong')
  }
}

export const confirmBillPayment = async ({
  token,
  queryId,
  payment_method,
  use_commission,
}: any) => {
  try {
    const response = await axios.get(
      `${base_url + api_route}bill_orders/${queryId}/initialize_confirm_payment?payment_method=${payment_method}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = response.data

    return data
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message)
    }
    throw new Error('Something went wrong')
  }
}

export const confirmOrderPayment = async ({ token, queryId, data }: any) => {
  try {
    const response = await axios.patch(
      `${base_url + api_route}bill_orders/${queryId}/confirm_bill_payment`,
      { bill_order: data },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const responseData = response.data

    return responseData
  } catch (error: any) {
    console.log(error, token, '[Error for Order]: Error retrieved from confirmation')
    if (error.response) {
      throw new Error(error.response.data.message)
    }
    throw new Error('Something went wrong')
  }
}
export const repurchaseOrder = async ({ id, token }: any) => {
  try {
    const response = await axios.get(
      `${base_url + api_route}payment_processors//${id}/repurchase`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const result = response.data

    return result
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message)
    }

    throw new Error('Something went wrong')
  }
}

export const getUserOrders = async ({
  token,
  params,
}: {
  token: string
  params?: {
    status: string
  }
}) => {
  try {
    const response = await axios.get(`${base_url + api_route}bill_orders/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const { data } = response.data
    return data
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response?.message || 'failed to purchace')
    }
    console.error(error)
    throw new Error('Something went wrong')
  }
}

export const getRescentPurchaseOrder = async ({ token }: { token: string }) => {
  try {
    const response = await axios.get(`${base_url + api_route}bill_orders/user_recent`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const { data } = response.data
    return data
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response?.message || 'failed to purchace')
    }
    console.error(error)
    throw new Error('Something went wrong')
  }
}

export const getPriceList = async ({ provider, service_type, token }: any) => {
  try {
    const response = await axios.get(
      `${base_url + api_route}payment_processors/get_price_list?provider=${provider}&service_type=${service_type}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const result = response.data

    const priceListOptions = result.data.map((item: any) => {
      return {
        value: item.code,
        label: `${moneyFormat(item?.price)} | ${item?.desc} |  ${item?.validity ?? ''}`,
        amount: item?.price,
      }
    })

    return priceListOptions
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message)
    }
    console.error(error)
    throw new Error('Something went wrong')
  }
}
