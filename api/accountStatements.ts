import client from '@/api/client'

export type AccountStatementRecord = {
  id: string
  reference: string
  status: 'pending' | 'ready' | 'failed' | string
  currency?: string | null
  wallet_type?: string | null
  date_from?: string | null
  date_to?: string | null
  created_at?: string | null
  generated_at?: string | null
  failed_at?: string | null
  failure_reason?: string | null
  failure_code?: string | null
  transaction_count?: number | null
  opening_balance_cents?: number | null
  closing_balance_cents?: number | null
  total_credits_cents?: number | null
  total_debits_cents?: number | null
  total_fees_cents?: number | null
  download_url?: string | null
}

export type AccountStatementRangePayload = {
  date_from: string
  date_to: string
}

export const listAccountStatements = async (): Promise<AccountStatementRecord[]> => {
  const res = await client.get('/account_statements')
  const data = res?.data?.data
  return Array.isArray(data) ? data : []
}

export const createAccountStatement = async (
  payload: AccountStatementRangePayload
): Promise<AccountStatementRecord> => {
  const res = await client.post('/account_statements', payload)
  return (res?.data?.data || null) as AccountStatementRecord
}

export const getAccountStatement = async (id: string | number): Promise<AccountStatementRecord> => {
  const res = await client.get(`/account_statements/${id}`)
  return (res?.data?.data || null) as AccountStatementRecord
}
