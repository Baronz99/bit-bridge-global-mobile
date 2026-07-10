import React from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'

const mockUseLocalSearchParams = jest.fn<
  Record<string, string>,
  []
>()

jest.mock('expo-router', () => ({
  Redirect: 'redirect-mock',
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}))

import LegacyPowerProvidersDetailRedirect from '@/app/powerProviders/[id]/index'
import LegacyPowerProvidersRedirect from '@/app/powerProviders/index'

describe('legacy powerProviders redirects', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReset()
  })

  it('redirects the legacy list route to the canonical electricity list route', async () => {
    mockUseLocalSearchParams.mockReturnValue({ service_key: 'ABUJA_ELECTRICITY' })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<LegacyPowerProvidersRedirect />)
    })

    const redirect = tree!.root.findByType('redirect-mock')
    expect(redirect.props.href).toEqual({
      pathname: '/electricity-provider',
      params: { service_key: 'ABUJA_ELECTRICITY' },
    })
  })

  it('redirects the legacy detail route to the canonical detail route with provider id preserved', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: '2', service_key: 'ABUJA_ELECTRICITY' })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<LegacyPowerProvidersDetailRedirect />)
    })

    const redirect = tree!.root.findByType('redirect-mock')
    expect(redirect.props.href).toEqual({
      pathname: '/electricity-provider/[id]',
      params: { id: '2', service_key: 'ABUJA_ELECTRICITY' },
    })
  })
})
