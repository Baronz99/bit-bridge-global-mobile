import {
  extractAccountNumber,
  getVirtualAccountPendingMessage,
  hasDepositAccountNumber,
  hasPersistedAccountNumber,
  isKycAlreadyCompleted,
} from '../anchorAccount'

describe('extractAccountNumber', () => {
  it('pulls account_number from data wrapper', () => {
    expect(extractAccountNumber({ data: { account_number: '123' } })).toBe('123')
  })

  it('returns empty string when missing', () => {
    expect(extractAccountNumber({ data: {} })).toBe('')
    expect(extractAccountNumber(null as any)).toBe('')
  })
})

describe('hasPersistedAccountNumber', () => {
  it('returns true when create and refresh both have account_number', () => {
    const create = { data: { account_number: '123' } }
    const refresh = { data: { account_number: '123' } }
    expect(hasPersistedAccountNumber(create, refresh)).toBe(true)
  })

  it('returns false when create response is missing account_number', () => {
    const create = { data: {} }
    const refresh = { data: { account_number: '123' } }
    expect(hasPersistedAccountNumber(create, refresh)).toBe(false)
  })

  it('returns false when refresh response is missing account_number', () => {
    const create = { data: { account_number: '123' } }
    const refresh = { data: {} }
    expect(hasPersistedAccountNumber(create, refresh)).toBe(false)
  })
})

describe('hasDepositAccountNumber', () => {
  it('returns true when status data has account_number', () => {
    const status = { data: { account_number: '123' } }
    expect(hasDepositAccountNumber(status)).toBe(true)
  })

  it('returns false when data missing', () => {
    expect(hasDepositAccountNumber({ data: {} })).toBe(false)
    expect(hasDepositAccountNumber(null as any)).toBe(false)
  })
})

describe('isKycAlreadyCompleted', () => {
  it('returns true for 422 kyc already completed message', () => {
    const err = { response: { status: 422, data: { message: 'Kyc already completed' } } }
    expect(isKycAlreadyCompleted(err)).toBe(true)
  })

  it('returns false for other messages', () => {
    const err = { response: { status: 422, data: { message: 'missing fields' } } }
    expect(isKycAlreadyCompleted(err)).toBe(false)
  })
})

describe('getVirtualAccountPendingMessage', () => {
  it('returns pending message when account exists, kyc done, and no account number', () => {
    expect(getVirtualAccountPendingMessage(true, true, '')).toMatch(/being set up/i)
  })

  it('returns null otherwise', () => {
    expect(getVirtualAccountPendingMessage(false, true, '')).toBeNull()
    expect(getVirtualAccountPendingMessage(true, false, '')).toBeNull()
    expect(getVirtualAccountPendingMessage(true, true, '123')).toBeNull()
  })
})
