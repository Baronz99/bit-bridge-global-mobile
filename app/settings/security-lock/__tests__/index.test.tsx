import React from 'react'
import { act, create } from 'react-test-renderer'

import SecurityLockScreen from '@/app/settings/security-lock/index'

const mockGetSecurityLock = jest.fn()
const mockLoadProfile = jest.fn()
const mockSetSecurityLockState = jest.fn()
const mockUserProfileData = {
  security_lock: {
    active: false,
  },
}

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}))

jest.mock('@/components/ScreenContainer', () => {
  return function MockScreenContainer({ children }: any) {
    return children
  }
})

jest.mock('@/components/TransactionPinModal', () => {
  return function MockTransactionPinModal() {
    return null
  }
})

jest.mock('@/api/securityLock', () => ({
  getSecurityLock: (...args: any[]) => mockGetSecurityLock(...args),
  activateSecurityLock: jest.fn(),
}))

jest.mock('@/services/useAuth', () => ({
  useAuth: () => ({
    userProfileData: mockUserProfileData,
    loadProfile: mockLoadProfile,
    setSecurityLockState: mockSetSecurityLockState,
  }),
}))

jest.mock('@/services/useTransactionBiometrics', () => ({
  resolveTransactionBiometricUserId: jest.fn(() => null),
  useTransactionBiometrics: () => ({
    biometricEnabled: false,
    biometricAvailable: false,
    biometricLoading: false,
    getApprovalToken: jest.fn(),
  }),
  getTransferBiometricFailureMessage: jest.fn(() => 'Biometric confirmation failed.'),
}))

jest.mock('@/utils/logger', () => ({
  error: jest.fn(),
}))

describe('SecurityLockScreen', () => {
  beforeEach(() => {
    mockGetSecurityLock.mockReset()
    mockLoadProfile.mockReset()
    mockSetSecurityLockState.mockReset()
  })

  it('does not render public experience copy', async () => {
    mockGetSecurityLock.mockResolvedValue({ active: false })

    let tree: any = null
    await act(async () => {
      tree = create(<SecurityLockScreen />)
    })

    const text = JSON.stringify(tree.toJSON())
    expect(text).toContain('Security Lock')
    expect(text).toContain('Ready to activate')
    expect(text).not.toContain('Public experience')
    expect(text).not.toContain('What stays available')
  })

  it('shows a friendly refresh error instead of raw 500 text', async () => {
    mockGetSecurityLock.mockRejectedValue(new Error('Request failed with status code 500'))

    let tree: any = null
    await act(async () => {
      tree = create(<SecurityLockScreen />)
    })

    const text = JSON.stringify(tree.toJSON())
    expect(text).toContain('Couldnt refresh status')
    expect(text).toContain('Please check your connection and try again.')
    expect(text).not.toContain('Request failed with status code 500')
  })
})
