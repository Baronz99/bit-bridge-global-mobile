import { resolveBusinessKybValidationRoute } from '@/utils/businessKybValidationRouting'

const representativeError = (overrides: Record<string, unknown> = {}) => ({
  field_path: 'officers[0].phoneNumber',
  section: 'signatory',
  field_errors: [{
    field: 'officers[0].phoneNumber',
    code: 'anchor_officer_phone_invalid',
    message: 'Officer phone number could not be normalized into the current Anchor outbound format.',
    section: 'signatory',
    signatory_id: 'rep-1',
    canonical_field: 'phone',
  }],
  ...overrides,
})

describe('resolveBusinessKybValidationRoute', () => {
  it('uses the backend representative ID and canonical field for a single correction target', () => {
    expect(resolveBusinessKybValidationRoute(representativeError())).toMatchObject({
      section: 'signatory',
      signatoryId: 'rep-1',
      field: 'phone',
      errorCode: 'anchor_officer_phone_invalid',
      source: 'structured',
    })
  })

  it('uses canonical_field instead of normalizing the provider field path', () => {
    expect(resolveBusinessKybValidationRoute(representativeError({
      field_errors: [{
        field: 'officers[0].phoneNumber', code: 'anchor_officer_phone_invalid', message: 'ignored',
        section: 'signatory', signatory_id: 'rep-1', canonical_field: 'phone',
      }],
    }))?.field).toBe('phone')
  })

  it.each([
    ['anchor_state_mapping_missing', 'state'],
    ['anchor_signatory_title_invalid', 'title'],
    ['anchor_owner_percentage_missing', 'ownership_percentage'],
  ])('supports proven canonical field %s', (code, canonicalField) => {
    expect(resolveBusinessKybValidationRoute(representativeError({
      field_errors: [{ field: 'officers[0].value', code, message: 'ignored', section: 'signatory', signatory_id: 'rep-1', canonical_field: canonicalField }],
    }))).toMatchObject({ signatoryId: 'rep-1', field: canonicalField })
  })

  it('deduplicates duplicate role-level errors for one representative field', () => {
    const route = resolveBusinessKybValidationRoute(representativeError({
      field_errors: [
        { field: 'officers[0].phoneNumber', code: 'anchor_officer_phone_invalid', message: 'ignored', section: 'signatory', signatory_id: 'rep-1', canonical_field: 'phone', role: 'OWNER' },
        { field: 'officers[1].phoneNumber', code: 'anchor_officer_phone_invalid', message: 'ignored', section: 'signatory', signatory_id: 'rep-1', canonical_field: 'phone', role: 'DIRECTOR' },
      ],
    }))

    expect(route).toMatchObject({ signatoryId: 'rep-1', field: 'phone' })
    expect(route?.genericRepresentativeCorrection).toBeUndefined()
  })

  it('uses neutral representative review when targets are multiple, incomplete, or not rendered by the person form', () => {
    const multiple = resolveBusinessKybValidationRoute(representativeError({
      field_errors: [
        { field: 'officers[0].phoneNumber', message: 'ignored', section: 'signatory', signatory_id: 'rep-1', canonical_field: 'phone' },
        { field: 'officers[1].title', message: 'ignored', section: 'signatory', signatory_id: 'rep-2', canonical_field: 'title' },
      ],
    }))
    const missingId = resolveBusinessKybValidationRoute(representativeError({
      field_errors: [{ field: 'officers[0].phoneNumber', message: 'ignored', section: 'signatory', canonical_field: 'phone' }],
    }))
    const missingField = resolveBusinessKybValidationRoute(representativeError({
      field_errors: [{ field: 'officers[0].phoneNumber', message: 'ignored', section: 'signatory', signatory_id: 'rep-1' }],
    }))
    const unsupportedField = resolveBusinessKybValidationRoute(representativeError({
      field_errors: [{ field: 'officers[0].unknown', message: 'ignored', section: 'signatory', signatory_id: 'rep-1', canonical_field: 'unknown' }],
    }))

    for (const route of [multiple, missingId, missingField, unsupportedField]) {
      expect(route).toMatchObject({ section: 'signatory', genericRepresentativeCorrection: true })
      expect(route?.signatoryId).toBeUndefined()
      expect(route?.field).toBeUndefined()
    }
  })

  it('preserves non-representative routing', () => {
    expect(resolveBusinessKybValidationRoute({
      field_path: 'basicDetail.businessBvn', section: 'business', field_errors: [],
    })).toMatchObject({ section: 'business', field: 'businessbvn' })
    expect(resolveBusinessKybValidationRoute({
      field_path: 'contact.address.main.state', section: 'contact', field_errors: [],
    })).toMatchObject({ section: 'contact', field: 'state' })
  })
})
