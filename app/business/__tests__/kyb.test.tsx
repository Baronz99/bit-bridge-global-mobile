import React from 'react'
import type { ReactNode } from 'react'
import { act, create } from 'react-test-renderer'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockSubmitBusinessKyb = jest.fn()
const mockCreateBusinessProvisioning = jest.fn()
const mockGetBusinessKyb = jest.fn()
const mockGetBusinessKybDocuments = jest.fn()
const mockGetBusinessKybStatus = jest.fn()
const mockGetBusinessOnboarding = jest.fn()
const mockResolveBusinessKybValidationRoute = jest.fn()

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }))
jest.mock('@/services/useActiveAccount', () => ({ useActiveAccount: () => ({ activeAccount: { type: 'business', businessId: 'biz-1', current_user_role: 'owner' } }) }))
jest.mock('@/components/ScreenContainer', () => function ScreenContainer({ children }: { children?: ReactNode }) {
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return ReactLocal.createElement('screen-container', null, children)
})
jest.mock('@/api/business', () => ({
  createBusinessProvisioning: (...args: unknown[]) => mockCreateBusinessProvisioning(...args),
  getBusinessKyb: (...args: unknown[]) => mockGetBusinessKyb(...args),
  getBusinessKybDocuments: (...args: unknown[]) => mockGetBusinessKybDocuments(...args),
  getBusinessKybStatus: (...args: unknown[]) => mockGetBusinessKybStatus(...args),
  getBusinessOnboarding: (...args: unknown[]) => mockGetBusinessOnboarding(...args),
  resyncBusinessKyb: jest.fn(),
  submitBusinessKyb: (...args: unknown[]) => mockSubmitBusinessKyb(...args),
  uploadBusinessKybDocument: jest.fn(),
}))
jest.mock('@/utils/apiErrorMessage', () => ({ buildApiErrorMessage: () => 'error' }))
jest.mock('@/utils/kycUploadPicker', () => ({ pickKycUpload: jest.fn() }))
jest.mock('@/utils/businessStateValidation', () => ({ isNigeriaCountry: () => false, normalizeNigeriaState: (value: string) => value }))
jest.mock('@/utils/businessKybValidationRouting', () => ({
  resolveBusinessKybValidationRoute: (...args: unknown[]) => mockResolveBusinessKybValidationRoute(...args),
}))

import BusinessKybScreen from '@/app/business/kyb'

const renderText = (tree: ReturnType<typeof create>) => JSON.stringify(tree.toJSON())

const readyPayload = (stage = 'ready_for_verification') => ({
  business_entity: { name: 'Greenfield Ltd', current_user_role: 'owner', status: 'profile_submitted' },
  readiness: { profile_ready: true, ready_for_kyb_submission: true, missing_profile_fields: [], missing_signatory_requirements: [] },
  journey: { stage, can_submit_kyb: stage === 'ready_for_verification', next_action: stage === 'ready_for_verification' ? 'submit_for_verification' : 'track_verification', next_route: '/business/kyb' },
  gate: { approved_for_provisioning: stage === 'ready_for_activation' },
  requirements: { documents: { pre_submission: [{ kind: 'registration_certificate', label: 'Registration certificate' }, { kind: 'proof_of_address', label: 'Proof of address' }], provider_requested: [] } },
})

const configure = (stage = 'ready_for_verification', overrides: Record<string, unknown> = {}) => {
  const payload = { ...readyPayload(stage), ...overrides }
  mockGetBusinessKyb.mockResolvedValue({ data: { data: payload } })
  mockGetBusinessKybDocuments.mockResolvedValue({ data: { data: { documents: [], requirements: payload.requirements } } })
  mockGetBusinessKybStatus.mockResolvedValue({ data: { data: { business_entity: payload.business_entity, journey: payload.journey, readiness: payload.readiness, gate: payload.gate, provider: overrides.provider || {} } } })
  mockGetBusinessOnboarding.mockResolvedValue({ data: { data: { profile: { legal_name: 'Greenfield Ltd', business_type: 'limited_company', registration_number: 'RC1001', contact_email: 'ops@greenfield.test', contact_phone: '+2348000000000', address_line_1: '12 Broad Street', city: 'Lagos', state: 'Lagos', country: 'NG' }, signatories: [{ full_name: 'Cyril Okafor', ownership_percentage: 100, director: true, authorized_signatory: true, bvn: '22222222226', date_of_birth: '1990-01-10', id_document_number: '12345678901' }] } } })
}

describe('BusinessKybScreen', () => {
  beforeEach(() => {
    mockPush.mockReset(); mockReplace.mockReset(); mockSubmitBusinessKyb.mockReset(); mockCreateBusinessProvisioning.mockReset(); mockResolveBusinessKybValidationRoute.mockReset()
    mockResolveBusinessKybValidationRoute.mockReturnValue(null)
    mockSubmitBusinessKyb.mockResolvedValue({ data: { message: 'Business submitted for review.' } })
    mockCreateBusinessProvisioning.mockResolvedValue({ data: { message: 'Business account activation started.' } })
    configure()
  })

  it('renders a compact ready-for-verification review and starts the existing submission action', async () => {
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    const copy = renderText(tree!)

    expect(copy).toContain('Ready for verification')
    expect(copy).toContain('Legal business name')
    expect(copy).toContain('Contact & address')
    expect(copy).toContain('Business representatives')
    expect(copy).toContain('Owner')
    expect(copy).toContain('Director')
    expect(copy).toContain('Authorised signatory')
    expect(copy).toContain('Documents to keep ready')
    expect(copy).toContain('Start verification')
    expect(copy).not.toContain('Ready to activate')
    expect(copy).not.toContain('Business BVN')
    expect(copy).not.toContain('Signatory field values')
    expect(copy).not.toContain('Authorized signatory')
    expect(copy).not.toContain('profile_submitted')
    expect(copy).not.toContain('missing')

    const start = tree!.root.findAll((node) => node.type === 'Text').find((node) => node.children.includes('Start verification'))
    let button = start?.parent
    while (button && typeof button.props.onPress !== 'function') button = button.parent
    await act(async () => { await button!.props.onPress() })
    expect(mockSubmitBusinessKyb).toHaveBeenCalledWith('biz-1')
  })

  it('shows review-only content while verification is in review', async () => {
    configure('verification_in_progress')
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    const copy = renderText(tree!)
    expect(copy).toContain('Verification in review')
    expect(copy).not.toContain('Start verification')
    expect(copy).not.toContain('"Edit"')
  })

  it('shows only provider-requested documents as actionable when documents are requested', async () => {
    configure('provider_documents_required', {
      requirements: { documents: { pre_submission: [], provider_requested: [{ kind: 'tax_registration', label: 'Tax registration', provider_status: 'required', input_type: 'file' }] } },
      provider: { anchor_kyb_status: 'awaiting_documents' },
    })
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    const copy = renderText(tree!)
    expect(copy).toContain('Documents needed')
    expect(copy).toContain('Tax registration')
    expect(copy).toContain('Upload requested documents')
    expect(copy).not.toContain('Documents to keep ready')
  })

  it('uses the customer-safe rejected and activation states', async () => {
    configure('verification_rejected', { provider: { anchor_failure_reason: 'Update the registration number.' } })
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    expect(renderText(tree!)).toContain('Action required')

    configure('ready_for_activation')
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    expect(renderText(tree!)).toContain('Business verified')
    expect(renderText(tree!)).toContain('Activate business banking')

    const activate = tree!.root.findAll((node) => node.type === 'Text').find((node) => node.children.includes('Activate business banking'))
    let button = activate?.parent
    while (button && typeof button.props.onPress !== 'function') button = button.parent
    await act(async () => { await button!.props.onPress() })
    expect(mockCreateBusinessProvisioning).toHaveBeenCalledWith('biz-1')
    expect(mockReplace).not.toHaveBeenCalledWith('/business')
  })

  it('renders customer-safe provisioning and confirmation states without an activation retry CTA', async () => {
    configure('business_banking_provisioning')
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    expect(renderText(tree!)).toContain('Activating business banking')
    expect(renderText(tree!)).toContain('Refresh activation status')
    expect(renderText(tree!)).not.toContain('Activate business banking')
    await act(async () => { tree!.unmount() })

    configure('provisioning_reconciliation_required')
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    const copy = renderText(tree!)
    expect(copy).toContain('We’re confirming your account setup')
    expect(copy).toContain('Check activation status')
    expect(copy).not.toContain('reconciliation_required')
    await act(async () => { tree!.unmount() })
  })

  it('keeps targeted correction routing and maps live and restricted states without raw enums', async () => {
    mockResolveBusinessKybValidationRoute.mockReturnValue({ section: 'business', field: 'registration_number', source: 'structured' })
    configure('verification_rejected', { provider: { anchor_failure_reason: 'Update the registration number.' } })
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    const correct = tree!.root.findAll((node) => node.type === 'Text').find((node) => node.children.includes('Review and correct'))
    let button = correct?.parent
    while (button && typeof button.props.onPress !== 'function') button = button.parent
    await act(async () => { button!.props.onPress() })
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/business/onboarding' }))

    configure('business_banking_live')
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    expect(renderText(tree!)).toContain('Verified')
    expect(renderText(tree!)).toContain('Open business dashboard')

    configure('business_restricted')
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    const copy = renderText(tree!)
    expect(copy).toContain('Review required')
    expect(copy).not.toContain('business_restricted')
  })

  it('opens the exact representative correction form when the backend provides one safe target', async () => {
    mockResolveBusinessKybValidationRoute.mockReturnValue({
      section: 'signatory', signatoryId: 'rep-1', field: 'phone', errorCode: 'anchor_officer_phone_invalid', source: 'structured',
    })
    mockSubmitBusinessKyb.mockRejectedValue({ response: { data: {} } })
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })

    const start = tree!.root.findAll((node) => node.type === 'Text').find((node) => node.children.includes('Start verification'))
    let button = start?.parent
    while (button && typeof button.props.onPress !== 'function') button = button.parent
    await act(async () => { await button!.props.onPress() })

    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/business/signatories/[id]',
      params: expect.objectContaining({ id: 'rep-1', field: 'phone', error_code: 'anchor_officer_phone_invalid', return_to: 'kyb' }),
    }))
  })

  it('keeps an ambiguous representative correction on the neutral list fallback', async () => {
    mockResolveBusinessKybValidationRoute.mockReturnValue({ section: 'signatory', genericRepresentativeCorrection: true, source: 'structured' })
    configure('verification_rejected', { provider: { anchor_failure_reason: 'Representative information needs attention.' } })
    let tree: ReturnType<typeof create> | null = null
    await act(async () => { tree = create(<BusinessKybScreen />); await Promise.resolve(); await Promise.resolve() })
    const correct = tree!.root.findAll((node) => node.type === 'Text').find((node) => node.children.includes('Review and correct'))
    let button = correct?.parent
    while (button && typeof button.props.onPress !== 'function') button = button.parent
    await act(async () => { button!.props.onPress() })

    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/business/onboarding',
      params: expect.objectContaining({ section: 'signatory', generic_representative_correction: 'true', return_to: 'kyb' }),
    }))
  })
})
