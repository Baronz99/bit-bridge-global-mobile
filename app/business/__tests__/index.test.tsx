import React from 'react'
import type { ReactNode } from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'

const mockReplace = jest.fn()
const mockSelectPersonalAccount = jest.fn(() => Promise.resolve())

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}))

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => undefined,
}))

jest.mock('@/services/useActiveAccount', () => ({
  useActiveAccount: () => ({
    activeAccount: { type: 'business', businessId: 'biz-1' },
    hydrated: true,
    selectBusinessAccount: jest.fn(),
    selectPersonalAccount: mockSelectPersonalAccount,
    selectCircleAccount: jest.fn(),
  }),
}))

jest.mock('@/api/business', () => ({
  createBusinessProvisioning: jest.fn(),
  getBusinessAccount: jest.fn(),
  getBusinessApprovalSummary: jest.fn(),
  getBusinessEntities: jest.fn(),
  getBusinessEntity: jest.fn(),
  getBusinessMemberships: jest.fn(),
  getBusinessOnboarding: jest.fn(),
  getBusinessTransactions: jest.fn(),
  getBusinessWallet: jest.fn(),
}))

jest.mock('@/api/circles', () => ({ listCircles: jest.fn() }))
jest.mock('@/utils/apiErrorMessage', () => ({ buildApiErrorMessage: () => 'error' }))
jest.mock('@/utils/logger', () => ({ log: jest.fn() }))
jest.mock('@/constants/icons', () => ({ icons: { appLogoClear: 1 } }))
jest.mock('@/utils/transferLifecycle', () => ({ resolveTransferLifecycle: () => ({ isFailure: false, isSuccess: true }) }))

jest.mock('@/components/workspace/WorkspaceSwitcherModal', () => {
  return function WorkspaceSwitcherModal() {
    return null
  }
})

jest.mock('@/components/ScreenContainer', () => {
  return function ScreenContainer({ children }: { children?: ReactNode }) {
    const ReactLocal = jest.requireActual<typeof import('react')>('react')
    return ReactLocal.createElement('screen-container', null, children)
  }
})

jest.mock('@/components/business/BusinessDashboard', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return {
    BusinessControlsCard: () => null,
    BusinessDashboardSkeleton: () => ReactLocal.createElement('business-dashboard-skeleton'),
    BusinessHeroCard: () => null,
    BusinessRecentActivity: () => null,
    BusinessSetupBanner: () => null,
  }
})

import BusinessIndexScreen from '@/app/business/index'

describe('BusinessIndexScreen', () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockSelectPersonalAccount.mockClear()
  })

  it('provides a deterministic exit back to personal home', async () => {
    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<BusinessIndexScreen />)
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Personal' })
    await act(async () => {
      await button.props.onPress()
    })

    expect(mockSelectPersonalAccount).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
  })
})
