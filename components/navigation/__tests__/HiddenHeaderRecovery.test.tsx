import React from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'

const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}))

import HiddenHeaderRecovery from '@/components/navigation/HiddenHeaderRecovery'

describe('HiddenHeaderRecovery', () => {
  beforeEach(() => {
    mockBack.mockReset()
    mockReplace.mockReset()
    mockCanGoBack.mockReset()
  })

  it('uses navigation history when available', async () => {
    mockCanGoBack.mockReturnValue(true)

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(
        <HiddenHeaderRecovery title="Circle unavailable" message="message" fallbackRoute="/circles" fallbackLabel="Back to Circles" />
      )
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Go back to the previous screen' })
    await act(async () => {
      button.props.onPress()
    })

    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
    expect(tree!.root.findAll((node) => node.props?.children === 'Circle unavailable').length).toBeGreaterThan(0)
  })

  it('falls back deterministically when history is unavailable', async () => {
    mockCanGoBack.mockReturnValue(false)

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(
        <HiddenHeaderRecovery title="Circle unavailable" message="message" fallbackRoute="/circles" fallbackLabel="Back to Circles" />
      )
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Circles' })
    await act(async () => {
      button.props.onPress()
    })

    expect(mockBack).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/circles')
  })

  it('runs retry without navigating on render', async () => {
    mockCanGoBack.mockReturnValue(false)
    const retry = jest.fn(() => Promise.resolve())

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(
        <HiddenHeaderRecovery
          title="Circle unavailable"
          message="message"
          fallbackRoute="/circles"
          fallbackLabel="Back to Circles"
          onRetry={retry}
        />
      )
    })

    expect(mockBack).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()

    const button = tree!.root.findByProps({ accessibilityLabel: 'Retry' })
    await act(async () => {
      await button.props.onPress()
    })

    expect(retry).toHaveBeenCalledTimes(1)
  })
})
