import { getAnchorNextStep, normalizeAnchorOnboarding } from '../useAnchorOnboarding'

describe('normalizeAnchorOnboarding', () => {
  it('maps completed/verified status to verified', () => {
    const completed = normalizeAnchorOnboarding({
      data: { status: 'completed' },
      has_anchor_account: true,
    })
    expect(completed.kycState).toBe('verified')

    const verified = normalizeAnchorOnboarding({
      data: { attributes: { status: 'verified' } },
      has_anchor_account: true,
    })
    expect(verified.kycState).toBe('verified')
  })

  it('prefers account number from account detail response', () => {
    const result = normalizeAnchorOnboarding({
      data: { accountNumber: '1234567890', status: 'verified' },
      has_anchor_account: true,
    })
    expect(result.accountNumber).toBe('1234567890')
    expect(result.hasAccountNumber).toBe(true)
  })

  it('falls back to user_accounts for account number', () => {
    const result = normalizeAnchorOnboarding(
      { data: null, has_anchor_account: false },
      { data: [{ vendor: 'anchor', account_number: '2223334445' }] }
    )
    expect(result.accountNumber).toBe('2223334445')
    expect(result.hasAccountNumber).toBe(true)
    expect(result.hasAnchorAccount).toBe(true)
  })

  it('computes nextStep correctly across states', () => {
    const missing = normalizeAnchorOnboarding({ data: null, has_anchor_account: false })
    expect(getAnchorNextStep(missing)).toBe('CREATE_ANCHOR')

    const pending = normalizeAnchorOnboarding({
      data: { status: 'pending' },
      has_anchor_account: true,
    })
    expect(getAnchorNextStep(pending)).toBe('DO_KYC')

    const verifiedNoNumber = normalizeAnchorOnboarding({
      data: { status: 'verified' },
      has_anchor_account: true,
    })
    expect(getAnchorNextStep(verifiedNoNumber)).toBe('GENERATE_NUMBER')

    const done = normalizeAnchorOnboarding({
      data: { status: 'verified', account_number: '999' },
      has_anchor_account: true,
    })
    expect(getAnchorNextStep(done)).toBe('DONE')
  })

  it('marks depositReady only when verified and account number exists', () => {
    const ready = normalizeAnchorOnboarding({
      data: { status: 'verified', account_number: '1112223334' },
      has_anchor_account: true,
    })
    expect(ready.depositReady).toBe(true)

    const statusPendingNumber = normalizeAnchorOnboarding({
      data: { status: 'pending', account_number: '1112223334' },
      has_anchor_account: true,
    })
    expect(statusPendingNumber.depositReady).toBe(true)
  })
})
