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

  it('fetches user accounts fallback when detail misses account name/bank', async () => {
    mockGetUserAnchorAccountDetail.mockResolvedValue({
      data: { accountNumber: '1234567890', status: 'verified' },
      has_anchor_account: true,
    })
    mockGetAccounts.mockResolvedValue({
      data: [{ vendor: 'anchor', account_name: 'Okafor Cyril', bank_name: 'GTBank Plc' }],
    })

    const TestComponent = () => {
      observed = useAnchorOnboarding({ autoFetchOnMount: true, autoFetchOnFocus: false })
      return null
    }

    act(() => {
      create(React.createElement(TestComponent))
    })

    await act(async () => {
      await flushPromises()
    })

    expect(mockGetAccounts).toHaveBeenCalledTimes(1)
    expect(observed?.accountName).toBe('Okafor Cyril')
    expect(observed?.bankName).toBe('GTBank Plc')
  })

  it('fetches user accounts for parity even when detail already includes account fields', async () => {
    mockGetUserAnchorAccountDetail.mockResolvedValue({
      data: {
        accountNumber: '1234567890',
        accountName: 'Okafor Cyril',
        bankName: 'GTBank Plc',
        status: 'verified',
      },
      has_anchor_account: true,
    })
    mockGetAccounts.mockResolvedValue({ data: [] })

    const TestComponent = () => {
      observed = useAnchorOnboarding({ autoFetchOnMount: true, autoFetchOnFocus: false })
      return null
    }

    act(() => {
      create(React.createElement(TestComponent))
    })

    await act(async () => {
      await flushPromises()
    })

    expect(mockGetAccounts).toHaveBeenCalledTimes(1)
    expect(observed?.accountName).toBe('Okafor Cyril')
    expect(observed?.bankName).toBe('GTBank Plc')
  })

  it('still hydrates from detail when accounts fetch fails but critical fields exist', async () => {
    mockGetUserAnchorAccountDetail.mockResolvedValue({
      data: {
        accountNumber: '1234567890',
        accountName: 'Provider Name',
        bankName: 'Provider Bank',
        status: 'verified',
      },
      has_anchor_account: true,
    })
    mockGetAccounts.mockRejectedValue(new Error('accounts endpoint down'))

    const TestComponent = () => {
      observed = useAnchorOnboarding({ autoFetchOnMount: true, autoFetchOnFocus: false })
      return null
    }

    act(() => {
      create(React.createElement(TestComponent))
    })

    await act(async () => {
      await flushPromises()
    })

    expect(observed?.isHydrated).toBe(true)
    expect(observed?.accountName).toBe('Provider Name')
    expect(observed?.bankName).toBe('Provider Bank')
  })
})
