import client from '@/api/client'
import { getBusinessTransactions } from '@/api/business'
import { getCircle, getCircleContext } from '@/api/circles'
import type { ActiveAccount } from '@/services/useActiveAccount'
import { asArray, asObject, extractCircleRecentActivity } from '@/utils/circleWorkspace'

export const getTransactions = async ({
  params,
}: {
  params?: {
    category?: string
    type?: string
    transaction_type?: 'deposit' | 'withdraw'
    wallet_type?: 'ngn' | 'usd'
    limit?: number
    cursor?: string
  }
}) => {
  try {
    const filteredParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== undefined)
        )
      : undefined

    const response = await client.get('/transactions/user', {
      params: filteredParams,
    })

    const data = response.data

    return data
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message || 'Something went wrong')
    }

    throw error.message || 'Something went wrong'
  }
}

export const getTransactionsForAccount = async (
  activeAccount: ActiveAccount,
  {
    params,
  }: {
    params?: {
      category?: string
      type?: string
      transaction_type?: 'deposit' | 'withdraw'
      wallet_type?: 'ngn' | 'usd'
      limit?: number
      cursor?: string
    }
  }
) => {
  if (activeAccount?.type === 'business') {
    const response = await getBusinessTransactions(activeAccount.businessId, {
      limit: params?.limit,
      cursor: params?.cursor,
    })
    const payload = response?.data?.data || response?.data || {}
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.transactions)
        ? payload.transactions
        : Array.isArray(payload)
          ? payload
          : []

    return {
      data: items,
      next_cursor: payload?.next_cursor ?? payload?.cursor ?? null,
      account_context: activeAccount,
    }
  }

  if (activeAccount?.type === 'circle') {
    const activityType =
      params?.type && params.type !== 'all'
        ? params.type
        : params?.transaction_type === 'deposit'
          ? 'contribution'
          : params?.transaction_type === 'withdraw'
            ? 'withdrawal'
            : undefined

    try {
      const payload = await getCircleContext(activeAccount.circleId, {
        limit: params?.limit,
        cursor: params?.cursor,
        activity_type: activityType,
        status: params?.category,
      })
      const root = asObject(payload)
      const recentActivity = asObject(root.recent_activity)
      const items = extractCircleRecentActivity(payload)

      return {
        data: items,
        next_cursor: recentActivity?.next_cursor ?? root?.next_cursor ?? null,
        account_context: activeAccount,
      }
    } catch {
      const legacyCircle = await getCircle(activeAccount.circleId).catch(() => null)
      const items = extractCircleRecentActivity(legacyCircle)

      return {
        data: items,
        next_cursor: null,
        account_context: activeAccount,
      }
    }
  }

  return getTransactions({ params })
}

export const createTransaction = async ({ data }: { data: any }) => {
  const formdata = {
    transaction: {
      ...data,
    },
  }

  try {
    const response = await client.post('/transactions', formdata)

    const result = response.data

    return result
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data.message)
    }
    throw new Error('Something went wrong')
  }
}

export const initializeTransaction = async ({ data }: { data: any }) => {
  const formdata = {
    transaction: {
      ...data,
    },
  }

  try {
    const response = await client.post('/transactions/initialize_transaction', formdata)

    const result = response.data

    return result
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data.message)
    }
    throw new Error('Something went wrong')
  }
}

export const initiateMonnifyTransaction = async ({ data }: { data: any }) => {
  return initializeTransaction({ data })
}

export const getTransactionRecord = async (id: string) => {
  try {
    const response = await client.get(`/transaction_records/${id}`)

    const { data } = response.data

    return data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data.message)
    }
    throw new Error(error.message || 'SOmething went wrong')
  }
}

export const createUserTransaction = async ({ data }: { data: any }) => {
  const formdata = {
    transaction: {
      ...data,
    },
  }

  try {
    const response = await client.post('/transactions/create_user', formdata)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data.message || 'Not authorized')
    }
    throw new Error('Something went wrong')
  }
}
