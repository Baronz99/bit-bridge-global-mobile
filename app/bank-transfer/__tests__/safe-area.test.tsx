import React from 'react'
import type { ReactNode } from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'

const mockUseLocalSearchParams = jest.fn()
const mockReplace = jest.fn()
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}))

jest.mock('@/components/ScreenContainer', () => {
  return function ScreenContainer(props: Record<string, unknown>) {
    const ReactLocal = jest.requireActual<typeof import('react')>('react')
    return ReactLocal.createElement('screen-container', props, props.children as ReactNode)
  }
})

jest.mock('@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper', () => {
  return function KeyboardAvoidWrapper({ children }: { children?: ReactNode }) {
    return children
  }
})

jest.mock('@/components/Loader', () => {
  return function Loader() {
    return null
  }
})

jest.mock('@/components/notification', () => {
  return function NotificationAlert() {
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

jest.mock('@/components/finance/CompletionPanel', () => {
  return function CompletionPanel() {
    return null
  }
})

jest.mock('@/services/useAuth', () => ({
  useAuth: () => ({
    userProfileData: { email: 'user@example.com' },
    loadProfile: jest.fn(() => Promise.resolve({})),
  }),
}))

jest.mock('@/services/useTransactionBiometrics', () => ({
  resolveTransactionBiometricUserId: () => 'user-1',
  useTransactionBiometrics: () => ({
    biometricLoading: false,
    biometricAvailable: false,
    biometricEnabled: false,
    getApprovalToken: jest.fn(),
    enablePreparedEnrollment: jest.fn(),
    skipPreparedEnrollment: jest.fn(),
  }),
  getTransferBiometricFailureMessage: () => 'Biometric error',
}))

jest.mock('@/api/account', () => ({
  createCounterParty: jest.fn(),
  initiateFundTransfer: jest.fn(),
  resolveAccountName: jest.fn(),
}))

jest.mock('@/utils/bankTransfer', () => ({
  formatNaira: (value: number) => `NGN ${value}`,
  maskAccountNumber: (value: string) => value,
  BANK_TRANSFER_TIER_REQUIREMENT_COPY: 'Tier copy',
  buildPinLockoutMessage: ({ baseMessage }: { baseMessage: string }) => baseMessage,
  buildTransferReference: () => 'ref-1',
  computeDailyRemainingAfterTransfer: () => 0,
  getTierFromProfile: () => 'tier_2',
  isLikelyNetworkTimeout: () => false,
  isTierEligibleForBankTransfer: () => true,
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

import ReviewTransferScreen from '@/app/bank-transfer/review'
import SuccessScreen from '@/app/bank-transfer/success'

describe('Bank transfer safe area hardening', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReset()
    mockReplace.mockReset()
    mockPush.mockReset()
  })

  it('keeps review on a native-header layout without a duplicate top inset', async () => {
    mockUseLocalSearchParams.mockReturnValue({ draft: undefined })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<ReviewTransferScreen />)
    })

    const container = tree!.root.findAll((node) => String(node.type) === 'screen-container')[0]
    expect(container.props.includeTopInset).toBe(false)
    expect(container.props.includeTabBarPadding).toBe(false)
    expect(container.props.bottomPadding).toBe(16)
    expect(tree!.root.findByProps({ children: 'Back to transfer' })).toBeTruthy()
  })

  it('keeps success on a native-header layout without a duplicate top inset', async () => {
    mockUseLocalSearchParams.mockReturnValue({ summary: undefined })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<SuccessScreen />)
    })

    const container = tree!.root.findAll((node) => String(node.type) === 'screen-container')[0]
    expect(container.props.includeTopInset).toBe(false)
    expect(container.props.includeTabBarPadding).toBe(false)
    expect(container.props.bottomPadding).toBe(16)
  })
})
