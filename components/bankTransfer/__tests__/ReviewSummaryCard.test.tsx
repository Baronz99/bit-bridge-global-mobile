import React from 'react'
import { act, create } from 'react-test-renderer'
import ReviewSummaryCard from '@/components/bankTransfer/ReviewSummaryCard'

describe('ReviewSummaryCard', () => {
  it('renders amount, fee, and total debit values', async () => {
    let tree: any = null

    await act(async () => {
      tree = create(
        <ReviewSummaryCard
          recipientName="Jane Doe"
          bankName="Test Bank"
          accountNumber="1234567890"
          amount={1000}
          fee={50}
          totalDebit={1050}
          description="Rent"
          dailyRemainingAfter={499000}
        />
      )
    })

    const text = JSON.stringify(tree.toJSON())
    expect(text).toContain('Amount')
    expect(text).toContain('Fee')
    expect(text).toContain('Total Debit')
    expect(text).toContain('N1,050')
  })
})
