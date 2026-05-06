export type TransactionStatusTone = 'success' | 'pending' | 'failed' | 'info'

export type FinanceSummaryRow = {
  label: string
  value?: string | null
  emphasis?: boolean
  mono?: boolean
  wrap?: boolean
}

export type BalanceModel = {
  currency: string
  amount: number
  formatted?: string
  wallet_type?: 'ngn' | 'usd' | string
  label?: string
}

export type WalletTransaction = {
  id?: string | number
  reference?: string
  transfer_reference?: string
  status?: string
  lifecycle_state?: string
  display_message?: string
  amount?: number
  display_amount?: number
  display_total?: number
  transaction_type?: string
  type?: string
  description?: string
  payment_method?: string
  created_at?: string
  createdAt?: string
  address?: string
  wallet_type?: string
  wallet?: {
    wallet_type?: string
    walletType?: string
  }
  meta?: Record<string, unknown>
}

export type TransactionRecordDTO = {
  id?: string | number
  reference?: string
  status?: string
  lifecycle_state?: string
  display_message?: string
  amount?: number
  transaction_type?: string
  type?: string
  description?: string
  payment_method?: string
  created_at?: string
  meta?: Record<string, unknown>
}

export type ReceiptTimelineItem = {
  step_key?: string
  label?: string
  description?: string
  state?: string
  occurred_at?: string
  source?: string
  sequence?: number
}

export type ReceiptFee = {
  label?: string
  amount: number
  currency?: string
}

export type ReceiptDTO = {
  reference: string
  kind: string
  receipt_kind?: string
  event: string
  transaction_type?: string
  status: string
  amount: number
  fee?: number
  total_amount?: number
  currency: string
  fees?: ReceiptFee[]
  net_amount?: number
  occurred_at?: string
  created_at?: string
  recorded_at?: string
  title?: string
  subtitle?: string
  description?: string
  owner_type?: string
  owner_id?: string | number
  business_entity_id?: string | number
  circle_id?: string | number
  external_reference?: string
  session_id?: string
  parties?: Record<string, unknown>
  provider?: Record<string, unknown>
  metadata?: Record<string, unknown>
  meta?: Record<string, unknown>
  legacy?: unknown
  value_amount?: number
  wallet_amount_charged?: number
  reward_applied?: number
  total_display?: number
  commission_used?: number
  financials?: Record<string, unknown>
  service_details?: Record<string, unknown>
  beneficiary?: Record<string, unknown>
  reason?: string
  message?: string
  error?: string
  timeline?: ReceiptTimelineItem[]
}

export type WalletReceiptDTO = {
  reference: string
  amount: number
  currency: string
  status: string
  lifecycle_state?: string
  display_message?: string
  description?: string
  created_at?: string
  wallet_type?: string
  transaction_type?: string
  address?: string
  fees?: number
}
