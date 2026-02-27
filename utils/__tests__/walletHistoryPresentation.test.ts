import { formatWalletHistoryPresentation } from '@/utils/walletHistoryPresentation'

describe('walletHistoryPresentation', () => {
  it('formats transfer-out with counterparty and compact reference', () => {
    const result = formatWalletHistoryPresentation({
      transaction_type: 'withdrawal',
      description: 'Inter bank transfer',
      beneficiary_name: 'Jane Doe',
      bank_name: 'GTBank',
      account_number: '0123456789',
      reference: 'wallet-tx-1234567890abcdef',
    })

    expect(result.title).toBe('Bank transfer out')
    expect(result.subtitle).toContain('To Jane Doe')
    expect(result.subtitle).toContain('GTBank')
    expect(result.subtitle).toContain('****6789')
    expect(result.subtitle).toContain('Ref')
  })

  it('formats deposit with readable fallback title', () => {
    const result = formatWalletHistoryPresentation({
      transaction_type: 'deposit',
      display_message: 'Wallet funded successfully',
      reference: 'bbg-12345',
    })

    expect(result.title).toBe('Wallet credit')
    expect(result.subtitle).toContain('From Wallet funded successfully')
  })

  it('falls back gracefully when reference is missing', () => {
    const result = formatWalletHistoryPresentation({
      transaction_type: 'withdrawal',
    })

    expect(result.title).toBe('Wallet debit')
    expect(result.subtitle).toBe('Reference pending')
  })

  it('formats transfer reversal clearly', () => {
    const result = formatWalletHistoryPresentation({
      transaction_type: 'withdrawal',
      lifecycle_state: 'failed_refunded',
      display_message: 'Transfer failed. Funds returned.',
      reference: 'trf-8899011',
    })

    expect(result.title).toBe('Transfer reversal')
    expect(result.subtitle).toContain('Ref trf-8899011')
  })

  it('classifies bill purchase labels', () => {
    const result = formatWalletHistoryPresentation({
      transaction_type: 'withdrawal',
      description: 'Electricity bill payment',
      reference: 'bill-332211',
    })

    expect(result.title).toBe('Bill payment')
    expect(result.subtitle).toContain('Ref bill-332211')
  })
})
