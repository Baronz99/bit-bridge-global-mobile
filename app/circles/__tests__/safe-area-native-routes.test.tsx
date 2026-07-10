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

jest.mock('@/components/FormInput', () => {
  return function FormInput() {
    return null
  }
})

jest.mock('@/components/FormSelect', () => {
  return function FormSelect() {
    return null
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

jest.mock('@/services/useAuth', () => ({
  useAuth: () => ({
    userProfileData: { email: 'user@example.com' },
    loadProfile: jest.fn(() => Promise.resolve({})),
  }),
}))

jest.mock('@/services/useAnchorOnboarding', () => ({
  useAnchorOnboarding: () => ({
    isHydrated: true,
    loading: false,
    depositReady: false,
  }),
}))

jest.mock('@/api/funding', () => ({
  createFundingIntent: jest.fn(),
  getFundingIntent: jest.fn(),
}))

jest.mock('@/api/transactions', () => ({
  initiateMonnifyTransaction: jest.fn(),
}))

jest.mock('@/api/transactionPin', () => ({
  getTransactionPinStatus: jest.fn(),
}))

import FundWalletScreen from '@/app/fundWallet/index'
import WithdrawFundScreen from '@/app/withdrawFund/index'

describe('Native-header wallet route safe area hardening', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReset()
    mockReplace.mockReset()
    mockPush.mockReset()
    mockUseLocalSearchParams.mockReturnValue({})
  })

  it('keeps fund wallet on bottom-protected layout without a duplicate top inset', async () => {
    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<FundWalletScreen />)
    })

    const container = tree!.root.findAll((node) => String(node.type) === 'screen-container')[0]
    expect(container.props.includeTopInset).toBe(false)
    expect(container.props.includeTabBarPadding).toBe(false)
    expect(container.props.bottomPadding).toBe(16)
  })

  it('keeps withdraw fund on bottom-protected layout without a duplicate top inset', async () => {
    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<WithdrawFundScreen />)
    })

    const container = tree!.root.findAll((node) => String(node.type) === 'screen-container')[0]
    expect(container.props.includeTopInset).toBe(false)
    expect(container.props.includeTabBarPadding).toBe(false)
    expect(container.props.bottomPadding).toBe(16)
  })
})
