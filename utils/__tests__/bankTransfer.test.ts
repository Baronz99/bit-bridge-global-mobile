import {
  computeDailyRemainingAfterTransfer,
  getTierDailyLimit,
  isTierEligibleForBankTransfer,
  normalizeTier,
  validateTransferAmount,
} from '@/utils/bankTransfer'

describe('bank transfer tier gating', () => {
  it('blocks tier 1 from bank transfer', () => {
    expect(isTierEligibleForBankTransfer(normalizeTier('tier_1'))).toBe(false)
  })

  it('allows tier 2 and uses 500,000 daily limit', () => {
    const tier = normalizeTier('tier_2')
    expect(isTierEligibleForBankTransfer(tier)).toBe(true)
    expect(getTierDailyLimit(tier)).toBe(500000)
  })

  it('allows tier 3 and uses 3,000,000 daily limit', () => {
    const tier = normalizeTier('tier_3')
    expect(isTierEligibleForBankTransfer(tier)).toBe(true)
    expect(getTierDailyLimit(tier)).toBe(3000000)
  })

  it('allows tier 4 and uses 3,000,000 daily limit', () => {
    const tier = normalizeTier('tier_4')
    expect(isTierEligibleForBankTransfer(tier)).toBe(true)
    expect(getTierDailyLimit(tier)).toBe(3000000)
  })
})

describe('bank transfer amount validation', () => {
  it('fails when total debit exceeds available balance', () => {
    const result = validateTransferAmount({
      amount: 1000,
      fee: 50,
      availableBalance: 1000,
      dailyLimitRemaining: 5000,
    })
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Insufficient')
  })

  it('fails when amount exceeds remaining daily limit', () => {
    const result = validateTransferAmount({
      amount: 6000,
      fee: 0,
      availableBalance: 10000,
      dailyLimitRemaining: 5000,
    })
    expect(result.valid).toBe(false)
    expect(result.message).toContain('daily transfer limit')
  })

  it('passes when amount is valid and computes total debit', () => {
    const result = validateTransferAmount({
      amount: 4500,
      fee: 25,
      availableBalance: 10000,
      dailyLimitRemaining: 5000,
    })
    expect(result.valid).toBe(true)
    expect(result.totalDebit).toBe(4525)
  })
})

describe('review totals', () => {
  it('computes daily remaining after transfer', () => {
    expect(
      computeDailyRemainingAfterTransfer({
        dailyLimitRemaining: 500000,
        totalDebit: 125000,
      })
    ).toBe(375000)
  })
})
