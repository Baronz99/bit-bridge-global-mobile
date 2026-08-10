import React from 'react'
import type { ReactNode } from 'react'
import { act, create } from 'react-test-renderer'

const mockDismissTo = jest.fn()
const mockReplace = jest.fn()
const mockCreateBusinessSignatory = jest.fn()
const mockGetBusinessOnboarding = jest.fn()
const mockUpdateBusinessSignatory = jest.fn()
let mockParams: Record<string, string> = {}

jest.mock('expo-router', () => ({
  useRouter: () => ({ dismissTo: mockDismissTo, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}))

jest.mock('@/services/useActiveAccount', () => ({
  useActiveAccount: () => ({ activeAccount: { type: 'business', businessId: 'biz-1' } }),
}))

jest.mock('@/api/business', () => ({
  createBusinessSignatory: (...args: unknown[]) => mockCreateBusinessSignatory(...args),
  getBusinessOnboarding: (...args: unknown[]) => mockGetBusinessOnboarding(...args),
  updateBusinessSignatory: (...args: unknown[]) => mockUpdateBusinessSignatory(...args),
}))

jest.mock('@/components/ScreenContainer', () => function ScreenContainer({ children }: { children?: ReactNode }) {
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return ReactLocal.createElement('screen-container', null, children)
})

jest.mock('@/components/business/BusinessPersonForm', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactLocal.createElement('business-person-form', props),
    emptyBusinessPerson: () => ({ full_name: '', director: false, authorized_signatory: false }),
  }
})

import NewBusinessPersonScreen from '@/app/business/signatories/new'
import EditBusinessPersonScreen from '@/app/business/signatories/[id]'

const person = { full_name: 'Ada Okafor', director: true, authorized_signatory: true }
const onboardingResponse = {
  data: {
    data: {
      onboarding_revision: 'revision-2',
      signatories: [{ id: 'person-a', ...person }],
      readiness: { signatory_issues: [] },
    },
  },
}

const savePerson = async (tree: ReturnType<typeof create>) => {
  const form = tree.root.find((node) => (node.type as unknown) === 'business-person-form')
  await act(async () => {
    await form.props.onSave(person)
  })
}

describe('business representative save routing', () => {
  beforeEach(() => {
    mockDismissTo.mockReset()
    mockReplace.mockReset()
    mockCreateBusinessSignatory.mockReset()
    mockGetBusinessOnboarding.mockReset()
    mockUpdateBusinessSignatory.mockReset()
    mockParams = {}
    mockCreateBusinessSignatory.mockResolvedValue({})
    mockGetBusinessOnboarding.mockResolvedValue(onboardingResponse)
    mockUpdateBusinessSignatory.mockResolvedValue({})
  })

  it('returns a new representative opened from Setup Overview to the existing Step 3 route', async () => {
    mockParams = { return_to: 'setup', revision: 'revision-1' }
    let tree!: ReturnType<typeof create>
    await act(async () => { tree = create(<NewBusinessPersonScreen />) })
    await savePerson(tree)

    expect(mockCreateBusinessSignatory).toHaveBeenCalledWith('biz-1', person, 'revision-1')
    expect(mockDismissTo).toHaveBeenCalledWith('/business/onboarding?section=signatory&return_to=setup')
    expect(mockReplace).not.toHaveBeenCalledWith('/business/setup')
  })

  it('returns normal create and edit flows to Step 3 without adding another onboarding route', async () => {
    let newTree!: ReturnType<typeof create>
    await act(async () => { newTree = create(<NewBusinessPersonScreen />) })
    await savePerson(newTree)
    expect(mockDismissTo).toHaveBeenCalledWith('/business/onboarding?section=signatory')

    mockDismissTo.mockReset()
    mockParams = { id: 'person-a' }
    let editTree!: ReturnType<typeof create>
    await act(async () => { editTree = create(<EditBusinessPersonScreen />) })
    await savePerson(editTree)
    expect(mockUpdateBusinessSignatory).toHaveBeenCalledWith('biz-1', 'person-a', person, 'revision-2')
    expect(mockDismissTo).toHaveBeenCalledWith('/business/onboarding?section=signatory')
  })

  it('keeps the explicit KYB correction return path', async () => {
    mockParams = { return_to: 'kyb', revision: 'revision-1' }
    let tree!: ReturnType<typeof create>
    await act(async () => { tree = create(<NewBusinessPersonScreen />) })
    await savePerson(tree)

    expect(mockReplace).toHaveBeenCalledWith('/business/kyb')
    expect(mockDismissTo).not.toHaveBeenCalled()
  })
})
