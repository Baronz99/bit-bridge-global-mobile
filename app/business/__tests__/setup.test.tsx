import React from 'react'
import type { ReactNode } from 'react'
import { act, create } from 'react-test-renderer'

const mockPush = jest.fn()
const mockGetBusinessOnboarding = jest.fn()
let focusEffect: (() => void) | null = null

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (effect: () => void) => { focusEffect = effect } }))
jest.mock('@/services/useActiveAccount', () => ({ useActiveAccount: () => ({ activeAccount: { type: 'business', businessId: 'biz-1' } }) }))
jest.mock('@/api/business', () => ({ getBusinessOnboarding: (...args: unknown[]) => mockGetBusinessOnboarding(...args) }))
jest.mock('@/components/ScreenContainer', () => function ScreenContainer({ children }: { children?: ReactNode }) {
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return ReactLocal.createElement('screen-container', null, children)
})

import BusinessSetupScreen from '@/app/business/setup'

const onboarding = {
  data: {
    data: {
      business_entity: { status: 'profile_submitted' },
      profile: { anchor_kyb_status: 'not_started' },
      journey: { stage: 'signatory_required', next_route: '/business/onboarding?section=signatory' },
      readiness: {
        missing_profile_fields: [],
        missing_signatory_requirements: ['authorized_signatory'],
      },
    },
  },
}

describe('BusinessSetupScreen', () => {
  beforeEach(() => {
    mockPush.mockReset()
    focusEffect = null
    mockGetBusinessOnboarding.mockResolvedValue(onboarding)
  })

  it('separates three setup sections from verification and resumes the backend journey', async () => {
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessSetupScreen />) })
    await act(async () => { await focusEffect?.() })
    const copy = JSON.stringify(tree!.toJSON())

    expect(copy).toContain('of 3 sections complete')
    expect(copy).toContain('Business details')
    expect(copy).toContain('Contact & address')
    expect(copy).toContain('Business representatives')
    expect(copy).toContain('Needs attention')
    expect(copy).toContain('Verification')
    expect(copy).not.toContain('missing_signatory_requirements')

    const continueLabel = tree!.root.findAllByType('Text').find((node) => node.children.includes('Continue setup'))
    let button = continueLabel?.parent
    while (button && typeof button.props.onPress !== 'function') button = button.parent
    await act(async () => { button!.props.onPress() })

    expect(mockPush).toHaveBeenCalledWith('/business/onboarding?section=signatory')
  })

  it('uses Requirements met for business representatives without changing other completed sections', async () => {
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboarding.data.data,
          readiness: {
            missing_profile_fields: [],
            missing_signatory_requirements: [],
          },
        },
      },
    })
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessSetupScreen />) })
    await act(async () => { await focusEffect?.() })
    const copy = JSON.stringify(tree!.toJSON())

    expect(copy).toContain('Requirements met')
    expect(copy).toContain('Complete')
  })

  it('shows ready-for-verification copy and routes with the Journey route when setup is complete', async () => {
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboarding.data.data,
          journey: {
            stage: 'ready_for_verification',
            can_submit_kyb: true,
            next_action: 'submit_for_verification',
            next_route: '/business/kyb',
          },
          readiness: { missing_profile_fields: [], missing_signatory_requirements: [] },
        },
      },
    })
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessSetupScreen />) })
    await act(async () => { await focusEffect?.() })
    const copy = JSON.stringify(tree!.toJSON())

    expect(copy).toContain('Ready for verification')
    expect(copy).toContain('Start verification')
    expect(copy).not.toContain('More information needed')
    expect(copy).not.toContain('Documents needed')

    const label = tree!.root.findAllByType('Text').find((node) => node.children.includes('Start verification'))
    let button = label?.parent
    while (button && typeof button.props.onPress !== 'function') button = button.parent
    await act(async () => { button!.props.onPress() })

    expect(mockPush).toHaveBeenCalledWith('/business/kyb')
  })

  it.each([
    ['verification_in_progress', 'Verification in review', 'View verification'],
    ['provider_documents_required', 'Documents needed', 'Upload requested documents'],
    ['verification_rejected', 'Action required', 'Review and correct'],
    ['ready_for_activation', 'Business verified', 'Continue'],
    ['business_banking_live', 'Verified', 'Open business dashboard'],
  ])('maps %s to customer-safe verification copy', async (stage, label, ctaLabel) => {
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboarding.data.data,
          journey: { stage, next_route: '/business/kyb' },
          readiness: { missing_profile_fields: [], missing_signatory_requirements: [] },
        },
      },
    })
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessSetupScreen />) })
    await act(async () => { await focusEffect?.() })
    const copy = JSON.stringify(tree!.toJSON())

    expect(copy).toContain(label)
    expect(copy).toContain(ctaLabel)
    expect(copy).not.toContain(stage)
  })
})
