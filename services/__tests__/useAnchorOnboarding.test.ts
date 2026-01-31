import React from 'react'
import { act, create } from 'react-test-renderer'
import { __resetAnchorOnboardingStore, useAnchorOnboarding } from '../useAnchorOnboarding'

let focusCallback: (() => void) | null = null
const mockGetUserAnchorAccountDetail = jest.fn()
const mockGetAccounts = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    focusCallback = cb
  },
}))

jest.mock('@/api/account', () => ({
  getUserAnchorAccountDetail: (...args: any[]) => mockGetUserAnchorAccountDetail(...args),
  getAccounts: (...args: any[]) => mockGetAccounts(...args),
}))

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

describe('useAnchorOnboarding', () => {
  let observed: ReturnType<typeof useAnchorOnboarding> | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    focusCallback = null
    observed = null
    __resetAnchorOnboardingStore()
  })

  it('keeps hydration false until the first fetch resolves', async () => {
    mockGetUserAnchorAccountDetail.mockResolvedValue({ data: null, has_anchor_account: false })
    mockGetAccounts.mockResolvedValue({ data: [] })

    const TestComponent = () => {
      observed = useAnchorOnboarding({ autoFetchOnMount: true, autoFetchOnFocus: false })
      return null
    }

    act(() => {
      create(React.createElement(TestComponent))
    })

    expect(observed?.isHydrated).toBe(false)

    await act(async () => {
      await flushPromises()
    })

    expect(observed?.isHydrated).toBe(true)
  })
})
