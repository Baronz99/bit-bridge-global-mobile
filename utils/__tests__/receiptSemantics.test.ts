import { resolveReceiptSemantics } from '../receiptSemantics'

describe('resolveReceiptSemantics', () => {
  it('renders transfer receipts only from canonical transfer kind', () => {
    const semantics = resolveReceiptSemantics({
      reference: 'BBG-123',
      kind: 'wallet',
      receipt_kind: 'transfer',
      transaction_type: 'withdrawal',
      event: 'anchor.transfer.create',
      status: 'pending',
      amount: 5000,
      currency: 'NGN',
    } as any)

    expect(semantics.headerTitle).toBe('Transfer receipt')
    expect(semantics.showBeneficiary).toBe(true)
    expect(semantics.showServiceDetails).toBe(false)
  })

  it('renders electricity receipt only for canonical electricity kind', () => {
    const semantics = resolveReceiptSemantics({
      reference: 'bill-1',
      kind: 'bill',
      receipt_kind: 'electricity',
      transaction_type: 'ELECTRICITY',
      event: 'ELECTRICITY',
      status: 'completed',
      amount: 3000,
      currency: 'NGN',
    } as any)

    expect(semantics.headerTitle).toBe('Electricity receipt')
    expect(semantics.showServiceDetails).toBe(true)
  })

  it('does not downgrade an unknown receipt with bill-like fields into electricity', () => {
    const semantics = resolveReceiptSemantics({
      reference: 'mystery-1',
      kind: 'checkout',
      receipt_kind: 'transaction',
      transaction_type: 'anchor.transfer.create',
      event: 'anchor.transfer.create',
      status: 'pending',
      amount: 3000,
      currency: 'NGN',
      service_details: {
        token: '12345678901234567890',
        meter_number: '1234567890',
      },
    } as any)

    expect(semantics.headerTitle).toBe('Transaction receipt')
    expect(semantics.showServiceDetails).toBe(false)
  })

  it('keeps generic bill receipts separate from electricity receipts', () => {
    const semantics = resolveReceiptSemantics({
      reference: 'bill-2',
      kind: 'bill',
      receipt_kind: 'bill',
      transaction_type: 'DATA',
      event: 'DATA',
      status: 'completed',
      amount: 1500,
      currency: 'NGN',
    } as any)

    expect(semantics.headerTitle).toBe('Bill payment receipt')
    expect(semantics.showServiceDetails).toBe(true)
  })
})
