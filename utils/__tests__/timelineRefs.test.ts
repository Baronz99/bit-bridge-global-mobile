import { decideHomeNavigation, extractReceiptReference, isWalletTimelineId } from '../timelineRefs'

describe('extractReceiptReference', () => {
  it('prefers transaction_record_reference over other refs', () => {
    const ref = extractReceiptReference({
      reference: 'trx-fallback',
      meta: { transaction_record_reference: 'bbg-12345', reference: 'txn-999' },
    })
    expect(ref).toBe('bbg-12345')
  })

  it('accepts wallet-tx-* when backend receipts support it', () => {
    const ref = extractReceiptReference({ id: 'wallet-tx-abc123', meta: {} })
    expect(ref).toBe('wallet-tx-abc123')
    expect(isWalletTimelineId(ref)).toBe(true)
  })

  it('handles bill and card event ids', () => {
    expect(extractReceiptReference({ reference: 'bill-99' })).toBe('bill-99')
    expect(extractReceiptReference({ id: 'card-evt-555' })).toBe('card-evt-555')
  })
})

describe('decideHomeNavigation', () => {
  it('routes wallet transactions to receipt flow, not timeline detail', () => {
    const decision = decideHomeNavigation({ id: 'wallet-tx-deadbeef' })
    expect(decision).toEqual({ type: 'receipt', reference: 'wallet-tx-deadbeef' })
  })

  it('routes social items to timeline detail', () => {
    const decision = decideHomeNavigation({ id: 'circle-tx-777' })
    expect(decision).toEqual({ type: 'timeline-detail', id: 'circle-tx-777' })
  })
})
