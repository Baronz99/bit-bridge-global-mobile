import React from 'react'
import type { ReactNode } from 'react'
import { act, create } from 'react-test-renderer'

const mockReplace = jest.fn()
const mockDismissTo = jest.fn()
const mockGetBusinessOnboarding = jest.fn()
const mockUpdateBusinessSignatory = jest.fn()
let mockParams: Record<string, string> = {}
let capturedCorrection: any

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, dismissTo: mockDismissTo }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/services/useActiveAccount', () => ({
  useActiveAccount: () => ({ activeAccount: { type: 'business', businessId: 'biz-1' } }),
}))
jest.mock('@/components/ScreenContainer', () => function ScreenContainer({ children }: { children?: ReactNode }) {
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return ReactLocal.createElement('screen-container', null, children)
})
jest.mock('@/components/business/BusinessPersonForm', () => function BusinessPersonForm({ correction, onSave }: any) {
  capturedCorrection = correction
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return ReactLocal.createElement('person-form', { onSave })
})
jest.mock('@/api/business', () => ({
  getBusinessOnboarding: (...args: unknown[]) => mockGetBusinessOnboarding(...args),
  updateBusinessSignatory: (...args: unknown[]) => mockUpdateBusinessSignatory(...args),
}))

import EditBusinessPersonScreen from '@/app/business/signatories/[id]'

const response = {
  data: {
    data: {
      onboarding_revision: 'rev-1',
      signatories: [{ id: 'rep-1', full_name: 'Cyril Okafor', phone: '08012345678' }],
      readiness: { signatory_issues: [] },
    },
  },
}

describe('EditBusinessPersonScreen correction return routing', () => {
  beforeEach(() => {
    mockReplace.mockReset(); mockDismissTo.mockReset(); mockGetBusinessOnboarding.mockReset(); mockUpdateBusinessSignatory.mockReset()
    mockGetBusinessOnboarding.mockResolvedValue(response)
    mockUpdateBusinessSignatory.mockResolvedValue({ data: {} })
    capturedCorrection = undefined
  })

  it('passes correction targeting to the form and returns a saved correction to KYB', async () => {
    mockParams = { id: 'rep-1', mode: 'fix', field: 'phone', error_code: 'anchor_officer_phone_invalid', return_to: 'kyb' }
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<EditBusinessPersonScreen />); await Promise.resolve(); await Promise.resolve() })

    expect(capturedCorrection).toEqual({ active: true, field: 'phone', errorCode: 'anchor_officer_phone_invalid' })
    await act(async () => { await tree!.root.findByType('person-form').props.onSave({ full_name: 'Cyril Okafor', phone: '08012345678' }) })

    expect(mockUpdateBusinessSignatory).toHaveBeenCalledWith('biz-1', 'rep-1', expect.objectContaining({ phone: '08012345678' }), 'rev-1')
    expect(mockReplace).toHaveBeenCalledWith('/business/kyb')
    expect(mockDismissTo).not.toHaveBeenCalled()
  })

  it('keeps normal representative editing on the Step 3 return path', async () => {
    mockParams = { id: 'rep-1' }
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<EditBusinessPersonScreen />); await Promise.resolve(); await Promise.resolve() })

    expect(capturedCorrection).toBeUndefined()
    await act(async () => { await tree!.root.findByType('person-form').props.onSave({ full_name: 'Cyril Okafor' }) })

    expect(mockDismissTo).toHaveBeenCalledWith('/business/onboarding?section=signatory')
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
