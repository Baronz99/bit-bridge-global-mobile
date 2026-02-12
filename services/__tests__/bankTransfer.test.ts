import { listTimeline } from '@/api/timeline'
import {
  estimateTransferFee,
  getTodayTransferSpent,
  sumTodayTransferSpentFromTimeline,
} from '@/services/bankTransfer'

jest.mock('@/api/timeline', () => ({
  listTimeline: jest.fn(),
}))

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
          bank_code: '058',
          account_number: '1234567890',
          amount: 1000,
          fee: 50,
        },
      },
      {
        occurred_at: todayIso,
        kind: 'wallet_transaction',
        meta: {
          transaction_type: 'transfer',
          amount: 5000,
        },
      },
      {
        occurred_at: yesterday,
        kind: 'wallet_transaction',
        meta: {
          transaction_type: 'withdrawal',
          bank_code: '058',
          account_number: '1234567890',
          amount: 500,
          fee: 10,
        },
      },
    ]

    expect(sumTodayTransferSpentFromTimeline(records as any, now)).toBe(1050)
  })

  it('fetches timeline pages and computes today transfer spend', async () => {
    const todayIso = new Date().toISOString()

    mockedListTimeline
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              occurred_at: todayIso,
              kind: 'wallet_transaction',
              meta: {
                transaction_type: 'withdrawal',
                bank_code: '058',
                account_number: '1234567890',
                amount: 2000,
                fee: 100,
              },
            },
          ],
          next_cursor: 'next-page',
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              occurred_at: todayIso,
              kind: 'transfer_event',
              label: 'Bank transfer',
              meta: {
                direction: 'debit',
                transaction_type: 'transfer_out',
                bank_code: '044',
                amount: 500,
                fee: 25,
              },
            },
          ],
          next_cursor: null,
        },
      })

    const spent = await getTodayTransferSpent()
    expect(spent).toBe(2625)
    expect(mockedListTimeline).toHaveBeenCalledTimes(2)
  })

  it('keeps fee estimator deterministic', () => {
    expect(estimateTransferFee(0)).toBe(0)
    expect(estimateTransferFee(100000)).toBe(0)
  })
})
