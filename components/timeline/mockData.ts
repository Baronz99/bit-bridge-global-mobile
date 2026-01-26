export type TimelineItem = {
  id: string
  kind: string
  label: string
  amount_cents?: number | null
  status?: string | null
  occurred_at?: string | null
  actor?: { id?: string; name?: string }
  meta?: Record<string, unknown>
}

const now = new Date()
const iso = (date: Date) => date.toISOString()
const minutesAgo = (mins: number) => iso(new Date(now.getTime() - mins * 60 * 1000))
const daysAgo = (days: number) => iso(new Date(now.getTime() - days * 24 * 60 * 60 * 1000))

export const MOCK_TIMELINE: TimelineItem[] = [
  {
    id: 'wallet-1',
    kind: 'wallet_transaction',
    label: 'Funding from Main Wallet',
    amount_cents: 1500000,
    status: 'approved',
    occurred_at: minutesAgo(18),
    actor: { name: 'You' },
    meta: {
      transaction_type: 'deposit',
      wallet_type: 'ngn',
      currency: 'NGN',
      reference: 'BB-TRX-98214321',
      visibility: 'Private',
    },
  },
  {
    id: 'circle-1',
    kind: 'circle_transaction',
    label: 'Amina funded Moscow Club Circle',
    amount_cents: 250000,
    status: 'approved',
    occurred_at: minutesAgo(42),
    actor: { name: 'Amina' },
    meta: {
      circle_id: 'circle-23',
      circle_name: 'Moscow Club Circle',
      activity_name: 'Contribution',
      reference: 'CIR-2241',
      visibility: 'Circle',
    },
  },
  {
    id: 'card-1',
    kind: 'card_event',
    label: 'Card charge • Netflix',
    amount_cents: 1299,
    status: 'successful',
    occurred_at: minutesAgo(68),
    actor: { name: 'You' },
    meta: {
      currency: 'USD',
      card_last4: '4412',
      reference: 'CARD-8821',
      visibility: 'Private',
    },
  },
  {
    id: 'bill-1',
    kind: 'bill_order',
    label: 'DSTV Subscription',
    amount_cents: 130000,
    status: 'completed',
    occurred_at: minutesAgo(110),
    actor: { name: 'You' },
    meta: {
      service_type: 'TV',
      biller: 'DSTV Subscription',
      payment_method: 'wallet',
      reference: 'BILL-0021',
      visibility: 'Private',
    },
  },
  {
    id: 'social-1',
    kind: 'social_notification',
    label: 'Circle payout approved',
    amount_cents: 180000,
    status: 'approved',
    occurred_at: minutesAgo(160),
    actor: { name: 'Moscow Club Circle' },
    meta: {
      circle_name: 'Moscow Club Circle',
      visibility: 'Circle',
    },
  },
  {
    id: 'social-2',
    kind: 'social_notification',
    label: 'Reaction received on your payout 🎉',
    status: 'info',
    occurred_at: minutesAgo(210),
    actor: { name: 'Circle members' },
    meta: {
      circle_name: 'Moscow Club Circle',
      visibility: 'Circle',
    },
  },
  {
    id: 'wallet-2',
    kind: 'wallet_transaction',
    label: 'Transfer to Zenith Bank',
    amount_cents: 800000,
    status: 'pending',
    occurred_at: daysAgo(1),
    actor: { name: 'You' },
    meta: {
      transaction_type: 'withdrawal',
      wallet_type: 'ngn',
      bank: 'Zenith Bank',
      reference: 'BB-TRX-3412',
      visibility: 'Private',
    },
  },
  {
    id: 'circle-2',
    kind: 'circle_transaction',
    label: 'Circle payout to main wallet',
    amount_cents: 120000,
    status: 'approved',
    occurred_at: daysAgo(1),
    actor: { name: 'Moscow Club Circle' },
    meta: {
      circle_name: 'Moscow Club Circle',
      activity_name: 'Payout',
      reference: 'CIR-1188',
      visibility: 'Circle',
    },
  },
  {
    id: 'bill-2',
    kind: 'bill_order',
    label: 'Airtime top up',
    amount_cents: 5000,
    status: 'completed',
    occurred_at: daysAgo(2),
    actor: { name: 'You' },
    meta: {
      service_type: 'VTU',
      biller: 'Airtime',
      reference: 'BILL-7792',
      visibility: 'Private',
    },
  },
  {
    id: 'social-3',
    kind: 'social_notification',
    label: 'You were added to Family Group',
    status: 'info',
    occurred_at: daysAgo(3),
    actor: { name: 'Family Group' },
    meta: {
      circle_name: 'Family Group',
      visibility: 'Family',
    },
  },
  {
    id: 'wallet-3',
    kind: 'wallet_transaction',
    label: 'Workplace salary credited',
    amount_cents: 5200000,
    status: 'approved',
    occurred_at: daysAgo(6),
    actor: { name: 'Workplace Payroll' },
    meta: {
      transaction_type: 'deposit',
      wallet_type: 'ngn',
      reference: 'PAY-4501',
      visibility: 'Workplace',
    },
  },
  {
    id: 'dispute-1',
    kind: 'social_notification',
    label: 'Dispute resolved',
    status: 'resolved',
    occurred_at: daysAgo(9),
    actor: { name: 'BitBridge' },
    meta: {
      reference: 'DSP-9921',
      visibility: 'Private',
    },
  },
]
