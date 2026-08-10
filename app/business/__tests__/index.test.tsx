import React from 'react'
import type { ReactNode } from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'

const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockSelectPersonalAccount = jest.fn(() => Promise.resolve())
const mockGetBusinessEntities = jest.fn()
const mockGetBusinessEntity = jest.fn()
const mockGetBusinessOnboarding = jest.fn()
const mockGetBusinessWallet = jest.fn()
const mockGetBusinessAccount = jest.fn()
const mockGetBusinessApprovalSummary = jest.fn()
const mockGetBusinessMemberships = jest.fn()
const mockGetBusinessTransactions = jest.fn()
const mockListCircles = jest.fn()
let focusEffect: (() => void) | null = null

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}))

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => { focusEffect = effect },
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
  getBusinessAccount: (...args: unknown[]) => mockGetBusinessAccount(...args),
  getBusinessApprovalSummary: (...args: unknown[]) => mockGetBusinessApprovalSummary(...args),
  getBusinessEntities: (...args: unknown[]) => mockGetBusinessEntities(...args),
  getBusinessEntity: (...args: unknown[]) => mockGetBusinessEntity(...args),
  getBusinessMemberships: (...args: unknown[]) => mockGetBusinessMemberships(...args),
  getBusinessOnboarding: (...args: unknown[]) => mockGetBusinessOnboarding(...args),
  getBusinessTransactions: (...args: unknown[]) => mockGetBusinessTransactions(...args),
  getBusinessWallet: (...args: unknown[]) => mockGetBusinessWallet(...args),
}))

jest.mock('@/api/circles', () => ({ listCircles: (...args: unknown[]) => mockListCircles(...args) }))
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
    BusinessSetupBanner: ({ stage, title, body, ctaLabel, onPress }: { stage: string; title: string; body: string; ctaLabel: string; onPress: () => void }) =>
      ReactLocal.createElement('business-setup-banner', { onPress }, stage, title, body, ctaLabel),
  }
})

import BusinessIndexScreen from '@/app/business/index'

describe('BusinessIndexScreen', () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockPush.mockReset()
    mockSelectPersonalAccount.mockClear()
    focusEffect = null
    mockGetBusinessEntities.mockResolvedValue({ data: { data: [{ id: 'biz-1', name: 'Test business', status: 'profile_submitted', current_user_role: 'owner' }] } })
    mockGetBusinessEntity.mockResolvedValue({ data: { data: { id: 'biz-1', status: 'profile_submitted' } } })
    mockGetBusinessOnboarding.mockResolvedValue({ data: { data: { readiness: { missing_profile_fields: [], missing_signatory_requirements: [] }, journey: { stage: 'ready_for_verification', can_submit_kyb: true, next_action: 'submit_for_verification', next_route: '/business/kyb' } } } })
    mockGetBusinessWallet.mockResolvedValue({ data: { data: {} } })
    mockGetBusinessAccount.mockResolvedValue({ data: { data: {} } })
    mockGetBusinessApprovalSummary.mockResolvedValue({ data: { data: {} } })
    mockGetBusinessMemberships.mockResolvedValue({ data: { data: [] } })
    mockGetBusinessTransactions.mockResolvedValue({ data: { data: [] } })
    mockListCircles.mockResolvedValue({ data: { data: [] } })
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

  it('uses the Journey verification state and route after setup is complete', async () => {
    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<BusinessIndexScreen />)
    })
    await act(async () => { await focusEffect?.() })

    const banner = tree!.root.findByType('business-setup-banner' as any)
    expect(banner.children).toContain('Business verification')
    expect(banner.children).toContain('Ready to begin')
    expect(banner.children).toContain('Start verification')
    expect(banner.children).not.toContain('Documents needed')

    await act(async () => { banner.props.onPress() })
    expect(mockPush).toHaveBeenCalledWith('/business/kyb')
  })
})
