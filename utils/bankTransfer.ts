export type NormalizedTier = 'tier_0' | 'tier_1' | 'tier_2' | 'tier_3'

export const normalizeTier = (value: unknown): NormalizedTier => {
  const raw = String(value || 'tier_0').trim().toLowerCase()
  if (raw === 'tier2' || raw === 'tier_2') return 'tier_2'
  if (raw === 'tier3' || raw === 'tier_3') return 'tier_3'
  if (raw === 'tier_1' || raw === 'tier1') return 'tier_1'
  return 'tier_0'
}

export const getTierFromProfile = (profile: any): NormalizedTier => {
  const payload = profile?.data ?? profile ?? {}
  return normalizeTier(payload?.kyc_level || payload?.user_kyc?.kyc_level || 'tier_0')
}

export const getTierDailyLimit = (tier: NormalizedTier): number => {
  if (tier === 'tier_2') return 500000
  if (tier === 'tier_3') return 3000000
  return 0
}

export const isTierEligibleForBankTransfer = (tier: NormalizedTier): boolean =>
  tier === 'tier_2' || tier === 'tier_3'

export const BANK_TRANSFER_TIER_REQUIREMENT_COPY = 'Only Tier 2+ users can use bank transfers.'

export const clampMoney = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Number(value)) : 0

export const formatNaira = (value: number): string => {
  const safe = clampMoney(value)
  return `N${safe.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`
}

export const maskAccountNumber = (accountNumber: string): string => {
  const value = String(accountNumber || '').replace(/\D/g, '')
  if (!value) return ''
  return value.length <= 4 ? value : `******${value.slice(-4)}`
}

export const parseAmountInput = (raw: string): number => {
  const numeric = String(raw || '').replace(/[^0-9.]/g, '')
  const parsed = Number(numeric)
  return Number.isFinite(parsed) ? parsed : 0
}

export const formatAmountInput = (value: string): string => {
  const parsed = parseAmountInput(value)
  if (!parsed) return ''
  return parsed.toLocaleString('en-NG')
}

export const validateTransferAmount = ({
  amount,
  fee,
  availableBalance,
  dailyLimitRemaining,
  minAmount = 0,
}: {
  amount: number
  fee: number
  availableBalance: number
  dailyLimitRemaining: number
  minAmount?: number
}) => {
  const safeAmount = clampMoney(amount)
  const safeFee = clampMoney(fee)
  const safeBalance = clampMoney(availableBalance)
  const safeDailyRemaining = clampMoney(dailyLimitRemaining)
  const safeMinAmount = clampMoney(minAmount)
  const totalDebit = safeAmount + safeFee

  if (safeAmount <= 0) {
    return {
      valid: false,
      totalDebit,
      message: 'Enter an amount greater than 0.',
    }
  }
  if (safeMinAmount > 0 && safeAmount < safeMinAmount) {
    return {
      valid: false,
      totalDebit,
      message: `Minimum transfer amount is ${safeMinAmount.toLocaleString('en-NG')}.`,
    }
  }
  if (totalDebit > safeBalance) {
    return {
      valid: false,
      totalDebit,
      message: 'Insufficient available balance for this transfer.',
    }
  }
  if (safeAmount > safeDailyRemaining) {
    return {
      valid: false,
      totalDebit,
      message: 'Amount exceeds your remaining daily transfer limit.',
    }
  }
  return {
    valid: true,
    totalDebit,
    message: '',
  }
}

export const buildTransferReference = () => {
  const cryptoObj = (globalThis as any)?.crypto
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const rand = (Math.random() * 16) | 0
    const val = ch === 'x' ? rand : (rand & 0x3) | 0x8
    return val.toString(16)
  })
}

export const computeDailyRemainingAfterTransfer = ({
  dailyLimitRemaining,
  totalDebit,
}: {
  dailyLimitRemaining: number
  totalDebit: number
}) => clampMoney(dailyLimitRemaining - totalDebit)

export const isLikelyNetworkTimeout = (error: any) => {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()
  return (
    code.includes('timeout') ||
    code.includes('aborted') ||
    message.includes('timeout') ||
    message.includes('network request failed')
  )
}

export const buildPinLockoutMessage = ({
  baseMessage,
  attemptsRemaining,
  retryAfterSeconds,
}: {
  baseMessage: string
  attemptsRemaining?: number
  retryAfterSeconds?: number
}) => {
  let message = baseMessage
  if (typeof attemptsRemaining === 'number') {
    message = `${message} PIN attempts remaining: ${attemptsRemaining}.`
  }
  if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
    const mins = Math.ceil(retryAfterSeconds / 60)
    message = `${message} Try again in about ${mins} minute${mins > 1 ? 's' : ''}.`
  }
  return message
}
