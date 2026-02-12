import { getTransferQuote } from '@/api/account'
import { listTimeline } from '@/api/timeline'
import {
  estimateTransferFee,
  getTodayTransferSpent,
  getTransferQuoteSnapshot,
  sumTodayTransferSpentFromTimeline,
} from '@/services/bankTransfer'

jest.mock('@/api/account', () => ({
  getTransferQuote: jest.fn(),
}))

jest.mock('@/api/timeline', () => ({
  listTimeline: jest.fn(),
}))

const mockedGetTransferQuote = getTransferQuote as jest.Mock
const mockedListTimeline = listTimeline as jest.Mock

describe('bankTransfer service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sums only today NGN bank transfer debits including fee', () => {
    const now = new Date()
    const todayIso = now.toISOString()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const records = [
      {
        occurred_at: todayIso,
        kind: 'wallet_transaction',
        meta: {
          transaction_type: 'withdrawal',
          provider: 'anchor',
          subtype: 'principal',
          bank_code: '058',
          amount: 1000,
        },
      },
      {
        occurred_at: todayIso,
        kind: 'wallet_transaction',
        meta: {
          transaction_type: 'withdrawal',
          provider: 'anchor',
          subtype: 'fee',
          amount: 50,
        },
      },
      {
        occurred_at: yesterday,
        kind: 'wallet_transaction',
        meta: {
          transaction_type: 'withdrawal',
          provider: 'anchor',
          subtype: 'principal',
          amount: 500,
        },
      },
    ]

    expect(sumTodayTransferSpentFromTimeline(records as any, now)).toBe(1050)
  })

  it('uses backend transfer quote snapshot when available', async () => {
    mockedGetTransferQuote.mockResolvedValueOnce({
      daily_limit: 500000,
      daily_spent: 12345,
      daily_remaining: 487655,
      fee: 76.8,
      total_debit: 10076.8,
      fee_is_estimate: false,
      fee_breakdown: { total_fee: 76.8, platform_fee: 76.8, stamp_duty_fee: 0 },
      business_timezone: 'Africa/Lagos',
    })

    const snapshot = await getTransferQuoteSnapshot(10000)
    expect(snapshot.source).toBe('quote')
    expect(snapshot.fee).toBe(76.8)
    expect(snapshot.dailySpent).toBe(12345)
    expect(mockedGetTransferQuote).toHaveBeenCalledWith(10000)
  })

  it('falls back to timeline summation when quote endpoint fails', async () => {
    const todayIso = new Date().toISOString()
    mockedGetTransferQuote.mockRejectedValueOnce(new Error('quote failed'))
    mockedListTimeline.mockResolvedValueOnce({
      data: {
        items: [
          {
            occurred_at: todayIso,
            kind: 'wallet_transaction',
            meta: {
              transaction_type: 'withdrawal',
              provider: 'anchor',
              subtype: 'principal',
              amount: 2000,
            },
          },
          {
            occurred_at: todayIso,
            kind: 'wallet_transaction',
            meta: {
              transaction_type: 'withdrawal',
              provider: 'anchor',
              subtype: 'fee',
              amount: 100,
            },
          },
        ],
        next_cursor: null,
      },
    })

    const snapshot = await getTransferQuoteSnapshot(10000)
    expect(snapshot.source).toBe('fallback')
    expect(snapshot.dailySpent).toBe(2100)
    expect(snapshot.fee).toBe(126.8)
  })

  it('gets today spent through quote endpoint by default', async () => {
    mockedGetTransferQuote.mockResolvedValueOnce({
      daily_spent: 7788,
      daily_limit: 500000,
      daily_remaining: 492212,
      fee: 55,
      total_debit: 205,
      fee_is_estimate: false,
    })
    const spent = await getTodayTransferSpent()
    expect(spent).toBe(7788)
  })

  it('matches backend fee tiers', () => {
    expect(estimateTransferFee(150)).toBe(55)
    expect(estimateTransferFee(5000)).toBe(76.8)
    expect(estimateTransferFee(25000)).toBe(126.8)
    expect(estimateTransferFee(100000)).toBe(150)
  })
})
