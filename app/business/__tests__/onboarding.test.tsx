import React from 'react'
import type { ReactNode } from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mockReplace = jest.fn()
const mockGetBusinessOnboarding = jest.fn()
const mockUpdateBusinessOnboarding = jest.fn()
const mockDeleteBusinessSignatory = jest.fn()
let mockParams: Record<string, string> = {}
let focusEffect: (() => void) | null = null

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}))

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => {
    focusEffect = effect
  },
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))

jest.mock('@react-native-community/datetimepicker', () => () => null)

jest.mock('@/components/ScreenContainer', () => {
  return function ScreenContainer({ children }: { children?: ReactNode }) {
    const ReactLocal = jest.requireActual<typeof import('react')>('react')
    return ReactLocal.createElement('screen-container', null, children)
  }
})

jest.mock('@/components/FormSelect', () => {
  return function FormSelect({
    label,
    onValueChange,
  }: {
    label: string
    onValueChange?: (value: string) => void
  }) {
    const ReactLocal = jest.requireActual<typeof import('react')>('react')
    return ReactLocal.createElement('form-select', { label, onValueChange })
  }
})

jest.mock('@/api/business', () => ({
  getBusinessOnboarding: (...args: unknown[]) => mockGetBusinessOnboarding(...args),
  updateBusinessOnboarding: (...args: unknown[]) => mockUpdateBusinessOnboarding(...args),
  deleteBusinessSignatory: (...args: unknown[]) => mockDeleteBusinessSignatory(...args),
}))

jest.mock('@/services/useActiveAccount', () => ({
  useActiveAccount: () => ({ activeAccount: { type: 'business', businessId: 'biz-1' } }),
}))
jest.mock('@/services/useAuth', () => ({
  useAuth: () => ({ user: { email: 'owner@example.com', phone_number: '+2348000000000' } }),
}))

jest.mock('@/utils/apiErrorMessage', () => ({
  buildApiErrorMessage: () => 'Unable to save business onboarding right now.',
}))
jest.mock('@/utils/businessStateValidation', () => ({
  BUSINESS_NIGERIA_STATE_OPTIONS: [],
  sanitizeBusinessStateValue: (value: string) => value,
}))

import BusinessOnboardingScreen from '@/app/business/onboarding'

const onboardingResponse = {
  data: {
    data: {
      business_entity: { name: 'Local business' },
      profile: {},
      signatories: [],
      readiness: {
        missing_profile_fields: [
          'legal_name',
          'business_type',
          'registration_number',
          'date_of_registration',
          'category',
        ],
        missing_signatory_requirements: [],
      },
      requirements: {
        groups: {
          company_details: {
            missing_fields: [
              'legal_name',
              'business_type',
              'registration_number',
              'date_of_registration',
              'category',
            ],
          },
        },
        fields: {},
      },
    },
  },
}

describe('BusinessOnboardingScreen', () => {
  beforeEach(() => {
    mockGetBusinessOnboarding.mockReset()
    mockUpdateBusinessOnboarding.mockReset()
    mockDeleteBusinessSignatory.mockReset()
    mockReplace.mockReset()
    mockParams = {}
    focusEffect = null
    mockGetBusinessOnboarding.mockResolvedValue(onboardingResponse)
  })

  const renderScreen = async () => {
    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<BusinessOnboardingScreen />)
    })
    await act(async () => {
      await focusEffect?.()
    })
    return tree!
  }

  const actionButtonFor = (tree: ReactTestRenderer, label: string) => {
    const actionLabel = tree.root
      .findAllByType('Text')
      .find((node) => node.children.includes(label))
    let actionButton = actionLabel?.parent
    while (actionButton && typeof actionButton.props.onPress !== 'function') {
      actionButton = actionButton.parent
    }
    return actionButton
  }

  it('uses a customer-facing Stack title and back label', () => {
    const layoutSource = readFileSync(join(process.cwd(), 'app', '_layout.tsx'), 'utf8')

    expect(layoutSource).toMatch(
      /name="business\/onboarding"\s+options=\{\{ headerTitle: 'Business setup', headerBackTitle: 'Back' \}\}/
    )
    expect(layoutSource).not.toMatch(
      /name="business\/onboarding"\s+options=\{\{ headerTitle: 'Business Profile' \}\}/
    )
    expect(layoutSource).toMatch(
      /name="business\/setup"\s+options=\{\{ headerTitle: 'Business setup', headerBackTitle: 'Back' \}\}/
    )
  })

  it('renders one customer-facing progress label without the legacy blocker or document cards', async () => {
    const tree = await renderScreen()
    const copy = JSON.stringify(tree.toJSON())

    expect(copy).toContain('Business details')
    expect(copy).toContain('Step 1 of 3')
    expect(copy).toContain('Enter the registered details for your business.')
    expect(copy).toContain('Registration details')
    expect(copy).not.toContain('SECTION 1')
    expect(copy).not.toContain('Finish the remaining blockers in this step')
    expect(copy).not.toContain('Still needed here:')
    expect(copy).not.toContain('Required before submission')
    expect(copy).not.toContain('Back to business overview')
  })

  it('keeps optional business details collapsed and removes technical registration copy', async () => {
    const tree = await renderScreen()
    const copy = JSON.stringify(tree.toJSON())

    expect(copy).toContain('Additional business details')
    expect(copy).toContain('Optional')
    expect(copy).not.toContain('Stored as')
    expect(copy).not.toContain('YYYY-MM-DD')
    expect(copy).not.toContain('The name shown for this business in BitBridge.')
  })

  it('shows the verification BVN when requirements require it or the user selects the proven NG limited-company path', async () => {
    const withoutBvn = await renderScreen()
    expect(JSON.stringify(withoutBvn.toJSON())).not.toContain('BVN for business verification')

    await act(async () => {
      withoutBvn.root.findByProps({ label: 'Business type' }).props.onValueChange('limited_company')
    })
    expect(JSON.stringify(withoutBvn.toJSON())).toContain('BVN for business verification')

    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboardingResponse.data.data,
          requirements: {
            groups: onboardingResponse.data.data.requirements.groups,
            fields: { business_bvn: { visible: true, required: true } },
          },
        },
      },
    })
    const withBvn = await renderScreen()
    const copy = JSON.stringify(withBvn.toJSON())
    expect(copy).toContain('BVN for business verification')
    expect(copy).toContain('This is required to complete verification for this business.')
    expect(copy).not.toContain('business-issued BVN')
  })

  it('uses an explicit dark iOS date-picker presentation', () => {
    const source = readFileSync(join(process.cwd(), 'app', 'business', 'onboarding.tsx'), 'utf8')

    expect(source).toContain('themeVariant="dark"')
    expect(source).toContain('textColor="#F8FAFC"')
  })

  it('prefills editable business contact details and hides duplicate contact emails', async () => {
    mockParams = { section: 'contact' }
    const tree = await renderScreen()
    const copy = JSON.stringify(tree.toJSON())

    expect(copy).toContain('owner@example.com')
    expect(copy).toContain('+2348000000000')
    expect(copy).not.toContain('Support email')
    expect(copy).not.toContain('Dispute email')
    expect(copy).toContain('Registered address is the same as operating address')
    expect(copy).not.toContain('Registered address line 2')
  })

  it('preserves a distinct registered address instead of selecting same-as-operating', async () => {
    mockParams = { section: 'contact' }
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboardingResponse.data.data,
          profile: {
            address_line_1: '12 Operating Road',
            city: 'Lagos',
            state: 'Lagos',
            country: 'NG',
            registered_address_line_1: '4 Registered Avenue',
            registered_city: 'Abuja',
            registered_state: 'FCT',
            registered_country: 'NG',
          },
        },
      },
    })
    const tree = await renderScreen()
    const copy = JSON.stringify(tree.toJSON())

    expect(copy).toContain('Registered address')
    expect(copy).toContain('4 Registered Avenue')
  })

  it('keeps the user on Step 1 and shows a friendly field-level error when Continue is incomplete', async () => {
    const tree = await renderScreen()
    const continueButton = actionButtonFor(tree, 'Continue')

    expect(continueButton).toBeDefined()
    await act(async () => {
      continueButton!.props.onPress()
    })

    const copy = JSON.stringify(tree.toJSON())
    expect(copy).toContain('Legal business name is required.')
    expect(mockUpdateBusinessOnboarding).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('keeps the existing save payload and advances to the next section when Step 1 is ready', async () => {
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboardingResponse.data.data,
          readiness: { missing_profile_fields: [], missing_signatory_requirements: [] },
          requirements: { groups: { company_details: { missing_fields: [] } }, fields: {} },
        },
      },
    })
    mockUpdateBusinessOnboarding.mockResolvedValue({
      data: {
        data: { business_entity: { name: 'Local business' }, readiness: {}, requirements: {} },
      },
    })
    const tree = await renderScreen()
    const continueButton = actionButtonFor(tree, 'Continue')

    await act(async () => {
      await continueButton!.props.onPress()
    })

    expect(mockUpdateBusinessOnboarding).toHaveBeenCalledWith(
      'biz-1',
      expect.objectContaining({ onboarding: expect.any(Object) })
    )
    expect(mockUpdateBusinessOnboarding.mock.calls[0][1]).toMatchObject({
      onboarding: {
        name: 'Local business',
        legal_name: '',
        registration_number: '',
        signatories: [],
      },
    })
    expect(mockReplace).toHaveBeenCalledWith('/business/onboarding?section=contact')
  })

  it('preserves correction-mode return to Business Verification after save', async () => {
    mockParams = {
      section: 'business',
      mode: 'fix',
      return_to: 'kyb',
      field: 'legal_name',
      field_error: 'Use the registered name.',
    }
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboardingResponse.data.data,
          readiness: { missing_profile_fields: [], missing_signatory_requirements: [] },
          requirements: { groups: { company_details: { missing_fields: [] } }, fields: {} },
        },
      },
    })
    mockUpdateBusinessOnboarding.mockResolvedValue({
      data: {
        data: { business_entity: { name: 'Local business' }, readiness: {}, requirements: {} },
      },
    })
    const tree = await renderScreen()
    const saveCorrectionButton = actionButtonFor(tree, 'Save correction and return to review')

    await act(async () => {
      await saveCorrectionButton!.props.onPress()
    })

    expect(mockReplace).toHaveBeenCalledWith('/business/kyb')
  })

  it('returns to Business Setup after saving a section opened for review', async () => {
    mockParams = { section: 'business', return_to: 'setup' }
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboardingResponse.data.data,
          readiness: { missing_profile_fields: [], missing_signatory_requirements: [] },
          requirements: { groups: { company_details: { missing_fields: [] } }, fields: {} },
        },
      },
    })
    mockUpdateBusinessOnboarding.mockResolvedValue({
      data: { data: { business_entity: { name: 'Local business' }, readiness: {}, requirements: {} } },
    })

    const tree = await renderScreen()
    const continueButton = actionButtonFor(tree, 'Continue')
    await act(async () => { await continueButton!.props.onPress() })

    expect(mockReplace).toHaveBeenCalledWith('/business/setup')
  })

  it('renders Business representatives from backend role requirements without raw backend keys', async () => {
    mockParams = { section: 'signatory' }
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboardingResponse.data.data,
          onboarding_revision: 'revision-1',
          signatories: [{ id: 'person-a', full_name: 'Ada Okafor', ownership_percentage: 60, director: true, authorized_signatory: false }],
          readiness: {
            missing_profile_fields: [],
            missing_signatory_requirements: [],
            signatory_issues: [{ signatory_id: 'person-a', submission_ready: false, missing_fields: ['bvn'] }],
            role_requirements: { required_roles: ['owner', 'director', 'authorised_signatory'], missing_roles: ['authorised_signatory'] },
          },
        },
      },
    })

    const tree = await renderScreen()
    const copy = JSON.stringify(tree.toJSON())

    expect(copy).toContain('Business representatives')
    expect(copy).toContain('Add the owners, directors or authorised signatories associated with this business.')
    expect(copy).toContain('Ada Okafor')
    expect(copy).toContain('Owner · 60%')
    expect(copy).toContain('Director')
    expect(copy).toContain('Needs attention')
    expect(copy).toContain('More information needed')
    expect(copy).toContain('Mark at least one representative as an authorised signatory')
    expect(copy).toContain('Add another representative')
    expect(copy).toContain('Continue to business verification')
    expect(copy).not.toContain('missing_signatory_requirements')
    expect(copy).not.toContain('anchor_private_incorporated')
  })

  it('uses a calm zero-representative state and hides guidance and Continue until a representative exists', async () => {
    mockParams = { section: 'signatory' }
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboardingResponse.data.data,
          onboarding_revision: 'revision-1',
          signatories: [],
          readiness: {
            missing_profile_fields: [],
            missing_signatory_requirements: [],
            role_requirements: { required_roles: ['owner', 'director'], missing_roles: ['owner', 'director'] },
          },
        },
      },
    })

    const tree = await renderScreen()
    const copy = JSON.stringify(tree.toJSON())

    expect((copy.match(/Business representatives/g) || []).length).toBe(1)
    expect(copy).toContain('No representatives added yet')
    expect(copy).toContain('Add representative')
    expect(copy).not.toContain('Add another representative')
    expect(copy).not.toContain('More information needed')
    expect(copy).not.toContain('Continue to business verification')
    expect(copy).not.toContain('anchor_private_incorporated')
  })

  it('continues to Business Verification only when backend readiness is complete', async () => {
    mockParams = { section: 'signatory' }
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboardingResponse.data.data,
          signatories: [{ id: 'person-a', full_name: 'Ada Okafor', ownership_percentage: 100, director: true, authorized_signatory: true }],
          readiness: { missing_profile_fields: [], missing_signatory_requirements: [], signatory_issues: [], role_requirements: { missing_roles: [] } },
        },
      },
    })

    const tree = await renderScreen()
    const continueButton = actionButtonFor(tree, 'Continue to business verification')
    await act(async () => { continueButton!.props.onPress() })

    expect(mockReplace).toHaveBeenCalledWith('/business/kyb')
  })

  it('keeps a populated but incomplete business on Business representatives', async () => {
    mockParams = { section: 'signatory' }
    mockGetBusinessOnboarding.mockResolvedValue({
      data: {
        data: {
          ...onboardingResponse.data.data,
          signatories: [{ id: 'person-a', full_name: 'Ada Okafor', ownership_percentage: 100, director: false, authorized_signatory: true }],
          readiness: {
            missing_profile_fields: [],
            missing_signatory_requirements: [],
            signatory_issues: [],
            role_requirements: { missing_roles: ['director'] },
          },
        },
      },
    })

    const tree = await renderScreen()
    const continueButton = actionButtonFor(tree, 'Continue to business verification')
    await act(async () => { continueButton!.props.onPress() })

    expect(mockReplace).not.toHaveBeenCalledWith('/business/kyb')
    expect(JSON.stringify(tree.toJSON())).toContain('Complete the required roles before continuing.')
  })

  it('refreshes the representative list when Step 3 regains focus after a save', async () => {
    mockParams = { section: 'signatory', return_to: 'setup' }
    mockGetBusinessOnboarding.mockResolvedValueOnce({
      data: {
        data: {
          ...onboardingResponse.data.data,
          signatories: [{ id: 'person-a', full_name: 'Ada Okafor' }],
          readiness: { missing_profile_fields: [], missing_signatory_requirements: [] },
        },
      },
    })
    const tree = await renderScreen()
    expect(JSON.stringify(tree.toJSON())).toContain('Ada Okafor')

    mockGetBusinessOnboarding.mockResolvedValueOnce({
      data: {
        data: {
          ...onboardingResponse.data.data,
          signatories: [
            { id: 'person-a', full_name: 'Ada Okafor' },
            { id: 'person-b', full_name: 'Cyril Okafor' },
          ],
          readiness: {
            missing_profile_fields: [],
            missing_signatory_requirements: [],
            role_requirements: { missing_roles: [] },
            signatory_issues: [],
          },
        },
      },
    })

    await act(async () => {
      await focusEffect?.()
    })

    const copy = JSON.stringify(tree.toJSON())
    expect(copy).toContain('Ada Okafor')
    expect(copy).toContain('Cyril Okafor')
    expect(copy).toContain('Continue to business verification')
    expect(mockReplace).not.toHaveBeenCalledWith('/business/kyb')
  })
})
