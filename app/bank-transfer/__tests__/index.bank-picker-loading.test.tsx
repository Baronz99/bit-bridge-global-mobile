import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

const mockUseRouter = {
  push: jest.fn(),
  replace: jest.fn(),
}

const mockBankPickerSheet = jest.fn<(props: Record<string, unknown>) => null>(() => null)
const mockUnresolvedBanksPromise = new Promise(() => {})
const mockUnresolvedBeneficiariesPromise = new Promise(() => {})
const mockUnresolvedWalletPromise = new Promise(() => {})

jest.mock('expo-router', () => ({
  useRouter: () => mockUseRouter,
}))

jest.mock('@/components/notification', () => {
  return function NotificationAlert() {
    return null
  }
})

jest.mock('@/components/bankTransfer/SearchablePicker', () => {
  return function SearchablePicker() {
    return null
  }
})

jest.mock('@/components/bankTransfer/BankPickerSheet', () => {
  return function BankPickerSheet(props: Record<string, unknown>) {
    mockBankPickerSheet(props)
    return null
  }
})

jest.mock('@/components/bankTransfer/RecipientVerificationState', () => {
  return function RecipientVerificationState() {
    return null
  }
})

jest.mock('@/components/bankTransfer/TierGateCard', () => {
  return function TierGateCard() {
    return null
  }
})

jest.mock('@/components/TransactionPinModal', () => {
  return function TransactionPinModal() {
    return null
  }
})

jest.mock('@/components/bankTransfer/ReviewSummaryCard', () => {
  return function ReviewSummaryCard() {
    return null
  }
})

jest.mock('@/services/useAuth', () => ({
  useAuth: () => ({
    userProfileData: { wallet: { balance: 100000 } },
    loadProfile: jest.fn(() => Promise.resolve({ wallet: { balance: 100000 } })),
  }),
}))

jest.mock('@/services/useActiveAccount', () => ({
  useActiveAccount: () => ({
    activeAccount: { type: 'personal' },
  }),
}))

jest.mock('@/services/useFetch', () => ({
  invalidateFetchQueries: jest.fn(),
}))

jest.mock('@/services/useTransactionBiometrics', () => ({
  resolveTransactionBiometricUserId: () => 'user-1',
  useTransactionBiometrics: () => ({
    biometricLoading: false,
    biometricAvailable: false,
    biometricEnabled: false,
    maybeEnrollAfterPinSuccess: jest.fn(() => Promise.resolve()),
    getApprovalToken: jest.fn(),
  }),
}))

jest.mock('@/api/account', () => ({
  createCounterParty: jest.fn(),
  getBanks: jest.fn(() => mockUnresolvedBanksPromise),
  getBeneficiaries: jest.fn(() => mockUnresolvedBeneficiariesPromise),
  initiateFundTransfer: jest.fn(),
  resolveAccountName: jest.fn(),
}))

jest.mock('@/api/wallet', () => ({
  getWallet: jest.fn(() => mockUnresolvedWalletPromise),
}))

jest.mock('@/services/bankTransfer', () => ({
  getTransferQuoteSnapshot: jest.fn(() =>
    Promise.resolve({
      fee: 0,
      feeBreakdown: { platform_fee: 0, stamp_duty_fee: 0, total_fee: 0 },
      feeIsEstimate: false,
      dailyLimit: 500000,
      dailySpent: 0,
    })
  ),
}))

jest.mock('@/utils/apiErrorMessage', () => ({
  buildApiErrorMessage: jest.fn(() => 'Unable to load bank list right now.'),
}))

jest.mock('@/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
}))

jest.mock('@/utils/bankTransfer', () => ({
  BANK_TRANSFER_TIER_REQUIREMENT_COPY: 'Tier requirement copy',
  buildPinLockoutMessage: ({ baseMessage }: { baseMessage: string }) => baseMessage,
  buildTransferReference: () => 'transfer-ref-1',
  computeDailyRemainingAfterTransfer: () => 0,
  formatNaira: (value: number) => `NGN ${value}`,
  getTierDailyLimit: () => 500000,
  getTierFromProfile: () => 'tier_2',
  isLikelyNetworkTimeout: () => false,
  isTierEligibleForBankTransfer: () => true,
  parseAmountInput: () => 0,
  validateTransferAmount: () => ({
    valid: false,
    message: 'Enter amount in whole naira.',
    totalDebit: 0,
  }),
}))

jest.mock('@/utils/transferLifecycle', () => ({
  resolveTransferLifecycle: () => ({
    state: 'completed',
    isSuccess: true,
    isFailure: false,
    isTerminal: true,
    message: 'Completed',
  }),
}))

import BankTransferScreen from '@/app/bank-transfer/index'

describe('Bank transfer bank picker loading wiring', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockBankPickerSheet.mockClear()
    mockUseRouter.push.mockReset()
    mockUseRouter.replace.mockReset()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('passes banksLoading into BankPickerSheet while the bank request is still in flight', async () => {
    let tree: ReactTestRenderer | null = null

    act(() => {
      tree = create(<BankTransferScreen />)
    })

    expect(mockBankPickerSheet).toHaveBeenCalled()
    const firstCallProps = mockBankPickerSheet.mock.calls[0]?.[0]
    expect(firstCallProps.loading).toBe(true)

    act(() => {
      tree?.unmount()
    })
  })
})
