// src/api/products.ts (MOBILE APP)
import client from '@/api/client'

export type ProductCategory =
  | 'mobile provider'
  | 'gift card'
  | 'service'
  | 'utility'
  | 'crypto'

type GetProductsParams = {
  category?: ProductCategory
  type?: string
}

type GetProvisionsParams = {
  category?: string
  type?: string
}

/**
 * ✅ Uses central axios client (client.ts)
 * - baseURL already points to .../api/v1
 * - Authorization header is attached automatically via interceptor
 * - 401 refresh/retry handled globally
 */
export const getProducts = async (params?: GetProductsParams) => {
  try {
    const res = await client.get('/products', { params })
    return res.data?.data
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      'Something went wrong'
    if (err) err.message = msg
    throw err
  }
}

export const getProvisions = async (params?: GetProvisionsParams) => {
  try {
    const res = await client.get('/provisions', { params })
    return res.data?.data
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      'Something went wrong'
    if (err) err.message = msg
    throw err
  }
}

export const getProvision = async (id: string) => {
  try {
    if (!id) throw new Error('Provision id is required')

    const res = await client.get(`/provisions/${id}`)
    return res.data?.data
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      'Something went wrong'
    if (err) err.message = msg
    throw err
  }
}
