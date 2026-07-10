import React from 'react'
import type { ReactNode } from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'
import { createCircle, listCircles } from '@/api/circles'

const mockReplace = jest.fn()
const mockSelectPersonalAccount = jest.fn(() => Promise.resolve())
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}))

jest.mock('@/services/useActiveAccount', () => ({
  useActiveAccount: () => ({
    selectPersonalAccount: mockSelectPersonalAccount,
  }),
}))

jest.mock('@/services/useAuth', () => ({
  useAuth: () => ({
    userProfileData: { kyc_level: 'tier_2', phone_verified: true },
    loadProfile: jest.fn(() => Promise.resolve()),
    authState: { authenticated: false },
    authHydrated: true,
  }),
}))

jest.mock('@/constants/featureFlags', () => ({ FEATURE_CIRCLES: true }))
jest.mock('@/api/circles', () => ({ createCircle: jest.fn(), listCircles: jest.fn() }))
jest.mock('@/components/modal/Modal', () => {
  return function Modal({ open, children }: { open?: boolean; children?: ReactNode }) {
    const ReactLocal = jest.requireActual<typeof import('react')>('react')
    return open ? ReactLocal.createElement('modal-mock', null, children) : null
  }
})
jest.mock('@/components/ScreenContainer', () => {
  return function ScreenContainer({ children }: { children?: ReactNode }) {
    const ReactLocal = jest.requireActual<typeof import('react')>('react')
    return ReactLocal.createElement('screen-container', null, children)
  }
})
jest.mock('@/components/FormInput', () => {
  return function FormInput() {
    return null
  }
})
jest.mock('@/components/circles/MemberAvatars', () => {
  return function MemberAvatars() {
    return null
  }
})
jest.mock('@/utils/circleTypeConfig', () => ({
  CIRCLE_TYPE_CONFIG: { associations: { key: 'associations', label: 'Associations', subtitle: 'subtitle', createDescription: 'desc', shortLabel: 'Assoc' } },
  LAUNCH_CIRCLE_TYPES: ['associations'],
  getCircleTypeConfig: () => ({ label: 'Associations', shortLabel: 'Assoc' }),
}))
jest.mock('@/utils/moneyFormat', () => ({ __esModule: true, default: () => 'NGN 0.00' }))

import CirclesScreen from '@/app/circles/index'

describe('CirclesScreen', () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockPush.mockReset()
    mockSelectPersonalAccount.mockClear()
    ;(listCircles as jest.Mock).mockResolvedValue([])
    ;(createCircle as jest.Mock).mockReset()
  })

  it('provides a deterministic exit back to personal home', async () => {
    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<CirclesScreen />)
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Home' })
    await act(async () => {
      await button.props.onPress()
    })

    expect(mockSelectPersonalAccount).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
  })

  it('provides visible exits for the create circle modal', async () => {
    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<CirclesScreen />)
    })

    const [openButton] = tree!.root.findAllByProps({ accessibilityLabel: 'Open create circle' })
    await act(async () => {
      openButton.props.onPress()
    })

    expect(tree!.root.findByProps({ accessibilityLabel: 'Close create circle' })).toBeTruthy()
    expect(tree!.root.findByProps({ accessibilityLabel: 'Cancel create circle' })).toBeTruthy()

    const closeButton = tree!.root.findByProps({ accessibilityLabel: 'Cancel create circle' })
    await act(async () => {
      closeButton.props.onPress()
    })

    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Cancel create circle' })).toHaveLength(0)
  })
})
