import client from '@/api/client'

export const getTransactions = async ({
  params,
}: {
  params?: {
    category?: string
    type?: string
    transaction_type: 'deposit' | 'withdraw'
  }
}) => {
  try {
    const response = await client.get('/transactions/user', {
      params,
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

export const initiateMonnifyTransaction = async ({ data }: { data: any }) => {
  const formdata = {
    transaction: {
      ...data,
    },
  }

  console.log(formdata)

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
