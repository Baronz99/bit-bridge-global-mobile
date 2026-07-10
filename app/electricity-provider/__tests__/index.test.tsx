import React from 'react'
import type { ReactNode } from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'

import ElectricityProvidersScreen from '@/app/electricity-provider/index'

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}))

jest.mock('@/hooks/useServiceAvailability', () => ({
  __esModule: true,
  default: () => ({
    getStatus: jest.fn(() => ({ state: 'operational' })),
  }),
}))

jest.mock('@/constants/images', () => ({
  images: {
    AEDC: 1,
    EKEDC: 1,
    EEDC: 1,
    IKEDC: 1,
    JED: 1,
    PHED: 1,
    fail: 1,
    bg: 1,
  },
}))

jest.mock('@/components/service-availability/ServiceStatusPill', () => {
  return function MockServiceStatusPill() {
    return null
  }
})

describe('ElectricityProvidersScreen', () => {
  it('renders all six expected providers including AEDC on the canonical screen', async () => {
    let tree: ReactTestRenderer | null = null

    await act(async () => {
      tree = create(<ElectricityProvidersScreen />)
    })

    const text = JSON.stringify(tree!.toJSON())

    expect(text).toContain('Ikeja Electric')
    expect(text).toContain('Abuja Electric')
    expect(text).toContain('Enugu Electric')
    expect(text).toContain('Jos Electric')
    expect(text).toContain('PHED')
    expect(text).toContain('Eko Electric')
    expect(text).toContain('AEDC')
  })
})
